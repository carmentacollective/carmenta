/**
 * Data-askUserInput Rendering Integration Tests
 *
 * Tests that data-askUserInput parts in messages are correctly rendered
 * as AskUserInputResult components in the chat UI.
 *
 * This test catches the bug where data-* parts were stored in messages
 * but never rendered on the client side.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { UIMessage } from "@ai-sdk/react";

// Mock dependencies
vi.mock("@/lib/client-logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Simple wrapper component that mimics how HoloThread extracts and renders data parts
import { AskUserInputResult } from "@/components/tools/post-response";

// Type for data parts as they appear in messages
interface DataPart {
    type: `data-${string}`;
    id?: string;
    data: Record<string, unknown>;
}

// Helper to check if a part is a data part
function isDataPart(part: unknown): part is DataPart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        typeof (part as { type: unknown }).type === "string" &&
        (part as { type: string }).type.startsWith("data-") &&
        "data" in part
    );
}

// Mock chat context for AskUserInputResult
const mockAppend = vi.fn();
vi.mock("@/components/connection/connect-runtime-provider", () => ({
    useChatContext: () => ({
        append: mockAppend,
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
    useConcierge: () => ({ concierge: null }),
    useModelOverrides: () => ({ overrides: {} }),
    useCodeMode: () => ({ isCodeMode: false }),
}));

describe("Data-askUserInput Rendering", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe("Data Part Extraction", () => {
        it("correctly identifies data-askUserInput parts", () => {
            const parts: unknown[] = [
                { type: "text", text: "Hello" },
                {
                    type: "data-askUserInput",
                    id: "ask-1",
                    data: {
                        question: "What topic?",
                        options: [
                            { label: "Option A", value: "a" },
                            { label: "Option B", value: "b" },
                        ],
                        allowFreeform: true,
                    },
                },
                { type: "tool-webSearch", toolCallId: "tool-1", state: "completed" },
            ];

            const dataParts = parts.filter(isDataPart);
            expect(dataParts).toHaveLength(1);
            expect(dataParts[0].type).toBe("data-askUserInput");
        });

        it("filters askUserInput parts from all data parts", () => {
            const parts: unknown[] = [
                {
                    type: "data-askUserInput",
                    id: "ask-1",
                    data: { question: "Q1?" },
                },
                {
                    type: "data-transient",
                    id: "transient-1",
                    data: { text: "Loading..." },
                },
                {
                    type: "data-askUserInput",
                    id: "ask-2",
                    data: { question: "Q2?" },
                },
            ];

            const dataParts = parts.filter(isDataPart);
            const askUserInputParts = dataParts.filter(
                (p) => p.type === "data-askUserInput"
            );

            expect(askUserInputParts).toHaveLength(2);
        });
    });

    describe("AskUserInputResult Component", () => {
        it("renders question text", () => {
            render(
                <AskUserInputResult
                    toolCallId="ask-1"
                    status="completed"
                    output={{
                        question: "What programming language would you like help with?",
                        allowFreeform: true,
                    }}
                />
            );

            expect(
                screen.getByText("What programming language would you like help with?")
            ).toBeInTheDocument();
        });

        it("renders option buttons when options provided", () => {
            render(
                <AskUserInputResult
                    toolCallId="ask-1"
                    status="completed"
                    output={{
                        question: "Choose a language:",
                        options: [
                            { label: "TypeScript", value: "typescript" },
                            { label: "Python", value: "python" },
                            { label: "Go", value: "go" },
                        ],
                        allowFreeform: false,
                    }}
                />
            );

            expect(screen.getByText("TypeScript")).toBeInTheDocument();
            expect(screen.getByText("Python")).toBeInTheDocument();
            expect(screen.getByText("Go")).toBeInTheDocument();
        });

        it("calls append when option is clicked", () => {
            render(
                <AskUserInputResult
                    toolCallId="ask-1"
                    status="completed"
                    output={{
                        question: "Choose:",
                        options: [{ label: "Option A", value: "option_a" }],
                        allowFreeform: false,
                    }}
                />
            );

            fireEvent.click(screen.getByText("Option A"));

            expect(mockAppend).toHaveBeenCalledWith({
                role: "user",
                content: "option_a",
            });
        });

        it("shows freeform input when allowFreeform is true", () => {
            render(
                <AskUserInputResult
                    toolCallId="ask-1"
                    status="completed"
                    output={{
                        question: "Any other details?",
                        allowFreeform: true,
                    }}
                />
            );

            // Should have a textarea for freeform input
            expect(screen.getByRole("textbox")).toBeInTheDocument();
        });

        it("returns null when status is not completed", () => {
            const { container } = render(
                <AskUserInputResult
                    toolCallId="ask-1"
                    status="running"
                    output={{
                        question: "Question?",
                    }}
                />
            );

            expect(container.firstChild).toBeNull();
        });

        it("returns null when output is missing", () => {
            const { container } = render(
                <AskUserInputResult toolCallId="ask-1" status="completed" />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe("Integration: Message with data-askUserInput", () => {
        it("simulates what HoloThread should do with data-askUserInput parts", () => {
            // This simulates the message structure that would come from the server
            const message: UIMessage = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "Before we dive in, let me ask:" },
                    {
                        type: "data-askUserInput",
                        id: "ask-1",
                        data: {
                            question: "What's your main concern?",
                            options: [
                                { label: "Pain", value: "pain" },
                                { label: "Swelling", value: "swelling" },
                            ],
                            allowFreeform: true,
                        },
                    },
                ] as unknown as UIMessage["parts"],
            };

            // Extract data parts (as HoloThread now does)
            const dataParts = (message.parts as unknown[]).filter(isDataPart);
            const askUserInputParts = dataParts.filter(
                (p) => p.type === "data-askUserInput"
            );

            // Should find the askUserInput part
            expect(askUserInputParts).toHaveLength(1);

            // Render the component (as HoloThread now does)
            render(
                <>
                    {askUserInputParts.map((part, idx) => (
                        <AskUserInputResult
                            key={part.id || `ask-${idx}`}
                            toolCallId={part.id || `ask-${idx}`}
                            status="completed"
                            output={
                                part.data as {
                                    question: string;
                                    options?: Array<{
                                        label: string;
                                        value: string;
                                    }>;
                                    allowFreeform?: boolean;
                                }
                            }
                        />
                    ))}
                </>
            );

            // Should render the question and options
            expect(screen.getByText("What's your main concern?")).toBeInTheDocument();
            expect(screen.getByText("Pain")).toBeInTheDocument();
            expect(screen.getByText("Swelling")).toBeInTheDocument();
        });

        it("renders multiple askUserInput parts", () => {
            const parts: DataPart[] = [
                {
                    type: "data-askUserInput",
                    id: "ask-1",
                    data: {
                        question: "First question?",
                        options: [{ label: "Yes", value: "yes" }],
                    },
                },
                {
                    type: "data-askUserInput",
                    id: "ask-2",
                    data: {
                        question: "Second question?",
                        options: [{ label: "No", value: "no" }],
                    },
                },
            ];

            render(
                <>
                    {parts.map((part, idx) => (
                        <AskUserInputResult
                            key={part.id || `ask-${idx}`}
                            toolCallId={part.id || `ask-${idx}`}
                            status="completed"
                            output={
                                part.data as {
                                    question: string;
                                    options?: Array<{
                                        label: string;
                                        value: string;
                                    }>;
                                }
                            }
                        />
                    ))}
                </>
            );

            expect(screen.getByText("First question?")).toBeInTheDocument();
            expect(screen.getByText("Second question?")).toBeInTheDocument();
            expect(screen.getByText("Yes")).toBeInTheDocument();
            expect(screen.getByText("No")).toBeInTheDocument();
        });
    });
});
