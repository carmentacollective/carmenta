/**
 * ConnectRuntimeProvider Tests
 *
 * Tests chat message state management, specifically:
 * - Messages persist during new chat sessions (no premature clearing)
 * - Messages sync correctly when navigating between connections
 * - Messages clear only when navigating FROM an existing connection TO /new
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock dependencies before importing the component
const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockUseChat = vi.fn();

vi.mock("@ai-sdk/react", () => ({
    useChat: () => mockUseChat(),
}));

vi.mock("ai", () => ({
    DefaultChatTransport: class MockTransport {
        constructor() {
            // Mock transport
        }
    },
}));

vi.mock("@/lib/client-logger", () => ({
    logger: {
        error: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock("@/lib/concierge/context", () => ({
    ConciergeProvider: ({ children }: { children: ReactNode }) => children,
    useConcierge: () => ({ concierge: null, setConcierge: vi.fn() }),
    parseConciergeHeaders: vi.fn(),
}));

const mockConnectionContext = {
    activeConnectionId: null as string | null,
    initialMessages: [] as unknown[],
    addNewConnection: vi.fn(),
    setIsStreaming: vi.fn(),
};

vi.mock("@/components/connection/connection-context", () => ({
    useConnection: () => mockConnectionContext,
}));

// Import after mocks are set up
import {
    useChatContext,
    ConnectRuntimeProvider,
} from "@/components/connection/connect-runtime-provider";

describe("ConnectRuntimeProvider", () => {
    const createMockUseChatReturn = (overrides = {}) => ({
        messages: [],
        setMessages: mockSetMessages,
        sendMessage: mockSendMessage,
        regenerate: vi.fn(),
        stop: vi.fn(),
        status: "ready" as const,
        error: null,
        clearError: vi.fn(),
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectionContext.activeConnectionId = null;
        mockConnectionContext.initialMessages = [];
        mockUseChat.mockReturnValue(createMockUseChatReturn());
    });

    afterEach(() => {
        cleanup();
    });

    describe("Message State on New Chat", () => {
        it("does NOT clear messages when activeConnectionId is null on mount", () => {
            // Simulate a new chat page where activeConnectionId is null
            mockConnectionContext.activeConnectionId = null;

            render(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // setMessages should NOT be called with [] on mount for new chats
            // The old buggy behavior would call setMessages([]) immediately
            expect(mockSetMessages).not.toHaveBeenCalledWith([]);
        });

        it("preserves messages during active chat session on /new page", async () => {
            // Start with null activeConnectionId (new chat page)
            mockConnectionContext.activeConnectionId = null;

            // Simulate messages being added by useChat during streaming
            const messagesAfterSend = [
                { id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] },
                {
                    id: "2",
                    role: "assistant",
                    parts: [{ type: "text", text: "Hi there!" }],
                },
            ];

            mockUseChat.mockReturnValue(
                createMockUseChatReturn({ messages: messagesAfterSend })
            );

            const { rerender } = render(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // Rerender to simulate state update after message send
            rerender(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // Messages should NOT be cleared - the bug was that setMessages([])
            // was called on every render where activeConnectionId was null
            expect(mockSetMessages).not.toHaveBeenCalledWith([]);
        });
    });

    describe("Message State When Navigating Between Connections", () => {
        it("clears messages when navigating FROM existing connection TO /new", () => {
            // Start with an existing connection
            mockConnectionContext.activeConnectionId = "conn-123";
            mockConnectionContext.initialMessages = [
                {
                    id: "1",
                    role: "user",
                    parts: [{ type: "text", text: "Old message" }],
                },
            ];

            const { rerender } = render(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // Simulate navigation to /new (activeConnectionId becomes null)
            mockConnectionContext.activeConnectionId = null;
            mockConnectionContext.initialMessages = [];

            rerender(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // Messages SHOULD be cleared when transitioning from existing to new
            expect(mockSetMessages).toHaveBeenCalledWith([]);
        });

        it("syncs messages when navigating TO existing connection with messages", () => {
            // Start on /new page
            mockConnectionContext.activeConnectionId = null;

            const { rerender } = render(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // Simulate navigation to an existing connection
            const existingMessages = [
                { id: "1", role: "user", parts: [{ type: "text", text: "Existing" }] },
            ];
            mockConnectionContext.activeConnectionId = "conn-456";
            mockConnectionContext.initialMessages = existingMessages;

            rerender(
                <ConnectRuntimeProvider>
                    <div>Test Child</div>
                </ConnectRuntimeProvider>
            );

            // Messages should be synced to the existing connection's messages
            expect(mockSetMessages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: "1", role: "user" }),
                ])
            );
        });
    });
});
