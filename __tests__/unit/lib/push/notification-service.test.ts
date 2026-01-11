/**
 * Tests for Push Notification Service
 *
 * Tests VAPID configuration, notification sending, and subscription cleanup.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_opts, fn) => fn({ setAttribute: vi.fn(), setStatus: vi.fn() })),
    captureException: vi.fn(),
}));

vi.mock("web-push", () => ({
    default: {
        setVapidDetails: vi.fn(),
        sendNotification: vi.fn(),
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(() => ({
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })),
    },
}));

vi.mock("@/lib/db/push-subscriptions", () => ({
    getActiveSubscriptions: vi.fn(),
    deactivateSubscription: vi.fn(),
}));

describe("Push Notification Service", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("isPushConfigured", () => {
        it("returns false when VAPID keys are missing", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: undefined,
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined,
                    VAPID_SUBJECT_EMAIL: undefined,
                },
            }));

            const { isPushConfigured } =
                await import("@/lib/push/notification-service");

            expect(isPushConfigured()).toBe(false);
        });

        it("returns false when only partial VAPID keys are set", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined, // Missing
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { isPushConfigured } =
                await import("@/lib/push/notification-service");

            expect(isPushConfigured()).toBe(false);
        });

        it("returns true when all VAPID keys are set", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { isPushConfigured } =
                await import("@/lib/push/notification-service");

            expect(isPushConfigured()).toBe(true);
        });
    });

    describe("sendPushNotification", () => {
        it("returns error when VAPID not configured", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: undefined,
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined,
                    VAPID_SUBJECT_EMAIL: undefined,
                },
            }));

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("VAPID");
            expect(result.devicesNotified).toBe(0);
        });

        it("returns error when user has no subscriptions", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([]);

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("No active push subscriptions");
            expect(result.totalSubscriptions).toBe(0);
        });

        it("sends notification to all subscriptions", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([
                {
                    endpoint: "https://push1.example.com",
                    subscription: { endpoint: "https://push1.example.com" },
                },
                {
                    endpoint: "https://push2.example.com",
                    subscription: { endpoint: "https://push2.example.com" },
                },
            ] as never);

            const webpush = (await import("web-push")).default;
            vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(result.success).toBe(true);
            expect(result.devicesNotified).toBe(2);
            expect(result.totalSubscriptions).toBe(2);
            expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
        });

        it("deactivates subscription on 410 Gone", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions, deactivateSubscription } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([
                {
                    endpoint: "https://expired.push.example.com",
                    subscription: { endpoint: "https://expired.push.example.com" },
                },
            ] as never);
            vi.mocked(deactivateSubscription).mockResolvedValue(null);

            const webpush = (await import("web-push")).default;
            const error = new Error("Gone") as Error & { statusCode: number };
            error.statusCode = 410;
            vi.mocked(webpush.sendNotification).mockRejectedValue(error);

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(result.success).toBe(false);
            expect(result.devicesNotified).toBe(0);
            expect(deactivateSubscription).toHaveBeenCalledWith(
                "https://expired.push.example.com"
            );
        });

        it("deactivates subscription on 404 Not Found", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions, deactivateSubscription } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([
                {
                    endpoint: "https://notfound.push.example.com",
                    subscription: { endpoint: "https://notfound.push.example.com" },
                },
            ] as never);
            vi.mocked(deactivateSubscription).mockResolvedValue(null);

            const webpush = (await import("web-push")).default;
            const error = new Error("Not Found") as Error & { statusCode: number };
            error.statusCode = 404;
            vi.mocked(webpush.sendNotification).mockRejectedValue(error);

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(deactivateSubscription).toHaveBeenCalledWith(
                "https://notfound.push.example.com"
            );
        });

        it("continues sending to other devices when one fails with non-cleanup error", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions, deactivateSubscription } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([
                {
                    endpoint: "https://failing.push.example.com",
                    subscription: { endpoint: "https://failing.push.example.com" },
                },
                {
                    endpoint: "https://working.push.example.com",
                    subscription: { endpoint: "https://working.push.example.com" },
                },
            ] as never);

            const webpush = (await import("web-push")).default;
            vi.mocked(webpush.sendNotification)
                .mockRejectedValueOnce(new Error("Network error")) // First fails
                .mockResolvedValueOnce({} as never); // Second succeeds

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(result.success).toBe(true);
            expect(result.devicesNotified).toBe(1);
            expect(result.totalSubscriptions).toBe(2);
            // Should NOT deactivate on generic error
            expect(deactivateSubscription).not.toHaveBeenCalled();
        });

        it("handles deactivateSubscription failure gracefully", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions, deactivateSubscription } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([
                {
                    endpoint: "https://expired.push.example.com",
                    subscription: { endpoint: "https://expired.push.example.com" },
                },
            ] as never);
            // Deactivation fails
            vi.mocked(deactivateSubscription).mockRejectedValue(
                new Error("Database error")
            );

            const webpush = (await import("web-push")).default;
            const error = new Error("Gone") as Error & { statusCode: number };
            error.statusCode = 410;
            vi.mocked(webpush.sendNotification).mockRejectedValue(error);

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            // Should not throw - graceful handling
            const result = await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            expect(result.success).toBe(false);
            // Deactivation was attempted but failed - that's logged, not thrown
            expect(deactivateSubscription).toHaveBeenCalled();
        });

        it("includes default icon and url in payload", async () => {
            vi.doMock("@/lib/env", () => ({
                env: {
                    VAPID_PRIVATE_KEY: "private-key",
                    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
                    VAPID_SUBJECT_EMAIL: "test@example.com",
                },
            }));

            const { getActiveSubscriptions } =
                await import("@/lib/db/push-subscriptions");
            vi.mocked(getActiveSubscriptions).mockResolvedValue([
                {
                    endpoint: "https://push.example.com",
                    subscription: { endpoint: "https://push.example.com" },
                },
            ] as never);

            const webpush = (await import("web-push")).default;
            vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

            const { sendPushNotification } =
                await import("@/lib/push/notification-service");

            await sendPushNotification({
                userEmail: "test@example.com",
                notification: { title: "Test", body: "Test body" },
            });

            const [, payload] = vi.mocked(webpush.sendNotification).mock.calls[0];
            const parsedPayload = JSON.parse(payload as string);

            expect(parsedPayload.icon).toBe("/logos/icon-transparent-192.png");
            expect(parsedPayload.url).toBe("/");
        });
    });
});
