/**
 * AssistantMessage Integration Tests for Data Parts
 *
 * Tests the ACTUAL rendering path: message.parts → extraction → component rendering.
 *
 * This test would have caught the bug where data-askUserInput parts were streamed
 * correctly but never rendered because getDataParts() didn't exist and the
 * extraction/rendering code was missing.
 *
 * Unlike message-tool-rendering.test.tsx which tests extraction functions in isolation,
 * this test renders the actual AssistantMessage component with real message data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { UIMessage } from "@ai-sdk/react";

// Must mock dependencies BEFORE importing the component
vi.mock("@/lib/client-logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@sentry/nextjs", () => ({
    captureMessage: vi.fn(),
    captureException: vi.fn(),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<object>) => (
            <div {...props}>{children}</div>
        ),
        span: ({ children, ...props }: React.PropsWithChildren<object>) => (
            <span {...props}>{children}</span>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren<object>) => <>{children}</>,
}));

// Mock useConcierge from its actual location
vi.mock("@/lib/concierge/context", () => ({
    useConcierge: () => ({
        concierge: {
            modelId: "claude-sonnet-4-20250514",
            temperature: 0.7,
            explanation: "Using Sonnet for this response",
            reasoning: null,
        },
    }),
}));

// Mock context providers from connect-runtime-provider
vi.mock("@/components/connection/connect-runtime-provider", () => ({
    useChatContext: () => ({
        append: vi.fn(),
        messages: [],
        isLoading: false,
        stop: vi.fn(),
        reload: vi.fn(),
        regenerateFrom: vi.fn(),
        regenerateFromWithModel: vi.fn(),
        editMessageAndRegenerate: vi.fn(),
        error: null,
        clearError: vi.fn(),
        input: "",
        setInput: vi.fn(),
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
    }),
    useModelOverrides: () => ({
        overrides: {},
    }),
    useCodeMode: () => ({
        isCodeMode: false,
        projectPath: null,
    }),
}));

// Mock child components to simplify testing
vi.mock("@/components/model-avatar", () => ({
    ModelAvatar: () => <div data-testid="model-avatar" />,
}));

vi.mock("@/components/connection/concierge-display", () => ({
    ConciergeDisplay: () => <div data-testid="concierge-display" />,
}));

vi.mock("@/components/connection/transient-status", () => ({
    TransientStatus: () => <div data-testid="transient-status" />,
}));

vi.mock("@/components/connection/code-mode-activity", () => ({
    CodeModeActivity: () => <div data-testid="code-mode-activity" />,
    InlineToolActivity: () => <div data-testid="inline-tool-activity" />,
}));

vi.mock("@/components/connection/reasoning-display", () => ({
    ReasoningDisplay: () => <div data-testid="reasoning-display" />,
}));

vi.mock("@/components/tools/tool-part-renderer", () => ({
    ToolPartRenderer: ({ part }: { part: { type: string } }) => (
        <div data-testid={`tool-${part.type}`} />
    ),
}));

vi.mock("@/components/connection/file-part-renderer", () => ({
    FilePartRenderer: () => <div data-testid="file-renderer" />,
}));

vi.mock("@/components/ui/copy-button", () => ({
    CopyButton: () => <button data-testid="copy-button">Copy</button>,
}));

vi.mock("@/components/ui/regenerate-menu", () => ({
    RegenerateMenu: () => <div data-testid="regenerate-menu" />,
}));

vi.mock("@/components/ui/carmenta-avatar", () => ({
    CarmentaAvatar: () => <div data-testid="carmenta-avatar" />,
}));

vi.mock("@/components/ui/markdown-renderer", () => ({
    MarkdownRenderer: ({ content }: { content: string }) => (
        <div data-testid="markdown-renderer">{content}</div>
    ),
}));

// Mock the AskUserInputResult to actually render its content for testing
vi.mock("@/components/tools/post-response", () => ({
    SuggestQuestionsResult: () => <div data-testid="suggest-questions" />,
    ShowReferencesResult: () => <div data-testid="show-references" />,
    AskUserInputResult: ({
        output,
    }: {
        output?: { question?: string; options?: Array<{ label: string }> };
    }) => (
        <div data-testid="ask-user-input">
            {output?.question && <div>{output.question}</div>}
            {output?.options?.map((opt, i) => (
                <button key={i}>{opt.label}</button>
            ))}
        </div>
    ),
    AcknowledgeResult: () => <div data-testid="acknowledge" />,
}));

// Import the component AFTER mocks are set up
import { AssistantMessage } from "@/components/connection/holo-thread";

describe("AssistantMessage Data Part Integration", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe("data-askUserInput rendering", () => {
        it("renders question and options from data-askUserInput part", () => {
            // This is the exact message structure that was broken before the fix
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "Before we dive in..." },
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "What's your main concern?",
                            options: [
                                { label: "Pain", value: "pain" },
                                { label: "Swelling", value: "swelling" },
                                { label: "Fatigue", value: "fatigue" },
                            ],
                            allowFreeform: true,
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            // The question should be visible
            expect(screen.getByText("What's your main concern?")).toBeInTheDocument();

            // All options should be visible
            expect(screen.getByText("Pain")).toBeInTheDocument();
            expect(screen.getByText("Swelling")).toBeInTheDocument();
            expect(screen.getByText("Fatigue")).toBeInTheDocument();
        });

        it("renders multiple data-askUserInput parts", () => {
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "First question?",
                            options: [{ label: "Option A", value: "a" }],
                        },
                    },
                    {
                        type: "data-askUserInput",
                        id: "ask-2",
                        data: {
                            question: "Second question?",
                            options: [{ label: "Option B", value: "b" }],
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            expect(screen.getByText("First question?")).toBeInTheDocument();
            expect(screen.getByText("Second question?")).toBeInTheDocument();
            expect(screen.getByText("Option A")).toBeInTheDocument();
            expect(screen.getByText("Option B")).toBeInTheDocument();
        });

        it("renders data-askUserInput alongside text content", () => {
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "I have a question for you:" },
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "Which do you prefer?",
                            options: [
                                { label: "Coffee", value: "coffee" },
                                { label: "Tea", value: "tea" },
                            ],
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            // Both text and question should render
            expect(screen.getByText("I have a question for you:")).toBeInTheDocument();
            expect(screen.getByText("Which do you prefer?")).toBeInTheDocument();
        });

        it("renders data-askUserInput in historical messages (non-last)", () => {
            // Historical messages use a different rendering path (fallback)
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "Historical question?",
                            options: [{ label: "Yes", value: "yes" }],
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            render(
                <AssistantMessage
                    message={message}
                    isLast={false} // NOT the last message
                    isStreaming={false}
                />
            );

            expect(screen.getByText("Historical question?")).toBeInTheDocument();
            expect(screen.getByText("Yes")).toBeInTheDocument();
        });
    });

    describe("data part type filtering", () => {
        it("only renders data-askUserInput, ignores other data- types", () => {
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "Should render",
                            options: [{ label: "Yes", value: "yes" }],
                        },
                    },
                    {
                        type: "data-transient",
                        id: "trans-1",
                        data: { text: "Should not render as question" },
                    },
                    {
                        type: "data-someOtherType",
                        id: "other-1",
                        data: { foo: "bar" },
                    },
                ] as unknown as UIMessage["parts"],
            };

            render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            // askUserInput should render
            expect(screen.getByText("Should render")).toBeInTheDocument();

            // Other data types should NOT render as questions
            expect(
                screen.queryByText("Should not render as question")
            ).not.toBeInTheDocument();
        });
    });

    describe("edge cases", () => {
        it("handles empty options array gracefully", () => {
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "Question with no options",
                            options: [],
                            allowFreeform: true,
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            // Should not crash
            const { container } = render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            expect(container).toBeInTheDocument();
            expect(screen.getByText("Question with no options")).toBeInTheDocument();
        });

        it("handles missing options property gracefully", () => {
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "Question without options key",
                            // options intentionally omitted
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            // Should not crash
            const { container } = render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            expect(container).toBeInTheDocument();
            expect(
                screen.getByText("Question without options key")
            ).toBeInTheDocument();
        });

        it("handles malformed data-askUserInput parts", () => {
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            // Missing question property
                            options: [{ label: "Orphan option", value: "orphan" }],
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            // Should not crash even with malformed data
            const { container } = render(
                <AssistantMessage message={message} isLast={true} isStreaming={false} />
            );

            expect(container).toBeInTheDocument();
        });
    });
});
