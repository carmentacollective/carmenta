/**
 * Push Notification Subscription Lifecycle Tests
 *
 * Tests the complete lifecycle of PWA push notification subscriptions:
 * - Subscribe/unsubscribe routes
 * - Mark read operations (single and batch)
 * - Notification service with VAPID configuration
 * - Subscription cleanup on 410 Gone
 * - Multi-device subscription scenarios
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { setupTestDb } from "@/vitest.setup";

// Set up test database for subscription persistence tests
setupTestDb();

// Mock Clerk auth for route tests
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: vi.fn(),
    auth: vi.fn(),
}));

// Mock web-push for notification service tests
vi.mock("web-push", () => ({
    default: {
        setVapidDetails: vi.fn(),
        sendNotification: vi.fn(),
    },
}));

// Mock Sentry to avoid side effects
vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_, callback) =>
        callback({ setAttribute: vi.fn(), setStatus: vi.fn() })
    ),
    captureException: vi.fn(),
}));

// Mock logger to avoid noise
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        })),
    },
}));

// Import db and schema after mocks are set up
import { db, schema } from "@/lib/db";
import {
    upsertPushSubscription,
    getActiveSubscriptions,
    deleteSubscription,
    deactivateSubscription,
    getSubscriptionCount,
    hasActiveSubscription,
} from "@/lib/db/push-subscriptions";

// ============================================================================
// FIXTURES
// ============================================================================

const TEST_USER_EMAIL = "test@example.com";
const TEST_USER_CLERK_ID = "clerk_test_123";

function createValidSubscription(endpoint?: string) {
    return {
        endpoint:
            endpoint ?? `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`,
        expirationTime: null,
        keys: {
            p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-T1aGmujKn1nP8OClnIz_dmzJkk",
            auth: "tBHItJI5svbpez7KI4CCXg",
        },
    };
}

async function createTestUser(email = TEST_USER_EMAIL, clerkId = TEST_USER_CLERK_ID) {
    const [user] = await db
        .insert(schema.users)
        .values({
            email,
            clerkId,
            firstName: "Test",
            lastName: "User",
        })
        .returning();
    return user;
}

// ============================================================================
// DATABASE LAYER TESTS - Push Subscriptions
// ============================================================================

describe("Push Subscription Database Operations", () => {
    beforeEach(async () => {
        await createTestUser();
    });

    describe("upsertPushSubscription", () => {
        it("creates new subscription for user", async () => {
            const subscription = createValidSubscription();

            const result = await upsertPushSubscription(
                TEST_USER_EMAIL,
                subscription,
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
            );

            expect(result.id).toBeDefined();
            expect(result.userEmail).toBe(TEST_USER_EMAIL);
            expect(result.endpoint).toBe(subscription.endpoint);
            expect(result.deviceType).toBe("ios");
            expect(result.isActive).toBe(true);
        });

        it("updates existing subscription on renewal (upsert behavior)", async () => {
            const subscription = createValidSubscription();

            // Initial subscription
            const first = await upsertPushSubscription(
                TEST_USER_EMAIL,
                subscription,
                "Mozilla/5.0 (Macintosh; Intel Mac OS X)"
            );

            // Renewal with same endpoint but new keys
            const renewedSubscription = {
                ...subscription,
                keys: {
                    p256dh: "BNewKey123456789",
                    auth: "newAuthKey",
                },
            };

            const renewed = await upsertPushSubscription(
                TEST_USER_EMAIL,
                renewedSubscription,
                "Mozilla/5.0 (Macintosh; Intel Mac OS X)"
            );

            // Should be same record, updated
            expect(renewed.id).toBe(first.id);
            expect(renewed.subscription).toMatchObject({
                keys: renewedSubscription.keys,
            });
        });

        it("detects device type from user agent", async () => {
            const testCases = [
                { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", expected: "ios" },
                { ua: "Mozilla/5.0 (iPad; CPU iPad OS 17_0)", expected: "ios" },
                { ua: "Mozilla/5.0 (Linux; Android 14)", expected: "android" },
                { ua: "Mozilla/5.0 (Windows NT 10.0; Win64)", expected: "windows" },
                { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", expected: "mac" },
                { ua: "Mozilla/5.0 (X11; Linux x86_64)", expected: "linux" },
                { ua: undefined, expected: "unknown" },
            ];

            for (const { ua, expected } of testCases) {
                const subscription = createValidSubscription();
                const result = await upsertPushSubscription(
                    TEST_USER_EMAIL,
                    subscription,
                    ua
                );
                expect(result.deviceType).toBe(expected);
            }
        });
    });

    describe("getActiveSubscriptions", () => {
        it("returns all active subscriptions for user", async () => {
            // Create multiple subscriptions (different devices)
            await upsertPushSubscription(
                TEST_USER_EMAIL,
                createValidSubscription(),
                "iPhone"
            );
            await upsertPushSubscription(
                TEST_USER_EMAIL,
                createValidSubscription(),
                "Android"
            );
            await upsertPushSubscription(
                TEST_USER_EMAIL,
                createValidSubscription(),
                "Mac"
            );

            const subscriptions = await getActiveSubscriptions(TEST_USER_EMAIL);

            expect(subscriptions).toHaveLength(3);
            subscriptions.forEach((sub) => {
                expect(sub.isActive).toBe(true);
                expect(sub.userEmail).toBe(TEST_USER_EMAIL);
            });
        });

        it("excludes deactivated subscriptions", async () => {
            const sub1 = await upsertPushSubscription(
                TEST_USER_EMAIL,
                createValidSubscription(),
                "iPhone"
            );
            await upsertPushSubscription(
                TEST_USER_EMAIL,
                createValidSubscription(),
                "Android"
            );

            // Deactivate first subscription
            await deactivateSubscription(sub1.endpoint);

            const active = await getActiveSubscriptions(TEST_USER_EMAIL);

            expect(active).toHaveLength(1);
            expect(active[0].deviceType).toBe("android");
        });

        it("returns empty array for user with no subscriptions", async () => {
            const subscriptions = await getActiveSubscriptions("noone@example.com");
            expect(subscriptions).toEqual([]);
        });
    });

    describe("deleteSubscription", () => {
        it("deletes subscription for user", async () => {
            const subscription = createValidSubscription();
            await upsertPushSubscription(TEST_USER_EMAIL, subscription);

            const deleted = await deleteSubscription(
                TEST_USER_EMAIL,
                subscription.endpoint
            );

            expect(deleted).toBe(true);

            const remaining = await getActiveSubscriptions(TEST_USER_EMAIL);
            expect(remaining).toHaveLength(0);
        });

        it("returns false for non-existent endpoint (graceful no-op)", async () => {
            const deleted = await deleteSubscription(
                TEST_USER_EMAIL,
                "https://push.example.com/nonexistent"
            );

            expect(deleted).toBe(false);
        });

        it("does not delete subscription belonging to different user", async () => {
            const subscription = createValidSubscription();
            await upsertPushSubscription(TEST_USER_EMAIL, subscription);

            // Try to delete as different user
            const deleted = await deleteSubscription(
                "other@example.com",
                subscription.endpoint
            );

            expect(deleted).toBe(false);

            // Original subscription should still exist
            const remaining = await getActiveSubscriptions(TEST_USER_EMAIL);
            expect(remaining).toHaveLength(1);
        });
    });

    describe("deactivateSubscription", () => {
        it("soft-deletes subscription by setting isActive to false", async () => {
            const subscription = createValidSubscription();
            await upsertPushSubscription(TEST_USER_EMAIL, subscription);

            const deactivated = await deactivateSubscription(subscription.endpoint);

            expect(deactivated).not.toBeNull();
            expect(deactivated!.isActive).toBe(false);
        });

        it("returns null for non-existent endpoint", async () => {
            const result = await deactivateSubscription(
                "https://push.example.com/nonexistent"
            );
            expect(result).toBeNull();
        });
    });

    describe("getSubscriptionCount and hasActiveSubscription", () => {
        it("returns correct count of active subscriptions", async () => {
            expect(await getSubscriptionCount(TEST_USER_EMAIL)).toBe(0);
            expect(await hasActiveSubscription(TEST_USER_EMAIL)).toBe(false);

            await upsertPushSubscription(TEST_USER_EMAIL, createValidSubscription());

            expect(await getSubscriptionCount(TEST_USER_EMAIL)).toBe(1);
            expect(await hasActiveSubscription(TEST_USER_EMAIL)).toBe(true);

            await upsertPushSubscription(TEST_USER_EMAIL, createValidSubscription());

            expect(await getSubscriptionCount(TEST_USER_EMAIL)).toBe(2);
            expect(await hasActiveSubscription(TEST_USER_EMAIL)).toBe(true);
        });
    });
});

// ============================================================================
// API ROUTE TESTS - Subscribe
// ============================================================================

describe("POST /api/push/subscribe", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        await createTestUser();
    });

    it("returns 503 when VAPID not configured", async () => {
        // Reset modules and mock isPushConfigured to return false
        vi.doMock("@/lib/push", () => ({
            isPushConfigured: () => false,
        }));

        const { currentUser } = await import("@clerk/nextjs/server");
        (currentUser as Mock).mockResolvedValue({
            id: TEST_USER_CLERK_ID,
            emailAddresses: [{ emailAddress: TEST_USER_EMAIL }],
        });

        const { POST } = await import("@/app/api/push/subscribe/route");

        const request = new Request("https://example.com/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: createValidSubscription() }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.code).toBe("PUSH_NOT_CONFIGURED");
    });

    it("returns 401 when not authenticated", async () => {
        // Mock isPushConfigured to return true first
        vi.doMock("@/lib/push", () => ({
            isPushConfigured: () => true,
        }));

        const { currentUser } = await import("@clerk/nextjs/server");
        (currentUser as Mock).mockResolvedValue(null);

        const { POST } = await import("@/app/api/push/subscribe/route");

        const request = new Request("https://example.com/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: createValidSubscription() }),
        });

        const response = await POST(request);

        expect(response.status).toBe(401);
    });

    it("returns 400 for invalid subscription format", async () => {
        // Mock isPushConfigured to return true first
        vi.doMock("@/lib/push", () => ({
            isPushConfigured: () => true,
        }));

        const { currentUser } = await import("@clerk/nextjs/server");
        (currentUser as Mock).mockResolvedValue({
            id: TEST_USER_CLERK_ID,
            emailAddresses: [{ emailAddress: TEST_USER_EMAIL }],
        });

        const { POST } = await import("@/app/api/push/subscribe/route");

        const request = new Request("https://example.com/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subscription: {
                    endpoint: "not-a-valid-url",
                    keys: { p256dh: "", auth: "" },
                },
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
    });
});

// ============================================================================
// API ROUTE TESTS - Unsubscribe
// ============================================================================

describe("POST /api/push/unsubscribe", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await createTestUser();
    });

    it("returns 401 when not authenticated", async () => {
        const { currentUser } = await import("@clerk/nextjs/server");
        (currentUser as Mock).mockResolvedValue(null);

        const { POST } = await import("@/app/api/push/unsubscribe/route");

        const request = new Request("https://example.com/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "https://push.example.com/test" }),
        });

        const response = await POST(request);

        expect(response.status).toBe(401);
    });

    it("succeeds gracefully for non-existent endpoint", async () => {
        const { currentUser } = await import("@clerk/nextjs/server");
        (currentUser as Mock).mockResolvedValue({
            id: TEST_USER_CLERK_ID,
            emailAddresses: [{ emailAddress: TEST_USER_EMAIL }],
        });

        const { POST } = await import("@/app/api/push/unsubscribe/route");

        const request = new Request("https://example.com/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "https://push.example.com/nonexistent" }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.deleted).toBe(false);
    });
});

// ============================================================================
// API ROUTE TESTS - Mark Notifications Read
// ============================================================================

describe("POST /api/notifications/mark-read", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        const { auth } = await import("@clerk/nextjs/server");
        (auth as unknown as Mock).mockResolvedValue({ userId: null });

        const { POST } = await import("@/app/api/notifications/mark-read/route");

        const request = new Request("https://example.com/api/notifications/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId: "test-id" }),
        }) as never;

        const response = await POST(request);

        expect(response.status).toBe(401);
    });

    it("returns 400 for missing notificationId", async () => {
        const { auth } = await import("@clerk/nextjs/server");
        (auth as unknown as Mock).mockResolvedValue({ userId: TEST_USER_CLERK_ID });

        // Create user so lookup succeeds
        await createTestUser();

        const { POST } = await import("@/app/api/notifications/mark-read/route");

        const request = new Request("https://example.com/api/notifications/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        }) as never;

        const response = await POST(request);

        expect(response.status).toBe(400);
    });

    it("returns 404 for user not found", async () => {
        const { auth } = await import("@clerk/nextjs/server");
        (auth as unknown as Mock).mockResolvedValue({ userId: "nonexistent_clerk_id" });

        const { POST } = await import("@/app/api/notifications/mark-read/route");

        const request = new Request("https://example.com/api/notifications/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId: "test-id" }),
        }) as never;

        const response = await POST(request);

        expect(response.status).toBe(404);
    });
});

// ============================================================================
// API ROUTE TESTS - Mark All Read
// ============================================================================

describe("POST /api/notifications/mark-all-read", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        const { auth } = await import("@clerk/nextjs/server");
        (auth as unknown as Mock).mockResolvedValue({ userId: null });

        const { POST } = await import("@/app/api/notifications/mark-all-read/route");

        const response = await POST();

        expect(response.status).toBe(401);
    });

    it("returns 404 for user not found", async () => {
        const { auth } = await import("@clerk/nextjs/server");
        (auth as unknown as Mock).mockResolvedValue({ userId: "nonexistent_clerk_id" });

        const { POST } = await import("@/app/api/notifications/mark-all-read/route");

        const response = await POST();

        expect(response.status).toBe(404);
    });

    it("marks all notifications as read (idempotent)", async () => {
        const { auth } = await import("@clerk/nextjs/server");
        (auth as unknown as Mock).mockResolvedValue({ userId: TEST_USER_CLERK_ID });

        const user = await createTestUser();

        // Create some notifications (source must be "librarian" or "system" per enum)
        await db.insert(schema.notifications).values([
            {
                userId: user.id,
                type: "insight",
                message: "Test notification 1",
                source: "librarian",
            },
            {
                userId: user.id,
                type: "insight",
                message: "Test notification 2",
                source: "librarian",
            },
        ]);

        const { POST } = await import("@/app/api/notifications/mark-all-read/route");

        // First call
        const response1 = await POST();
        const body1 = await response1.json();

        expect(response1.status).toBe(200);
        expect(body1.success).toBe(true);
        expect(body1.count).toBe(2);

        // Second call (idempotent - should return 0)
        const response2 = await POST();
        const body2 = await response2.json();

        expect(response2.status).toBe(200);
        expect(body2.success).toBe(true);
        expect(body2.count).toBe(0);
    });
});

// ============================================================================
// NOTIFICATION SERVICE TESTS
// ============================================================================

describe("Push Notification Service", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await createTestUser();

        // Reset VAPID configuration state (it's cached in the module)
        vi.resetModules();
    });

    it("returns error when VAPID not configured", async () => {
        // Mock env without VAPID keys
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
            userEmail: TEST_USER_EMAIL,
            notification: {
                title: "Test",
                body: "Test body",
            },
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("VAPID");
    });

    it("returns error when user has no subscriptions", async () => {
        vi.doMock("@/lib/env", () => ({
            env: {
                VAPID_PRIVATE_KEY: "test-private-key",
                NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public-key",
                VAPID_SUBJECT_EMAIL: "push@example.com",
            },
        }));

        const { sendPushNotification } =
            await import("@/lib/push/notification-service");

        const result = await sendPushNotification({
            userEmail: TEST_USER_EMAIL,
            notification: {
                title: "Test",
                body: "Test body",
            },
        });

        expect(result.success).toBe(false);
        expect(result.totalSubscriptions).toBe(0);
        expect(result.error).toContain("No active push subscriptions");
    });

    it("deactivates subscription on 410 Gone from push service", async () => {
        vi.doMock("@/lib/env", () => ({
            env: {
                VAPID_PRIVATE_KEY: "test-private-key",
                NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public-key",
                VAPID_SUBJECT_EMAIL: "push@example.com",
            },
        }));

        // Create a subscription
        const subscription = createValidSubscription();
        await upsertPushSubscription(TEST_USER_EMAIL, subscription);

        // Mock web-push to return 410 Gone
        const webpush = await import("web-push");
        (webpush.default.sendNotification as Mock).mockRejectedValue({
            statusCode: 410,
        });

        const { sendPushNotification } =
            await import("@/lib/push/notification-service");

        const result = await sendPushNotification({
            userEmail: TEST_USER_EMAIL,
            notification: {
                title: "Test",
                body: "Test body",
            },
        });

        expect(result.success).toBe(false);
        expect(result.results[0].error).toBe("Subscription expired");

        // Verify subscription was deactivated
        const active = await getActiveSubscriptions(TEST_USER_EMAIL);
        expect(active).toHaveLength(0);
    });

    it("sends to multiple devices and handles partial failures", async () => {
        vi.doMock("@/lib/env", () => ({
            env: {
                VAPID_PRIVATE_KEY: "test-private-key",
                NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public-key",
                VAPID_SUBJECT_EMAIL: "push@example.com",
            },
        }));

        // Create subscriptions for multiple devices
        const sub1 = createValidSubscription();
        const sub2 = createValidSubscription();
        const sub3 = createValidSubscription();

        await upsertPushSubscription(TEST_USER_EMAIL, sub1, "iPhone");
        await upsertPushSubscription(TEST_USER_EMAIL, sub2, "Android");
        await upsertPushSubscription(TEST_USER_EMAIL, sub3, "Mac");

        // Mock web-push: first succeeds, second fails with 404, third succeeds
        const webpush = await import("web-push");
        (webpush.default.sendNotification as Mock)
            .mockResolvedValueOnce({}) // iPhone - success
            .mockRejectedValueOnce({ statusCode: 404 }) // Android - not found
            .mockResolvedValueOnce({}); // Mac - success

        const { sendPushNotification } =
            await import("@/lib/push/notification-service");

        const result = await sendPushNotification({
            userEmail: TEST_USER_EMAIL,
            notification: {
                title: "Test",
                body: "Multi-device test",
            },
        });

        expect(result.success).toBe(true); // At least one succeeded
        expect(result.totalSubscriptions).toBe(3);
        expect(result.devicesNotified).toBe(2);
        expect(result.results.filter((r) => r.success)).toHaveLength(2);
        expect(result.results.filter((r) => !r.success)).toHaveLength(1);
    });
});

// ============================================================================
// MULTI-DEVICE SUBSCRIPTION TESTS
// ============================================================================

describe("Multiple Subscriptions per User", () => {
    beforeEach(async () => {
        await createTestUser();
    });

    it("allows user to have subscriptions on multiple devices", async () => {
        const devices = [
            { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", expectedType: "ios" },
            { ua: "Mozilla/5.0 (iPad; CPU iPad OS 17_0)", expectedType: "ios" },
            { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", expectedType: "mac" },
            { ua: "Mozilla/5.0 (Windows NT 10.0; Win64)", expectedType: "windows" },
        ];

        for (const { ua, expectedType } of devices) {
            await upsertPushSubscription(
                TEST_USER_EMAIL,
                createValidSubscription(),
                ua
            );
        }

        const subscriptions = await getActiveSubscriptions(TEST_USER_EMAIL);

        expect(subscriptions).toHaveLength(4);

        // Verify device types are correctly identified
        const deviceTypes = subscriptions.map((s) => s.deviceType);
        expect(deviceTypes).toContain("ios");
        expect(deviceTypes).toContain("mac");
        expect(deviceTypes).toContain("windows");
    });

    it("isolates subscriptions between different users", async () => {
        const user2Email = "user2@example.com";
        await createTestUser(user2Email, "clerk_user2");

        // User 1 has 3 subscriptions
        await upsertPushSubscription(TEST_USER_EMAIL, createValidSubscription());
        await upsertPushSubscription(TEST_USER_EMAIL, createValidSubscription());
        await upsertPushSubscription(TEST_USER_EMAIL, createValidSubscription());

        // User 2 has 2 subscriptions
        await upsertPushSubscription(user2Email, createValidSubscription());
        await upsertPushSubscription(user2Email, createValidSubscription());

        const user1Subs = await getActiveSubscriptions(TEST_USER_EMAIL);
        const user2Subs = await getActiveSubscriptions(user2Email);

        expect(user1Subs).toHaveLength(3);
        expect(user2Subs).toHaveLength(2);

        // Verify no overlap in endpoints
        const user1Endpoints = user1Subs.map((s) => s.endpoint);
        const user2Endpoints = user2Subs.map((s) => s.endpoint);

        user1Endpoints.forEach((endpoint) => {
            expect(user2Endpoints).not.toContain(endpoint);
        });
    });
});
