/**
 * Notification Lifecycle & AI Agent Integration Tests
 *
 * Tests covering:
 * - Push notification tool with VAPID configuration states
 * - SMS notification tool with Quo integration
 * - Notification database persistence
 * - Concurrent notification creation
 * - Authorization checks (mark read with wrong userId)
 * - Mark all notifications idempotent behavior
 * - Notification pagination edge cases
 * - SMS and push failure handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { setupTestDb } from "@/vitest.setup";

setupTestDb();

// Mock dependencies before importing modules under test
vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_opts, fn) =>
        fn({
            setAttribute: vi.fn(),
            setStatus: vi.fn(),
            spanContext: vi.fn(() => ({ traceId: "test-trace-id" })),
        })
    ),
    captureException: vi.fn(() => "sentry-event-id"),
    addBreadcrumb: vi.fn(),
    getActiveSpan: vi.fn(() => null),
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

// Hoisted mocks for push notification
const mockIsPushConfigured = vi.hoisted(() => vi.fn());
const mockSendPushNotification = vi.hoisted(() => vi.fn());

vi.mock("@/lib/push", () => ({
    isPushConfigured: mockIsPushConfigured,
    sendPushNotification: mockSendPushNotification,
}));

// Hoisted mocks for SMS
const mockSendSmsNotification = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sms/quo-notification-service", () => ({
    sendNotification: mockSendSmsNotification,
}));

import { db, schema } from "@/lib/db";
import {
    createNotification,
    getUnreadNotifications,
    getRecentNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
} from "@/lib/db/notifications";
import { createPushNotificationTool } from "@/lib/ai-team/agents/push-notification-tool";
import { createSmsUserTool } from "@/lib/ai-team/agents/sms-user-tool";
import type { SubagentContext } from "@/lib/ai-team/dcos/types";

// ============================================================================
// FIXTURES
// ============================================================================

const uuid = () => crypto.randomUUID();

async function createTestUser(email = "test@example.com") {
    const [user] = await db
        .insert(schema.users)
        .values({
            email,
            clerkId: `clerk_${uuid()}`,
            firstName: "Test",
            lastName: "User",
        })
        .returning();
    return user;
}

function createTestContext(userEmail: string, userId: string): SubagentContext {
    return {
        userId,
        userEmail,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to call tool execute with proper typing
 * AI SDK tools have execute?: (params, context) => Output | AsyncIterable<Output>
 * For our tools, we know execute exists and returns Output (not AsyncIterable)
 */

async function executeTool<TOutput>(tool: any, params: unknown): Promise<TOutput> {
    if (!tool.execute) {
        throw new Error("Tool has no execute function");
    }
    return tool.execute(params, {}) as Promise<TOutput>;
}

// ============================================================================
// PUSH NOTIFICATION TOOL TESTS
// ============================================================================

describe("Push Notification Tool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("VAPID configuration states", () => {
        it("returns PERMANENT error when VAPID is not configured", async () => {
            mockIsPushConfigured.mockReturnValue(false);

            const user = await createTestUser("vapid-not-configured@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Test Notification",
                body: "Test body content",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "PERMANENT",
                    message: expect.stringContaining("set up"),
                    retryable: false,
                },
            });
            expect(mockSendPushNotification).not.toHaveBeenCalled();
        });

        it("sends notification successfully when VAPID is configured", async () => {
            mockIsPushConfigured.mockReturnValue(true);
            mockSendPushNotification.mockResolvedValue({
                success: true,
                devicesNotified: 2,
                totalSubscriptions: 2,
                deviceTypesNotified: ["ios", "mac"],
                deviceTypesFailed: [],
                failureReasons: [],
                results: [],
                sentAt: new Date().toISOString(),
            });

            const user = await createTestUser("vapid-configured@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Important Alert",
                body: "You have a new message",
                url: "/inbox",
            });

            expect(result).toMatchObject({
                success: true,
                data: {
                    sent: true,
                    devicesNotified: 2,
                    totalSubscriptions: 2,
                    deviceTypes: ["ios", "mac"],
                },
            });
            expect(mockSendPushNotification).toHaveBeenCalledWith({
                userEmail: user.email,
                notification: {
                    title: "Important Alert",
                    body: "You have a new message",
                    url: "/inbox",
                },
            });
        });
    });

    describe("push failure handling", () => {
        it("returns PERMANENT error when user has no subscriptions", async () => {
            mockIsPushConfigured.mockReturnValue(true);
            mockSendPushNotification.mockResolvedValue({
                success: false,
                totalSubscriptions: 0,
                devicesNotified: 0,
                deviceTypesNotified: [],
                deviceTypesFailed: [],
                failureReasons: [],
                results: [],
                sentAt: new Date().toISOString(),
            });

            const user = await createTestUser("no-subscriptions@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Test",
                body: "Test body",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "PERMANENT",
                    message: expect.stringContaining("enabled push notifications"),
                    retryable: false,
                },
            });
        });

        it("returns TEMPORARY error on push service failure with network error", async () => {
            mockIsPushConfigured.mockReturnValue(true);
            mockSendPushNotification.mockResolvedValue({
                success: false,
                error: "Network error",
                totalSubscriptions: 3,
                devicesNotified: 0,
                deviceTypesNotified: [],
                deviceTypesFailed: ["ios", "mac", "windows"],
                failureReasons: ["network_error"],
                results: [],
                sentAt: new Date().toISOString(),
            });

            const user = await createTestUser("service-failure@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Test",
                body: "Test body",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "TEMPORARY",
                    message: expect.stringContaining("Network"),
                    retryable: true,
                },
            });
        });

        it("handles timeout errors as TEMPORARY failures", async () => {
            mockIsPushConfigured.mockReturnValue(true);
            // Real service returns structured errors, never throws
            // Test timeout scenario (different from ECONNREFUSED in previous test)
            mockSendPushNotification.mockResolvedValue({
                success: false,
                error: "Connection timed out",
                totalSubscriptions: 2,
                devicesNotified: 0,
                deviceTypesNotified: [],
                deviceTypesFailed: ["ios", "mac"],
                failureReasons: ["network_error"],
                results: [],
                sentAt: new Date().toISOString(),
            });

            const user = await createTestUser("timeout-error@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Test",
                body: "Test body",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "TEMPORARY",
                    retryable: true,
                },
            });
        });

        it("handles unexpected errors as PERMANENT failures", async () => {
            mockIsPushConfigured.mockReturnValue(true);
            mockSendPushNotification.mockRejectedValue(
                new Error("Unexpected internal error")
            );

            const user = await createTestUser("unexpected-error@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Test",
                body: "Test body",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "PERMANENT",
                    retryable: false,
                },
            });
        });
    });

    describe("validation", () => {
        it("returns VALIDATION error when title is missing", async () => {
            mockIsPushConfigured.mockReturnValue(true);

            const user = await createTestUser("validation-title@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                body: "Test body",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "VALIDATION",
                    message: expect.stringContaining("title is required"),
                },
            });
        });

        it("returns VALIDATION error when body is missing", async () => {
            mockIsPushConfigured.mockReturnValue(true);

            const user = await createTestUser("validation-body@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, {
                action: "send",
                title: "Test title",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "VALIDATION",
                    message: expect.stringContaining("body is required"),
                },
            });
        });
    });

    describe("describe action", () => {
        it("returns tool description with operations", async () => {
            const user = await createTestUser("describe@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createPushNotificationTool(context);

            const result = await executeTool(tool, { action: "describe" });

            expect(result).toMatchObject({
                id: "pushNotification",
                name: "Push Notification",
                summary: expect.stringContaining("push notification"),
                operations: expect.arrayContaining([
                    expect.objectContaining({
                        name: "send",
                        params: expect.arrayContaining([
                            expect.objectContaining({ name: "title" }),
                            expect.objectContaining({ name: "body" }),
                        ]),
                    }),
                ]),
            });
        });
    });
});

// ============================================================================
// SMS USER TOOL TESTS
// ============================================================================

describe("SMS User Tool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Quo integration", () => {
        it("sends SMS successfully when user has verified phone", async () => {
            mockSendSmsNotification.mockResolvedValue({
                success: true,
                messageId: 123,
                quoMessageId: "quo_msg_abc",
            });

            const user = await createTestUser("sms-success@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            const result = await executeTool(tool, {
                action: "send",
                message: "Your scheduled task completed!",
                reason: "agent",
            });

            expect(result).toMatchObject({
                success: true,
                data: {
                    sent: true,
                    messageId: 123,
                    quoMessageId: "quo_msg_abc",
                },
            });
            expect(mockSendSmsNotification).toHaveBeenCalledWith({
                userEmail: user.email,
                content: "Your scheduled task completed!",
                source: "scheduled_agent",
            });
        });

        it("maps reason to correct source type", async () => {
            mockSendSmsNotification.mockResolvedValue({
                success: true,
                messageId: 456,
            });

            const user = await createTestUser("sms-source@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            // Test briefing reason
            await executeTool(tool, {
                action: "send",
                message: "Morning briefing",
                reason: "briefing",
            });

            expect(mockSendSmsNotification).toHaveBeenLastCalledWith({
                userEmail: user.email,
                content: "Morning briefing",
                source: "briefing",
            });
        });
    });

    describe("SMS failure handling", () => {
        it("returns VALIDATION error when user has no phone number", async () => {
            mockSendSmsNotification.mockResolvedValue({
                success: false,
                error: "No verified phone number on file",
            });

            const user = await createTestUser("sms-no-phone@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            const result = await executeTool(tool, {
                action: "send",
                message: "Test message",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "VALIDATION",
                    message: expect.stringContaining("verified phone"),
                },
            });
        });

        it("handles Quo API failure as PERMANENT error", async () => {
            mockSendSmsNotification.mockRejectedValue(new Error("Quo API is down"));

            const user = await createTestUser("sms-api-down@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            const result = await executeTool(tool, {
                action: "send",
                message: "Test message",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "PERMANENT",
                    message: expect.stringContaining("Quo API is down"),
                },
            });
        });

        it("handles invalid phone number error", async () => {
            mockSendSmsNotification.mockResolvedValue({
                success: false,
                error: "Invalid phone number format",
            });

            const user = await createTestUser("sms-invalid-phone@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            const result = await executeTool(tool, {
                action: "send",
                message: "Test message",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "VALIDATION",
                    message: expect.stringContaining("Invalid phone"),
                },
            });
        });
    });

    describe("validation", () => {
        it("returns VALIDATION error when message is missing", async () => {
            const user = await createTestUser("sms-validation@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            const result = await executeTool(tool, {
                action: "send",
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "VALIDATION",
                    message: expect.stringContaining("message is required"),
                },
            });
        });

        it("returns VALIDATION error when message is too long", async () => {
            const user = await createTestUser("sms-too-long@test.com");
            const context = createTestContext(user.email, user.id);
            const tool = createSmsUserTool(context);

            const result = await executeTool(tool, {
                action: "send",
                message: "x".repeat(1601), // Over 1600 char limit
            });

            expect(result).toMatchObject({
                success: false,
                error: {
                    code: "VALIDATION",
                    message: expect.stringContaining("too long"),
                },
            });
        });
    });
});

// ============================================================================
// NOTIFICATION DATABASE PERSISTENCE TESTS
// ============================================================================

describe("Notification Database Persistence", () => {
    describe("createNotification", () => {
        it("creates notification and returns it with generated id", async () => {
            const user = await createTestUser("create-notification@test.com");

            const notification = await createNotification(
                user.id,
                "knowledge_created",
                "New document created: Project Plan",
                "/docs/project-plan"
            );

            expect(notification).toMatchObject({
                id: expect.any(String),
                userId: user.id,
                type: "knowledge_created",
                message: "New document created: Project Plan",
                documentPath: "/docs/project-plan",
                source: "librarian",
                read: false,
            });
        });

        it("creates notification without documentPath", async () => {
            const user = await createTestUser("no-path@test.com");

            const notification = await createNotification(
                user.id,
                "insight",
                "Here's an insight about your recent activity"
            );

            expect(notification.documentPath).toBeNull();
            expect(notification.type).toBe("insight");
        });
    });

    describe("concurrent notification creation", () => {
        it("handles concurrent creates with atomic ID generation", async () => {
            const user = await createTestUser("concurrent@test.com");

            // Create multiple notifications concurrently
            const promises = Array.from({ length: 10 }, (_, i) =>
                createNotification(
                    user.id,
                    "knowledge_updated",
                    `Concurrent update ${i}`
                )
            );

            const results = await Promise.all(promises);

            // All should have unique IDs
            const ids = results.map((n) => n.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(10);

            // All should be persisted
            const unread = await getUnreadNotifications(user.id, 20);
            expect(unread.length).toBe(10);
        });
    });

    describe("markNotificationRead authorization", () => {
        it("returns null when marking notification with wrong userId", async () => {
            const user1 = await createTestUser("user1@test.com");
            const user2 = await createTestUser("user2@test.com");

            // Create notification for user1
            const notification = await createNotification(
                user1.id,
                "insight",
                "User1's notification"
            );

            // Try to mark as read with user2's ID
            const result = await markNotificationRead(user2.id, notification.id);

            expect(result).toBeNull();

            // Verify notification is still unread
            const unread = await getUnreadNotifications(user1.id);
            expect(unread.some((n) => n.id === notification.id)).toBe(true);
        });

        it("marks notification read when userId matches", async () => {
            const user = await createTestUser("correct-user@test.com");

            const notification = await createNotification(
                user.id,
                "knowledge_moved",
                "Document moved"
            );

            const result = await markNotificationRead(user.id, notification.id);

            expect(result).toMatchObject({
                id: notification.id,
                read: true,
                readAt: expect.any(Date),
            });
        });
    });

    describe("markAllNotificationsRead idempotent behavior", () => {
        it("returns count of notifications marked read", async () => {
            const user = await createTestUser("mark-all@test.com");

            // Create several notifications
            await createNotification(user.id, "insight", "Insight 1");
            await createNotification(user.id, "insight", "Insight 2");
            await createNotification(user.id, "insight", "Insight 3");

            const count = await markAllNotificationsRead(user.id);

            expect(count).toBe(3);

            // All should now be read
            const unread = await getUnreadNotifications(user.id);
            expect(unread.length).toBe(0);
        });

        it("returns 0 when called again (idempotent)", async () => {
            const user = await createTestUser("idempotent@test.com");

            await createNotification(user.id, "insight", "Test notification");

            // First call marks as read
            const firstCount = await markAllNotificationsRead(user.id);
            expect(firstCount).toBe(1);

            // Second call returns 0 - no new notifications to mark
            const secondCount = await markAllNotificationsRead(user.id);
            expect(secondCount).toBe(0);
        });

        it("returns 0 when user has no notifications", async () => {
            const user = await createTestUser("no-notifications@test.com");

            const count = await markAllNotificationsRead(user.id);

            expect(count).toBe(0);
        });
    });

    describe("notification pagination", () => {
        it("getRecentNotifications respects limit parameter", async () => {
            const user = await createTestUser("pagination@test.com");

            // Create 15 notifications
            for (let i = 0; i < 15; i++) {
                await createNotification(user.id, "insight", `Notification ${i}`);
            }

            const limited = await getRecentNotifications(user.id, 5);
            expect(limited.length).toBe(5);

            const all = await getRecentNotifications(user.id, 20);
            expect(all.length).toBe(15);
        });

        it("returns notifications in descending order by createdAt", async () => {
            const user = await createTestUser("order@test.com");

            const n1 = await createNotification(user.id, "insight", "First");
            // Small delay to ensure different timestamps
            await new Promise((r) => setTimeout(r, 10));
            const n2 = await createNotification(user.id, "insight", "Second");
            await new Promise((r) => setTimeout(r, 10));
            const n3 = await createNotification(user.id, "insight", "Third");

            const recent = await getRecentNotifications(user.id);

            // Most recent first
            expect(recent[0].id).toBe(n3.id);
            expect(recent[1].id).toBe(n2.id);
            expect(recent[2].id).toBe(n1.id);
        });

        it("getUnreadNotifications only returns unread items", async () => {
            const user = await createTestUser("unread-filter@test.com");

            const n1 = await createNotification(user.id, "insight", "Unread 1");
            const n2 = await createNotification(user.id, "insight", "Will be read");
            const n3 = await createNotification(user.id, "insight", "Unread 2");

            // Mark middle one as read
            await markNotificationRead(user.id, n2.id);

            const unread = await getUnreadNotifications(user.id);

            expect(unread.length).toBe(2);
            expect(unread.map((n) => n.id)).not.toContain(n2.id);
        });
    });

    describe("getUnreadCount", () => {
        it("returns accurate count of unread notifications", async () => {
            const user = await createTestUser("count@test.com");

            expect(await getUnreadCount(user.id)).toBe(0);

            await createNotification(user.id, "insight", "One");
            expect(await getUnreadCount(user.id)).toBe(1);

            await createNotification(user.id, "insight", "Two");
            await createNotification(user.id, "insight", "Three");
            expect(await getUnreadCount(user.id)).toBe(3);

            // Mark all as read
            await markAllNotificationsRead(user.id);
            expect(await getUnreadCount(user.id)).toBe(0);
        });
    });
});
