/**
 * useOAuthFlowRecovery Hook Tests
 *
 * Tests OAuth flow recovery detection and state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOAuthFlowRecovery } from "@/lib/hooks/use-oauth-flow-recovery";

// Mock the services module
vi.mock("@/lib/integrations/services", () => ({
    getServiceById: vi.fn((id: string) => {
        const services: Record<string, { name: string }> = {
            notion: { name: "Notion" },
            slack: { name: "Slack" },
            dropbox: { name: "Dropbox" },
        };
        return services[id] ?? null;
    }),
}));

const OAUTH_PENDING_KEY = "carmenta:oauth_pending";

describe("useOAuthFlowRecovery", () => {
    beforeEach(() => {
        // Clear sessionStorage before each test
        sessionStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe("initial state", () => {
        it("should return null when no pending OAuth in sessionStorage", () => {
            const { result } = renderHook(() => useOAuthFlowRecovery());

            expect(result.current.abandonedService).toBeNull();
            expect(result.current.abandonedServiceName).toBeNull();
        });

        it("should detect abandoned OAuth flow from sessionStorage on mount", async () => {
            // Set up an OAuth attempt that started 5 seconds ago
            const pendingState = {
                service: "notion",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedService).toBe("notion");
            expect(result.current.abandonedServiceName).toBe("Notion");
        });

        it("should not detect OAuth flow that is too recent (< 2 seconds)", () => {
            // Set up an OAuth attempt that started 1 second ago
            const pendingState = {
                service: "notion",
                startedAt: Date.now() - 1000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            expect(result.current.abandonedService).toBeNull();
        });

        it("should handle invalid JSON in sessionStorage gracefully", async () => {
            sessionStorage.setItem(OAUTH_PENDING_KEY, "invalid json{");

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedService).toBeNull();
            // Should have cleaned up the invalid state
            expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
        });
    });

    describe("markOAuthStarted", () => {
        it("should store OAuth attempt in sessionStorage", () => {
            const { result } = renderHook(() => useOAuthFlowRecovery());

            act(() => {
                result.current.markOAuthStarted("notion");
            });

            const stored = sessionStorage.getItem(OAUTH_PENDING_KEY);
            expect(stored).not.toBeNull();

            const parsed = JSON.parse(stored!);
            expect(parsed.service).toBe("notion");
            expect(typeof parsed.startedAt).toBe("number");
        });

        it("should clear any existing abandoned state", async () => {
            // Set up an existing abandoned flow
            const pendingState = {
                service: "slack",
                startedAt: Date.now() - 10000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedService).toBe("slack");

            act(() => {
                result.current.markOAuthStarted("notion");
            });

            expect(result.current.abandonedService).toBeNull();
        });
    });

    describe("markOAuthComplete", () => {
        it("should clear sessionStorage", async () => {
            const pendingState = {
                service: "notion",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedService).toBe("notion");

            act(() => {
                result.current.markOAuthComplete();
            });

            expect(result.current.abandonedService).toBeNull();
            expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
        });
    });

    describe("dismissRecovery", () => {
        it("should clear abandoned state and sessionStorage", async () => {
            const pendingState = {
                service: "notion",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedService).toBe("notion");

            act(() => {
                result.current.dismissRecovery();
            });

            expect(result.current.abandonedService).toBeNull();
            expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
        });
    });

    describe("retryOAuth", () => {
        it("should update sessionStorage with new attempt timestamp", () => {
            const pendingState = {
                service: "notion",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            // Mock window.location.href using defineProperty
            let capturedHref = "";
            const originalDescriptor = Object.getOwnPropertyDescriptor(
                window,
                "location"
            );
            Object.defineProperty(window, "location", {
                value: {
                    ...window.location,
                    get href() {
                        return capturedHref;
                    },
                    set href(value: string) {
                        capturedHref = value;
                    },
                },
                writable: true,
            });

            const { result } = renderHook(() => useOAuthFlowRecovery());

            act(() => {
                result.current.retryOAuth();
            });

            // Should have updated sessionStorage with new timestamp
            const stored = sessionStorage.getItem(OAUTH_PENDING_KEY);
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.service).toBe("notion");

            // Should have redirected
            expect(capturedHref).toBe("/connect/notion");

            // Restore
            if (originalDescriptor) {
                Object.defineProperty(window, "location", originalDescriptor);
            }
        });

        it("should do nothing if no abandoned service", () => {
            // Track if href was set
            let hrefWasSet = false;
            const originalDescriptor = Object.getOwnPropertyDescriptor(
                window,
                "location"
            );
            Object.defineProperty(window, "location", {
                value: {
                    ...window.location,
                    set href(_value: string) {
                        hrefWasSet = true;
                    },
                },
                writable: true,
            });

            const { result } = renderHook(() => useOAuthFlowRecovery());

            act(() => {
                result.current.retryOAuth();
            });

            expect(hrefWasSet).toBe(false);

            // Restore
            if (originalDescriptor) {
                Object.defineProperty(window, "location", originalDescriptor);
            }
        });
    });

    describe("focus/visibility detection", () => {
        it("should re-check sessionStorage when window gains focus", async () => {
            const { result } = renderHook(() => useOAuthFlowRecovery());

            expect(result.current.abandonedService).toBeNull();

            // Simulate OAuth flow started externally (e.g., in another tab scenario)
            const pendingState = {
                service: "dropbox",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            // Trigger focus event
            act(() => {
                window.dispatchEvent(new Event("focus"));
            });

            // Wait for the setTimeout (300ms)
            await act(async () => {
                vi.advanceTimersByTime(300);
            });

            expect(result.current.abandonedService).toBe("dropbox");
            expect(result.current.abandonedServiceName).toBe("Dropbox");
        });

        it("should re-check sessionStorage when page becomes visible", async () => {
            const { result } = renderHook(() => useOAuthFlowRecovery());

            expect(result.current.abandonedService).toBeNull();

            // Simulate OAuth flow started
            const pendingState = {
                service: "slack",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            // Simulate visibility change
            Object.defineProperty(document, "visibilityState", {
                value: "visible",
                writable: true,
            });

            act(() => {
                document.dispatchEvent(new Event("visibilitychange"));
            });

            // Wait for the setTimeout (300ms)
            await act(async () => {
                vi.advanceTimersByTime(300);
            });

            expect(result.current.abandonedService).toBe("slack");
        });
    });

    describe("cleanup", () => {
        it("should remove event listeners on unmount", () => {
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
            const removeDocEventListenerSpy = vi.spyOn(document, "removeEventListener");

            const { unmount } = renderHook(() => useOAuthFlowRecovery());

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                "focus",
                expect.any(Function)
            );
            expect(removeDocEventListenerSpy).toHaveBeenCalledWith(
                "visibilitychange",
                expect.any(Function)
            );

            removeEventListenerSpy.mockRestore();
            removeDocEventListenerSpy.mockRestore();
        });
    });

    describe("service name resolution", () => {
        it("should resolve known service IDs to display names", async () => {
            const pendingState = {
                service: "notion",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedServiceName).toBe("Notion");
        });

        it("should fall back to service ID for unknown services", async () => {
            const pendingState = {
                service: "unknown-service",
                startedAt: Date.now() - 5000,
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pendingState));

            const { result } = renderHook(() => useOAuthFlowRecovery());

            // Flush the useEffect that checks storage on mount
            await act(async () => {});

            expect(result.current.abandonedServiceName).toBe("unknown-service");
        });
    });
});
