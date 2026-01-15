/**
 * Tests for useForegroundRecovery hook
 *
 * Tests iOS backgrounding recovery logic:
 * - Incomplete conversation detection
 * - Visibility change handling
 * - Server status response handling
 * - Race condition protection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForegroundRecovery } from "@/hooks/use-foreground-recovery";
import { pollBackgroundModeStatus } from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";

// Mock the server action
vi.mock("@/lib/actions/connections", () => ({
    pollBackgroundModeStatus: vi.fn(),
}));

// Mock logger to prevent console noise
vi.mock("@/lib/client-logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Helper to create messages
function createMessage(role: "user" | "assistant", text: string = ""): UIMessageLike {
    return {
        id: `msg-${Math.random()}`,
        role,
        parts: text ? [{ type: "text", text }] : [],
    };
}

// Helper to trigger visibility change
function triggerVisibilityChange(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("useForegroundRecovery", () => {
    const defaultCallbacks = {
        startPolling: vi.fn(),
        onMessagesRecovered: vi.fn(),
        onBackgroundFailed: vi.fn(),
        onStreamInterrupted: vi.fn(),
    };

    let currentUnmount: (() => void) | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Reset visibility state to hidden so first visibility change triggers
        Object.defineProperty(document, "visibilityState", {
            writable: true,
            configurable: true,
            value: "hidden",
        });
    });

    afterEach(() => {
        // Clean up any mounted hook to prevent event listener leaks
        if (currentUnmount) {
            currentUnmount();
            currentUnmount = null;
        }
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    // Helper to render hook and track unmount
    function renderTestHook(props: Parameters<typeof useForegroundRecovery>[0]) {
        const result = renderHook(() => useForegroundRecovery(props));
        currentUnmount = result.unmount;
        return result;
    }

    describe("isConversationIncomplete detection", () => {
        it("triggers recovery when last message is from user", async () => {
            const messages = [createMessage("user", "Hello")];
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "idle",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            // Simulate returning to foreground
            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            // Advance past the 100ms delay
            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).toHaveBeenCalledWith("conn-123");
        });

        it("triggers recovery when assistant message has no content (mid-stream)", async () => {
            // This is the critical bug fix - assistant message exists but is empty
            const messages = [
                createMessage("user", "Hello"),
                createMessage("assistant", ""), // Empty - stream just started
            ];
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "idle",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).toHaveBeenCalled();
        });

        it("triggers recovery when assistant message has very short content", async () => {
            // Less than 10 chars suggests interrupted stream
            const messages = [
                createMessage("user", "Hello"),
                createMessage("assistant", "I'll"), // Only 4 chars
            ];
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "idle",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).toHaveBeenCalled();
        });

        it("skips recovery when assistant message has substantial content", async () => {
            const messages = [
                createMessage("user", "Hello"),
                createMessage("assistant", "Hello! How can I help you today?"),
            ];

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).not.toHaveBeenCalled();
        });

        it("skips recovery for empty message array", async () => {
            renderTestHook({
                connectionId: "conn-123",
                messages: [],
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).not.toHaveBeenCalled();
        });
    });

    describe("guard conditions", () => {
        it("skips recovery when connectionId is null", async () => {
            const messages = [createMessage("user", "Hello")];

            renderTestHook({
                connectionId: null,
                messages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).not.toHaveBeenCalled();
        });

        it("skips recovery when already in background mode", async () => {
            const messages = [createMessage("user", "Hello")];

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: true, // Already polling
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).not.toHaveBeenCalled();
        });

        it("skips recovery when isLoading is true", async () => {
            const messages = [createMessage("user", "Hello")];

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: false,
                isLoading: true, // Actively streaming
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(150);
            });

            expect(pollBackgroundModeStatus).not.toHaveBeenCalled();
        });
    });

    describe("server status handling", () => {
        const incompleteMessages = [createMessage("user", "Hello")];

        it("starts polling when server is still streaming", async () => {
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "streaming",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages: incompleteMessages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            // Use advanceTimersByTimeAsync to flush both timers and Promise microtasks
            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            expect(defaultCallbacks.startPolling).toHaveBeenCalledWith("conn-123");
        });

        it("recovers messages when server completed", async () => {
            const recoveredMessages = [
                createMessage("user", "Hello"),
                createMessage("assistant", "Hi there! How can I help?"),
            ];

            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "completed",
                messages: recoveredMessages,
                title: "New Chat",
                slug: "new-chat",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages: incompleteMessages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            expect(defaultCallbacks.onMessagesRecovered).toHaveBeenCalledWith(
                recoveredMessages,
                "New Chat",
                "new-chat"
            );
        });

        it("calls onBackgroundFailed when server failed", async () => {
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "failed",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages: incompleteMessages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            // Should pass partial messages (null in this case) to callback
            expect(defaultCallbacks.onBackgroundFailed).toHaveBeenCalledWith(null);
        });

        it("passes partial messages to onBackgroundFailed when available", async () => {
            const partialMessages = [
                {
                    id: "1",
                    role: "user" as const,
                    parts: [{ type: "text" as const, text: "Hello" }],
                },
                {
                    id: "2",
                    role: "assistant" as const,
                    parts: [{ type: "text" as const, text: "Partial response..." }],
                },
            ];

            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "failed",
                messages: partialMessages,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages: incompleteMessages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            // Should pass partial messages so caller can preserve them
            expect(defaultCallbacks.onBackgroundFailed).toHaveBeenCalledWith(
                partialMessages
            );
        });

        it("calls onStreamInterrupted when server is idle", async () => {
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "idle",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages: incompleteMessages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                await vi.advanceTimersByTimeAsync(150);
            });

            expect(defaultCallbacks.onStreamInterrupted).toHaveBeenCalled();
        });
    });

    describe("race condition protection", () => {
        it("discards stale results when connectionId changes during poll", async () => {
            const messages = [createMessage("user", "Hello")];

            // Slow poll that takes time
            vi.mocked(pollBackgroundModeStatus).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    status: "completed",
                                    messages: [
                                        createMessage(
                                            "assistant",
                                            "Response for old connection"
                                        ),
                                    ],
                                    title: "Old",
                                    slug: "old",
                                }),
                            200
                        )
                    )
            );

            const { rerender, unmount } = renderHook(
                ({ connectionId }) =>
                    useForegroundRecovery({
                        connectionId,
                        messages,
                        isBackgroundMode: false,
                        isLoading: false,
                        ...defaultCallbacks,
                    }),
                { initialProps: { connectionId: "conn-old" } }
            );
            // Track for cleanup
            currentUnmount = unmount;

            // Trigger recovery
            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(100); // Past the 100ms delay, poll starts
            });

            // Change connectionId while poll is in flight
            rerender({ connectionId: "conn-new" });

            await act(async () => {
                vi.advanceTimersByTime(200); // Poll completes
            });

            // Callback should NOT have been called with stale data
            expect(defaultCallbacks.onMessagesRecovered).not.toHaveBeenCalled();
        });
    });

    describe("visibility change debouncing", () => {
        it("only triggers one recovery for rapid visibility changes", async () => {
            const messages = [createMessage("user", "Hello")];
            vi.mocked(pollBackgroundModeStatus).mockResolvedValue({
                status: "idle",
                messages: null,
                title: null,
                slug: "test",
            });

            renderTestHook({
                connectionId: "conn-123",
                messages,
                isBackgroundMode: false,
                isLoading: false,
                ...defaultCallbacks,
            });

            // Rapid tab switching
            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");
            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");
            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            await act(async () => {
                vi.advanceTimersByTime(500);
            });

            // Should only poll once despite multiple visibility changes
            expect(pollBackgroundModeStatus).toHaveBeenCalledTimes(1);
        });
    });

    describe("cleanup", () => {
        it("clears timeout on unmount", async () => {
            const messages = [createMessage("user", "Hello")];

            const { unmount } = renderHook(() =>
                useForegroundRecovery({
                    connectionId: "conn-123",
                    messages,
                    isBackgroundMode: false,
                    isLoading: false,
                    ...defaultCallbacks,
                })
            );
            // Clear global tracker since this test explicitly handles unmount
            currentUnmount = null;

            // Trigger visibility change but don't wait for timeout
            triggerVisibilityChange("hidden");
            triggerVisibilityChange("visible");

            // Unmount before timeout fires
            unmount();

            await act(async () => {
                vi.advanceTimersByTime(200);
            });

            // Poll should NOT have been called (cleanup cleared timeout)
            expect(pollBackgroundModeStatus).not.toHaveBeenCalled();
        });
    });
});
