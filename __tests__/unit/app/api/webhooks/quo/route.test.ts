import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";

// Enable database for these tests
setupTestDb();

// Create hoisted mock verify function so it's available during mock definition
const mockWebhookVerify = vi.hoisted(() => vi.fn());

// Mock the svix library with hoisted verify function
vi.mock("svix", () => ({
    Webhook: class MockWebhook {
        verify = mockWebhookVerify;
    },
}));

// Mock headers
vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue({
        get: vi.fn((name: string) => {
            const headers: Record<string, string> = {
                "svix-id": "test-id",
                "svix-timestamp": "1234567890",
                "svix-signature": "test-signature",
            };
            return headers[name];
        }),
    }),
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
}));

// Import after mocks are set up
import { POST } from "@/app/api/webhooks/quo/route";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(payload: unknown): Request {
    return {
        text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    } as unknown as Request;
}

function createQuoWebhookPayload(
    type: string,
    messageData: Partial<{
        id: string;
        from: string;
        to: string[];
        text: string;
        direction: string;
        status: string;
        createdAt: string;
        phoneNumberId: string;
    }>
) {
    return {
        id: "evt_123",
        object: "event",
        apiVersion: "v4",
        createdAt: new Date().toISOString(),
        type,
        data: {
            object: {
                id: messageData.id ?? "msg_123",
                object: "message",
                from: messageData.from ?? "+14155551234",
                to: messageData.to ?? ["+17373773499"],
                direction: messageData.direction ?? "incoming",
                text: messageData.text ?? "Hello Carmenta!",
                status: messageData.status ?? "received",
                createdAt: messageData.createdAt ?? new Date().toISOString(),
                phoneNumberId: messageData.phoneNumberId ?? "pn_123",
            },
        },
    };
}

// ============================================================================
// Tests
// ============================================================================

describe("Quo Webhook Handler", () => {
    beforeEach(() => {
        // Reset the mock webhook verify function
        mockWebhookVerify.mockReset();
    });

    describe("Signature Verification", () => {
        it("rejects requests with invalid signature", async () => {
            mockWebhookVerify.mockImplementation(() => {
                throw new Error("Invalid signature");
            });

            const payload = createQuoWebhookPayload("message.received", {});
            const request = createMockRequest(payload);

            const response = await POST(request);

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body.error).toBe("Invalid signature");
        });

        it("accepts requests with valid signature", async () => {
            const payload = createQuoWebhookPayload("message.received", {
                id: "msg_valid_sig",
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            const response = await POST(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });
    });

    describe("Message Received Events", () => {
        it("stores inbound message in database", async () => {
            const messageId = `msg_test_${Date.now()}`;
            const payload = createQuoWebhookPayload("message.received", {
                id: messageId,
                from: "+14155559999",
                text: "Test message content",
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            await POST(request);

            // Verify message was stored
            const [stored] = await db
                .select()
                .from(schema.smsInboundMessages)
                .where(eq(schema.smsInboundMessages.quoMessageId, messageId));

            expect(stored).toBeDefined();
            expect(stored.fromPhone).toBe("+14155559999");
            expect(stored.content).toBe("Test message content");
            expect(stored.processingStatus).toBe("pending");
        });

        it("handles duplicate messages idempotently", async () => {
            const messageId = `msg_dupe_${Date.now()}`;
            const payload = createQuoWebhookPayload("message.received", {
                id: messageId,
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request1 = createMockRequest(payload);
            const request2 = createMockRequest(payload);

            // First request
            await POST(request1);

            // Second request (duplicate)
            const response = await POST(request2);

            expect(response.status).toBe(200);

            // Verify only one message stored
            const messages = await db
                .select()
                .from(schema.smsInboundMessages)
                .where(eq(schema.smsInboundMessages.quoMessageId, messageId));

            expect(messages.length).toBe(1);
        });
    });

    describe("Unknown Sender Rate Limiting", () => {
        it("allows first message from unknown sender", async () => {
            const phoneNumber = "+14155550001";
            const messageId = `msg_first_${Date.now()}`;
            const payload = createQuoWebhookPayload("message.received", {
                id: messageId,
                from: phoneNumber,
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            await POST(request);

            // Check message was stored with pending status (not blocked)
            const [message] = await db
                .select()
                .from(schema.smsInboundMessages)
                .where(eq(schema.smsInboundMessages.quoMessageId, messageId));

            expect(message.processingStatus).toBe("pending");

            // Check sender was tracked
            const [sender] = await db
                .select()
                .from(schema.unknownSmsSenders)
                .where(eq(schema.unknownSmsSenders.phoneNumber, phoneNumber));

            expect(sender).toBeDefined();
            expect(sender.messageCount).toBe(1);
            expect(sender.lastPromptedAt).toBeDefined();
        });

        it("blocks sender after exceeding rate limit", async () => {
            const phoneNumber = "+14155550002";

            // Create a sender that's already at the limit
            await db.insert(schema.unknownSmsSenders).values({
                phoneNumber,
                messageCount: 10, // At limit
                lastMessageAt: new Date(), // Recent
            });

            const messageId = `msg_blocked_${Date.now()}`;
            const payload = createQuoWebhookPayload("message.received", {
                id: messageId,
                from: phoneNumber,
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            await POST(request);

            // Check message was stored but marked as failed
            const [message] = await db
                .select()
                .from(schema.smsInboundMessages)
                .where(eq(schema.smsInboundMessages.quoMessageId, messageId));

            expect(message.processingStatus).toBe("failed");
            expect(message.errorMessage).toContain("Rate limited");

            // Check sender was blocked
            const [sender] = await db
                .select()
                .from(schema.unknownSmsSenders)
                .where(eq(schema.unknownSmsSenders.phoneNumber, phoneNumber));

            expect(sender.blockedAt).toBeDefined();
        });

        it("resets rate limit after window expires", async () => {
            const phoneNumber = "+14155550003";
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

            // Create a sender with old message count
            await db.insert(schema.unknownSmsSenders).values({
                phoneNumber,
                messageCount: 5,
                lastMessageAt: twoHoursAgo, // Outside 1-hour window
            });

            const messageId = `msg_reset_${Date.now()}`;
            const payload = createQuoWebhookPayload("message.received", {
                id: messageId,
                from: phoneNumber,
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            await POST(request);

            // Check sender count was reset
            const [sender] = await db
                .select()
                .from(schema.unknownSmsSenders)
                .where(eq(schema.unknownSmsSenders.phoneNumber, phoneNumber));

            expect(sender.messageCount).toBe(1); // Reset to 1
        });

        it("does not re-prompt within 24 hours", async () => {
            const phoneNumber = "+14155550004";
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

            // Create a sender that was prompted 12 hours ago
            await db.insert(schema.unknownSmsSenders).values({
                phoneNumber,
                messageCount: 1,
                lastMessageAt: threeHoursAgo, // Outside rate window
                lastPromptedAt: twelveHoursAgo, // Within 24-hour prompt window
            });

            const messageId = `msg_noprompt_${Date.now()}`;
            const payload = createQuoWebhookPayload("message.received", {
                id: messageId,
                from: phoneNumber,
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            await POST(request);

            // Check lastPromptedAt was NOT updated
            const [sender] = await db
                .select()
                .from(schema.unknownSmsSenders)
                .where(eq(schema.unknownSmsSenders.phoneNumber, phoneNumber));

            // Should still be the original 12 hours ago (with some tolerance)
            const timeDiff =
                Math.abs(sender.lastPromptedAt!.getTime() - twelveHoursAgo.getTime()) /
                1000;
            expect(timeDiff).toBeLessThan(5); // Within 5 seconds
        });
    });

    describe("Message Delivered Events", () => {
        it("handles delivery confirmation without error", async () => {
            const payload = createQuoWebhookPayload("message.delivered", {
                id: "msg_delivered_123",
                direction: "outgoing",
                status: "delivered",
            });
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            const response = await POST(request);

            expect(response.status).toBe(200);
        });
    });

    describe("Unknown Events", () => {
        it("handles unknown event types gracefully", async () => {
            const payload = createQuoWebhookPayload("unknown.event.type", {});
            mockWebhookVerify.mockReturnValue(payload);

            const request = createMockRequest(payload);
            const response = await POST(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });
    });
});
