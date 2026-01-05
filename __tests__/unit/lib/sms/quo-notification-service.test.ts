/**
 * Quo Notification Service Tests
 *
 * Tests for outbound SMS notifications from Carmenta to users.
 * Uses PGlite for real database operations, mocks HTTP client for Quo API.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { setupTestDb } from "@/vitest.setup";

setupTestDb();

// Create hoisted mocks before module imports
const mockJsonResponse = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn(() => ({ json: mockJsonResponse })));

vi.mock("@/lib/http-client", () => ({
    httpClient: {
        post: mockPost,
    },
}));

// Mock env for API key
vi.mock("@/lib/env", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/env")>();
    return {
        ...original,
        env: {
            ...original.env,
            QUO_NOTIFICATION_API_KEY: "test_api_key",
            QUO_PHONE_NUMBER: "+17373773499",
        },
        assertEnv: vi.fn(),
    };
});

import { db, schema } from "@/lib/db";
import {
    sendNotification,
    queueForRetry,
    updateDeliveryStatus,
    markAsReplied,
} from "@/lib/sms/quo-notification-service";

describe("QuoNotificationService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("sendNotification", () => {
        it("returns error when user has no verified phone number", async () => {
            // Setup: Create user without phone number
            await db.insert(schema.users).values({
                clerkId: "clerk_no_phone",
                email: "no-phone@example.com",
            });

            // Act
            const result = await sendNotification({
                userEmail: "no-phone@example.com",
                content: "Test notification",
                source: "alert",
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain("no verified, opted-in phone number");
            expect(mockPost).not.toHaveBeenCalled();
        });

        it("returns error when phone number is not opted in", async () => {
            // Setup: Create user with unverified phone
            await db.insert(schema.users).values({
                clerkId: "clerk_not_opted_in",
                email: "not-opted-in@example.com",
            });

            await db.insert(schema.userPhoneNumbers).values({
                userEmail: "not-opted-in@example.com",
                phoneNumber: "+14155551234",
                verified: true,
                smsOptIn: false, // Not opted in
                isPrimary: true,
            });

            // Act
            const result = await sendNotification({
                userEmail: "not-opted-in@example.com",
                content: "Test notification",
                source: "alert",
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain("no verified, opted-in phone number");
        });

        it("sends SMS when user has verified, opted-in phone number", async () => {
            // Setup: Create user with verified, opted-in phone
            await db.insert(schema.users).values({
                clerkId: "clerk_opted_in",
                email: "opted-in@example.com",
            });

            await db.insert(schema.userPhoneNumbers).values({
                userEmail: "opted-in@example.com",
                phoneNumber: "+14155551234",
                verified: true,
                verifiedAt: new Date(),
                smsOptIn: true,
                optedInAt: new Date(),
                isPrimary: true,
            });

            mockJsonResponse.mockResolvedValueOnce({
                id: "quo_msg_123",
                from: "+17373773499",
                to: ["+14155551234"],
                status: "queued",
                createdAt: new Date().toISOString(),
            });

            // Act
            const result = await sendNotification({
                userEmail: "opted-in@example.com",
                content: "Your scheduled task completed!",
                source: "scheduled_agent",
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.quoMessageId).toBe("quo_msg_123");
            expect(result.messageId).toBeDefined();

            // Verify message was recorded in database
            const outbound = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.id, result.messageId!),
            });

            expect(outbound).not.toBeNull();
            expect(outbound?.toPhone).toBe("+14155551234");
            expect(outbound?.content).toBe("Your scheduled task completed!");
            expect(outbound?.source).toBe("scheduled_agent");
            expect(outbound?.deliveryStatus).toBe("sent");
            expect(outbound?.quoMessageId).toBe("quo_msg_123");
        });

        it("links notification to conversation when conversationId provided", async () => {
            // Setup: Create user and connection
            const [user] = await db
                .insert(schema.users)
                .values({
                    clerkId: "clerk_convo",
                    email: "convo@example.com",
                })
                .returning();

            const [connection] = await db
                .insert(schema.connections)
                .values({
                    userId: user.id,
                    slug: "test-connection",
                    title: "Test Connection",
                })
                .returning();

            await db.insert(schema.userPhoneNumbers).values({
                userEmail: "convo@example.com",
                phoneNumber: "+14155559999",
                verified: true,
                smsOptIn: true,
                isPrimary: true,
            });

            mockJsonResponse.mockResolvedValueOnce({
                id: "quo_msg_456",
                from: "+17373773499",
                to: ["+14155559999"],
                status: "queued",
            });

            // Act
            const result = await sendNotification({
                userEmail: "convo@example.com",
                content: "Update on your task",
                source: "scheduled_agent",
                conversationId: connection.id,
            });

            // Assert
            expect(result.success).toBe(true);

            const outbound = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.id, result.messageId!),
            });

            expect(outbound?.conversationId).toBe(connection.id);
            expect(outbound?.contextWindowEnds).toBeDefined();
        });
    });

    describe("queueForRetry", () => {
        it("increments retry count and sets next retry time", async () => {
            // Setup: Create outbound message
            await db.insert(schema.users).values({
                clerkId: "clerk_retry",
                email: "retry@example.com",
            });

            const [message] = await db
                .insert(schema.smsOutboundMessages)
                .values({
                    userEmail: "retry@example.com",
                    toPhone: "+14155551234",
                    fromPhone: "+17373773499",
                    content: "Test message",
                    source: "alert",
                    deliveryStatus: "queued",
                    retryCount: 0,
                })
                .returning();

            // Act
            const result = await queueForRetry(message.id);

            // Assert
            expect(result).toBe(true);

            const updated = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.id, message.id),
            });

            expect(updated?.retryCount).toBe(1);
            expect(updated?.nextRetryAt).toBeDefined();
            expect(updated?.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
        });

        it("marks as failed after max retries", async () => {
            // Setup: Create message at max retries
            await db.insert(schema.users).values({
                clerkId: "clerk_max_retry",
                email: "max-retry@example.com",
            });

            const [message] = await db
                .insert(schema.smsOutboundMessages)
                .values({
                    userEmail: "max-retry@example.com",
                    toPhone: "+14155551234",
                    fromPhone: "+17373773499",
                    content: "Test message",
                    source: "alert",
                    deliveryStatus: "queued",
                    retryCount: 3, // At max
                })
                .returning();

            // Act
            const result = await queueForRetry(message.id);

            // Assert
            expect(result).toBe(false);

            const updated = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.id, message.id),
            });

            expect(updated?.deliveryStatus).toBe("failed");
            expect(updated?.errorMessage).toContain("maximum retry attempts");
        });

        it("returns false for nonexistent message", async () => {
            const result = await queueForRetry(99999);
            expect(result).toBe(false);
        });
    });

    describe("updateDeliveryStatus", () => {
        it("updates status to delivered", async () => {
            // Setup
            await db.insert(schema.users).values({
                clerkId: "clerk_delivery",
                email: "delivery@example.com",
            });

            await db.insert(schema.smsOutboundMessages).values({
                userEmail: "delivery@example.com",
                toPhone: "+14155551234",
                fromPhone: "+17373773499",
                content: "Test message",
                source: "alert",
                deliveryStatus: "sent",
                quoMessageId: "quo_delivery_123",
            });

            // Act
            await updateDeliveryStatus("quo_delivery_123", "delivered");

            // Assert
            const message = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.quoMessageId, "quo_delivery_123"),
            });

            expect(message?.deliveryStatus).toBe("delivered");
            expect(message?.deliveredAt).toBeDefined();
        });

        it("updates status to failed with error message", async () => {
            // Setup
            await db.insert(schema.users).values({
                clerkId: "clerk_failed",
                email: "failed@example.com",
            });

            await db.insert(schema.smsOutboundMessages).values({
                userEmail: "failed@example.com",
                toPhone: "+14155551234",
                fromPhone: "+17373773499",
                content: "Test message",
                source: "alert",
                deliveryStatus: "sent",
                quoMessageId: "quo_failed_123",
            });

            // Act
            await updateDeliveryStatus(
                "quo_failed_123",
                "failed",
                "Invalid phone number"
            );

            // Assert
            const message = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.quoMessageId, "quo_failed_123"),
            });

            expect(message?.deliveryStatus).toBe("failed");
            expect(message?.errorMessage).toBe("Invalid phone number");
        });
    });

    describe("markAsReplied", () => {
        it("sets repliedAt timestamp", async () => {
            // Setup
            await db.insert(schema.users).values({
                clerkId: "clerk_reply",
                email: "reply@example.com",
            });

            const [message] = await db
                .insert(schema.smsOutboundMessages)
                .values({
                    userEmail: "reply@example.com",
                    toPhone: "+14155551234",
                    fromPhone: "+17373773499",
                    content: "Test message",
                    source: "alert",
                    deliveryStatus: "delivered",
                })
                .returning();

            // Act
            await markAsReplied(message.id);

            // Assert
            const updated = await db.query.smsOutboundMessages.findFirst({
                where: (t, { eq }) => eq(t.id, message.id),
            });

            expect(updated?.repliedAt).toBeDefined();
            expect(updated?.repliedAt!.getTime()).toBeLessThanOrEqual(Date.now());
        });
    });
});

describe("User Phone Numbers Schema", () => {
    it("creates phone number with all fields", async () => {
        await db.insert(schema.users).values({
            clerkId: "clerk_phone_schema",
            email: "phone-schema@example.com",
        });

        const [phone] = await db
            .insert(schema.userPhoneNumbers)
            .values({
                userEmail: "phone-schema@example.com",
                phoneNumber: "+14155551234",
                verified: true,
                verifiedAt: new Date(),
                isPrimary: true,
                smsOptIn: true,
                optedInAt: new Date(),
                optInSource: "settings_page",
            })
            .returning();

        expect(phone.id).toBeDefined();
        expect(phone.phoneNumber).toBe("+14155551234");
        expect(phone.verified).toBe(true);
        expect(phone.isPrimary).toBe(true);
        expect(phone.smsOptIn).toBe(true);
        expect(phone.optInSource).toBe("settings_page");
    });

    it("enforces unique phone per user", async () => {
        await db.insert(schema.users).values({
            clerkId: "clerk_unique_phone",
            email: "unique-phone@example.com",
        });

        await db.insert(schema.userPhoneNumbers).values({
            userEmail: "unique-phone@example.com",
            phoneNumber: "+14155551234",
        });

        // Should reject duplicate phone for same user
        await expect(
            db.insert(schema.userPhoneNumbers).values({
                userEmail: "unique-phone@example.com",
                phoneNumber: "+14155551234",
            })
        ).rejects.toThrow();
    });
});

describe("SMS Outbound Messages Schema", () => {
    it("creates outbound message with all fields", async () => {
        const [user] = await db
            .insert(schema.users)
            .values({
                clerkId: "clerk_outbound_schema",
                email: "outbound-schema@example.com",
            })
            .returning();

        const [connection] = await db
            .insert(schema.connections)
            .values({
                userId: user.id,
                slug: "outbound-test",
                title: "Test",
            })
            .returning();

        const contextWindowEnds = new Date(Date.now() + 4 * 60 * 60 * 1000);

        const [message] = await db
            .insert(schema.smsOutboundMessages)
            .values({
                userEmail: "outbound-schema@example.com",
                toPhone: "+14155551234",
                fromPhone: "+17373773499",
                content: "Test notification",
                source: "scheduled_agent",
                conversationId: connection.id,
                deliveryStatus: "queued",
                contextWindowEnds,
            })
            .returning();

        expect(message.id).toBeDefined();
        expect(message.source).toBe("scheduled_agent");
        expect(message.conversationId).toBe(connection.id);
        expect(message.deliveryStatus).toBe("queued");
        expect(message.contextWindowEnds).toBeDefined();
    });

    it("defaults delivery status to queued", async () => {
        await db.insert(schema.users).values({
            clerkId: "clerk_default_status",
            email: "default-status@example.com",
        });

        const [message] = await db
            .insert(schema.smsOutboundMessages)
            .values({
                userEmail: "default-status@example.com",
                toPhone: "+14155551234",
                fromPhone: "+17373773499",
                content: "Test",
                source: "alert",
            })
            .returning();

        expect(message.deliveryStatus).toBe("queued");
        expect(message.retryCount).toBe(0);
    });
});
