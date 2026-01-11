/**
 * Tests for usePushNotifications hook
 *
 * Tests iOS detection, permission states, subscription flows,
 * and the various scenarios users encounter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

// Mock env module
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-vapid-key-base64url",
    },
}));

/**
 * Helper to set up browser environment for push notification tests
 */
function setupBrowserEnvironment(options: {
    userAgent: string;
    permission?: NotificationPermission;
    isStandalone?: boolean;
    hasServiceWorker?: boolean;
    hasPushManager?: boolean;
    pushManagerMock?: object;
}) {
    const {
        userAgent,
        permission = "default",
        isStandalone = false,
        hasServiceWorker = true,
        hasPushManager = true,
        pushManagerMock = { getSubscription: () => Promise.resolve(null) },
    } = options;

    // Create Notification mock
    const NotificationMock = {
        permission,
        requestPermission: vi.fn().mockResolvedValue(permission),
    };

    // Set global Notification (used by Notification.permission)
    vi.stubGlobal("Notification", NotificationMock);

    // Set up navigator
    const navigatorMock: Record<string, unknown> = {
        userAgent,
    };
    if (hasServiceWorker) {
        navigatorMock.serviceWorker = {
            ready: Promise.resolve({ pushManager: pushManagerMock }),
        };
    }
    // iOS standalone check
    if (isStandalone && userAgent.includes("iPhone")) {
        navigatorMock.standalone = true;
    }
    vi.stubGlobal("navigator", navigatorMock);

    // Set up window - MUST include navigator for window.navigator.standalone check
    const windowMock: Record<string, unknown> = {
        Notification: NotificationMock,
        navigator: navigatorMock,
        matchMedia: () => ({ matches: isStandalone }),
        atob: (str: string) => Buffer.from(str, "base64").toString("binary"),
    };
    if (hasPushManager) {
        windowMock.PushManager = {};
    }
    vi.stubGlobal("window", windowMock);

    return { NotificationMock };
}

describe("usePushNotifications", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("iOS version detection", () => {
        it.each([
            ["iPhone iOS 18.0", "CPU iPhone OS 18_0 like Mac OS X", true, 18.0],
            ["iPhone iOS 17.0", "CPU iPhone OS 17_0 like Mac OS X", true, 17.0],
            ["iPhone iOS 16.4", "CPU iPhone OS 16_4 like Mac OS X", true, 16.4],
            ["iPhone iOS 16.3", "CPU iPhone OS 16_3 like Mac OS X", false, 16.3],
            ["iPad iOS 15.0", "CPU OS 15_0 like Mac OS X", false, 15.0],
            ["iPhone iOS 16.0", "CPU iPhone OS 16_0 like Mac OS X", false, 16.0],
        ])(
            "%s meets requirement: %s",
            async (_name, userAgent, meetsRequirement, expectedVersion) => {
                setupBrowserEnvironment({
                    userAgent: `Mozilla/5.0 (iPhone; ${userAgent}) AppleWebKit/605.1.15`,
                });

                const { usePushNotifications } =
                    await import("@/lib/hooks/use-push-notifications");
                const { result } = renderHook(() => usePushNotifications());

                expect(result.current.deviceInfo.isIOS).toBe(true);
                expect(result.current.deviceInfo.iosVersion).toBe(expectedVersion);
                expect(result.current.deviceInfo.meetsIOSRequirement).toBe(
                    meetsRequirement
                );
            }
        );

        it("non-iOS device meets requirement by default", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.deviceInfo.isIOS).toBe(false);
            expect(result.current.deviceInfo.iosVersion).toBe(null);
            expect(result.current.deviceInfo.meetsIOSRequirement).toBe(true);
        });
    });

    describe("canSubscribe logic", () => {
        it("returns false when iOS version too old", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
                isStandalone: true,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.canSubscribe).toBe(false);
            expect(result.current.unavailableReason).toContain("iOS 15");
            expect(result.current.unavailableReason).toContain("16.4");
        });

        it("returns false when not in standalone mode on iOS", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
                isStandalone: false,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.canSubscribe).toBe(false);
            expect(result.current.unavailableReason).toContain("Home Screen");
        });

        it("returns false when permission denied", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
                isStandalone: true,
                permission: "denied",
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.canSubscribe).toBe(false);
            expect(result.current.unavailableReason).toContain("denied");
            expect(result.current.unavailableReason).toContain("Settings");
        });

        it("returns true when all requirements met", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
                isStandalone: true,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.canSubscribe).toBe(true);
            expect(result.current.unavailableReason).toBe(null);
        });
    });

    describe("unavailableReason messages", () => {
        it("prioritizes iOS version over standalone mode", async () => {
            // iOS too old AND not standalone - should show iOS version message first
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
                isStandalone: false,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.unavailableReason).toContain("iOS 15");
        });

        it("shows install message for non-iOS devices not in standalone", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (Windows NT 10.0)",
                isStandalone: false,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.unavailableReason).toContain("Install Carmenta");
        });
    });

    describe("subscribe flow", () => {
        it("cleans up browser subscription if server sync fails", async () => {
            const unsubscribeMock = vi.fn().mockResolvedValue(true);
            const subscribeMock = vi.fn().mockResolvedValue({
                endpoint: "https://push.example.com/123",
                toJSON: () => ({ endpoint: "https://push.example.com/123" }),
                unsubscribe: unsubscribeMock,
            });

            // Create Notification mock with requestPermission
            const NotificationMock = {
                permission: "default" as const,
                requestPermission: vi.fn().mockResolvedValue("granted"),
            };
            vi.stubGlobal("Notification", NotificationMock);

            const navigatorMock = {
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
                serviceWorker: {
                    ready: Promise.resolve({
                        pushManager: {
                            getSubscription: () => Promise.resolve(null),
                            subscribe: subscribeMock,
                        },
                    }),
                },
                standalone: true,
            };
            vi.stubGlobal("navigator", navigatorMock);

            vi.stubGlobal("window", {
                Notification: NotificationMock,
                navigator: navigatorMock,
                PushManager: {},
                matchMedia: () => ({ matches: true }),
                atob: (str: string) => Buffer.from(str, "base64").toString("binary"),
            });

            // Mock fetch to fail
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: "Server error" }),
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            await act(async () => {
                await result.current.subscribe();
            });

            // Should have called unsubscribe to clean up
            expect(unsubscribeMock).toHaveBeenCalled();
            expect(result.current.error).toContain("Server error");
        });
    });

    describe("unsubscribe flow", () => {
        it("succeeds even if server request fails", async () => {
            const unsubscribeMock = vi.fn().mockResolvedValue(true);
            const mockSubscription = {
                endpoint: "https://push.example.com/123",
                unsubscribe: unsubscribeMock,
            };

            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
                isStandalone: true,
                permission: "granted",
                pushManagerMock: {
                    getSubscription: () => Promise.resolve(mockSubscription),
                },
            });

            // Mock fetch to fail
            const consoleWarnSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                text: () => Promise.resolve("Server error"),
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            let success: boolean;
            await act(async () => {
                success = await result.current.unsubscribe();
            });

            // Local unsubscribe should succeed
            expect(unsubscribeMock).toHaveBeenCalled();
            expect(success!).toBe(true);
            expect(result.current.isSubscribed).toBe(false);
            // Should have logged warning
            expect(consoleWarnSpy).toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });
    });

    describe("permission states", () => {
        it.each([
            ["default", "default" as const],
            ["granted", "granted" as const],
            ["denied", "denied" as const],
        ])("reflects %s permission state", async (_name, permission) => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (Windows NT 10.0)",
                permission,
                isStandalone: true,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.permission).toBe(permission);
        });
    });

    describe("browser support detection", () => {
        it("returns unsupported when serviceWorker missing", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (Windows NT 10.0)",
                hasServiceWorker: false,
                isStandalone: true,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.isSupported).toBe(false);
            expect(result.current.unavailableReason).toContain("aren't supported");
        });

        it("returns unsupported when PushManager missing", async () => {
            setupBrowserEnvironment({
                userAgent: "Mozilla/5.0 (Windows NT 10.0)",
                hasPushManager: false,
                isStandalone: true,
            });

            const { usePushNotifications } =
                await import("@/lib/hooks/use-push-notifications");
            const { result } = renderHook(() => usePushNotifications());

            expect(result.current.isSupported).toBe(false);
        });
    });
});
