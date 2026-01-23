/**
 * Tests for useDraftPersistence hook
 *
 * Tests draft saving and recovery:
 * - Debounced saving to localStorage
 * - Draft recovery on mount
 * - Clearing draft on send
 * - Connection ID changes (critical bug fix)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftPersistence } from "@/lib/hooks/use-draft-persistence";

// Mock logger to prevent console noise
vi.mock("@/lib/client-logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
}));

describe("useDraftPersistence", () => {
    let mockSetInput: ReturnType<typeof vi.fn<(value: string) => void>>;
    let localStorageMock: Record<string, string>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockSetInput = vi.fn();
        localStorageMock = {};

        // Mock localStorage
        Object.defineProperty(window, "localStorage", {
            value: {
                getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
                setItem: vi.fn((key: string, value: string) => {
                    localStorageMock[key] = value;
                }),
                removeItem: vi.fn((key: string) => {
                    delete localStorageMock[key];
                }),
            },
            writable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("draft recovery", () => {
        it("restores saved draft on mount", () => {
            localStorageMock["carmenta:draft:conn-123"] = "saved draft text";

            renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "",
                    setInput: mockSetInput,
                })
            );

            expect(mockSetInput).toHaveBeenCalledWith("saved draft text");
        });

        it("shows recovery banner when draft is restored", async () => {
            localStorageMock["carmenta:draft:conn-123"] = "saved draft text";

            const { result } = renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "",
                    setInput: mockSetInput,
                })
            );

            // Wait for microtask
            await act(async () => {
                await Promise.resolve();
            });

            expect(result.current.hasRecoveredDraft).toBe(true);
        });
    });

    describe("draft saving", () => {
        it("saves draft to localStorage after debounce", () => {
            renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "typed text here",
                    setInput: mockSetInput,
                })
            );

            // Fast-forward past debounce (150ms)
            act(() => {
                vi.advanceTimersByTime(200);
            });

            expect(localStorage.setItem).toHaveBeenCalledWith(
                "carmenta:draft:conn-123",
                "typed text here"
            );
        });

        it("clears draft from localStorage on send", () => {
            localStorageMock["carmenta:draft:conn-123"] = "draft to clear";

            const { result } = renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "",
                    setInput: mockSetInput,
                })
            );

            act(() => {
                result.current.onMessageSent();
            });

            expect(localStorage.removeItem).toHaveBeenCalledWith(
                "carmenta:draft:conn-123"
            );
        });
    });

    describe("connection ID changes", () => {
        /**
         * BUG FIX TEST: Issue #856, #857
         *
         * When a NEW connection is created:
         * 1. User starts typing with connectionId = null (effectiveKey = "new")
         * 2. User sends message
         * 3. Server creates connection, returns real ID
         * 4. connectionId changes from null to "conn-xyz"
         * 5. User has already started typing their next message
         *
         * BEFORE FIX: Draft persistence would call setInput("") because no
         * draft exists for the new connection ID, ERASING what user typed.
         *
         * AFTER FIX: Draft persistence should NOT clear input when connection
         * ID changes - it should only restore if a draft exists, otherwise
         * leave the input alone.
         */
        it("does NOT clear input when connection ID changes from null to real ID", () => {
            // Start with null connectionId (new conversation)
            const { rerender } = renderHook<
                ReturnType<typeof useDraftPersistence>,
                { connectionId: string | null; input: string }
            >(
                ({ connectionId, input }) =>
                    useDraftPersistence({
                        connectionId,
                        input,
                        setInput: mockSetInput,
                    }),
                {
                    initialProps: { connectionId: null, input: "" },
                }
            );

            // Clear the initial mount call
            mockSetInput.mockClear();

            // User types something
            rerender({ connectionId: null, input: "I'm typing a follow-up" });

            // Wait for any effects
            act(() => {
                vi.advanceTimersByTime(200);
            });

            // Connection ID changes (server created the connection)
            rerender({ connectionId: "conn-xyz", input: "I'm typing a follow-up" });

            // Wait for effects
            act(() => {
                vi.advanceTimersByTime(200);
            });

            // CRITICAL: setInput should NOT have been called with ""
            // This was the bug - draft persistence was clearing the input
            const setInputCalls = mockSetInput.mock.calls;
            const clearCalls = setInputCalls.filter((call: string[]) => call[0] === "");

            expect(clearCalls.length).toBe(0);
        });

        it("restores draft when switching to connection that has a saved draft", () => {
            // Save a draft for connection B
            localStorageMock["carmenta:draft:conn-b"] = "draft for connection B";

            // Start with connection A
            const { rerender } = renderHook(
                ({ connectionId }: { connectionId: string }) =>
                    useDraftPersistence({
                        connectionId,
                        input: "",
                        setInput: mockSetInput,
                    }),
                {
                    initialProps: { connectionId: "conn-a" },
                }
            );

            // Clear mount calls
            mockSetInput.mockClear();

            // Switch to connection B (which has a draft)
            rerender({ connectionId: "conn-b" });

            // The draft should be restored
            expect(mockSetInput).toHaveBeenCalledWith("draft for connection B");
        });

        it("clears input when switching between connections with no draft", () => {
            // Start with connection A and some typed text
            const { rerender } = renderHook<
                ReturnType<typeof useDraftPersistence>,
                { connectionId: string; input: string }
            >(
                ({ connectionId, input }) =>
                    useDraftPersistence({
                        connectionId,
                        input,
                        setInput: mockSetInput,
                    }),
                {
                    initialProps: { connectionId: "conn-a", input: "message for A" },
                }
            );

            // Clear mount calls
            mockSetInput.mockClear();

            // Switch to connection B (no draft saved)
            rerender({ connectionId: "conn-b", input: "message for A" });

            // Input should be cleared to prevent message leakage between conversations
            expect(mockSetInput).toHaveBeenCalledWith("");
        });
    });

    describe("draft length threshold", () => {
        it("does not save drafts shorter than 3 characters", () => {
            renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "ab", // 2 chars - below MIN_DRAFT_LENGTH
                    setInput: mockSetInput,
                })
            );

            act(() => {
                vi.advanceTimersByTime(200);
            });

            // Should remove, not save
            expect(localStorage.setItem).not.toHaveBeenCalled();
            expect(localStorage.removeItem).toHaveBeenCalledWith(
                "carmenta:draft:conn-123"
            );
        });

        it("does not restore drafts shorter than 3 characters", () => {
            localStorageMock["carmenta:draft:conn-123"] = "ab"; // Below threshold

            renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "",
                    setInput: mockSetInput,
                })
            );

            // setInput should NOT be called with the short draft
            expect(mockSetInput).not.toHaveBeenCalledWith("ab");
        });
    });

    describe("saveImmediately", () => {
        it("saves immediately without waiting for debounce", () => {
            const { result } = renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "urgent text to save",
                    setInput: mockSetInput,
                })
            );

            // Call saveImmediately before debounce fires
            act(() => {
                result.current.saveImmediately();
            });

            // Should save immediately
            expect(localStorage.setItem).toHaveBeenCalledWith(
                "carmenta:draft:conn-123",
                "urgent text to save"
            );
        });
    });

    describe("clearDraft", () => {
        it("clears both input and localStorage when called", async () => {
            localStorageMock["carmenta:draft:conn-123"] = "recovered draft";

            const { result } = renderHook(() =>
                useDraftPersistence({
                    connectionId: "conn-123",
                    input: "recovered draft",
                    setInput: mockSetInput,
                })
            );

            // Wait for recovery banner to show
            await act(async () => {
                await Promise.resolve();
            });

            // Clear the restore call
            mockSetInput.mockClear();

            act(() => {
                result.current.clearDraft();
            });

            expect(mockSetInput).toHaveBeenCalledWith("");
            expect(localStorage.removeItem).toHaveBeenCalledWith(
                "carmenta:draft:conn-123"
            );
            expect(result.current.hasRecoveredDraft).toBe(false);
        });
    });

    describe("null connectionId fallback", () => {
        it("uses 'new' key when connectionId is null", () => {
            renderHook(() =>
                useDraftPersistence({
                    connectionId: null,
                    input: "typing in new conversation",
                    setInput: mockSetInput,
                })
            );

            act(() => {
                vi.advanceTimersByTime(200);
            });

            // Should save under "new" key
            expect(localStorage.setItem).toHaveBeenCalledWith(
                "carmenta:draft:new",
                "typing in new conversation"
            );
        });
    });

    describe("error handling", () => {
        it("handles localStorage.setItem throwing gracefully", () => {
            const setItemSpy = vi.spyOn(localStorage, "setItem");
            setItemSpy.mockImplementation(() => {
                throw new Error("QuotaExceededError");
            });

            // Should not throw
            expect(() => {
                renderHook(() =>
                    useDraftPersistence({
                        connectionId: "conn-123",
                        input: "some text here",
                        setInput: mockSetInput,
                    })
                );
                act(() => {
                    vi.advanceTimersByTime(200);
                });
            }).not.toThrow();

            setItemSpy.mockRestore();
        });
    });
});
