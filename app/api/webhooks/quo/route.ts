/**
 * Quo Webhook Handler
 *
 * Handles inbound SMS messages and delivery notifications from Quo (OpenPhone).
 *
 * Events handled:
 * - message.received: Inbound SMS from external phone number
 * - message.delivered: Delivery confirmation for outbound messages
 *
 * Setup:
 * 1. Create webhook in Quo Dashboard or via API
 * 2. Point to: https://your-domain.com/api/webhooks/quo
 * 3. Subscribe to: message.received, message.delivered
 * 4. Copy signing secret to QUO_WEBHOOK_SECRET env var
 *
 * Security:
 * - Svix signature verification (fail closed)
 * - Rate limiting for unknown senders
 * - Idempotency via quoMessageId
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db, schema } from "@/lib/db";
import { env, assertEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

/** Quo webhook event types we handle */
type QuoWebhookEvent =
    | { type: "message.received"; data: QuoMessageData }
    | { type: "message.delivered"; data: QuoMessageData };

/** Quo message data from webhook payload */
interface QuoMessageData {
    id: string;
    object: "message";
    from: string;
    to: string[];
    direction: "incoming" | "outgoing";
    text: string;
    status: string;
    createdAt: string;
    userId?: string;
    phoneNumberId: string;
}

/** Full Quo webhook payload structure */
interface QuoWebhookPayload {
    id: string;
    object: "event";
    apiVersion: string;
    createdAt: string;
    type: string;
    data: {
        object: QuoMessageData;
    };
}

// ============================================================================
// Constants
// ============================================================================

/** Max messages per hour from a single unknown number before blocking */
const UNKNOWN_SENDER_RATE_LIMIT = 10;

/** How often we can send "Who is this?" to an unknown number (24 hours) */
const UNKNOWN_SENDER_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Spam Protection
// ============================================================================

/**
 * Check if an unknown sender should be rate limited
 *
 * Returns true if we should process the message, false if rate limited.
 * Side effect: Updates the unknown_sms_senders table.
 */
async function checkUnknownSenderRateLimit(phoneNumber: string): Promise<{
    allowed: boolean;
    shouldPrompt: boolean;
    isNewSender: boolean;
}> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Try to find existing sender record
    const [existing] = await db
        .select()
        .from(schema.unknownSmsSenders)
        .where(eq(schema.unknownSmsSenders.phoneNumber, phoneNumber))
        .limit(1);

    if (!existing) {
        // First message from this number
        await db.insert(schema.unknownSmsSenders).values({
            phoneNumber,
            messageCount: 1,
            lastMessageAt: now,
        });

        return { allowed: true, shouldPrompt: true, isNewSender: true };
    }

    // Check if blocked
    if (existing.blockedAt) {
        logger.warn(
            { phoneNumber, blockedAt: existing.blockedAt },
            "Blocked unknown sender attempted message"
        );
        return { allowed: false, shouldPrompt: false, isNewSender: false };
    }

    // Reset count if last message was more than an hour ago
    // Note: This is a simple window reset, not a sliding window. A sender could
    // theoretically send 10 messages at minute 59, wait 2 minutes, and send 10 more.
    // This is acceptable for Milestone 1 since once blocked, senders stay blocked
    // permanently. If abuse patterns emerge, we can upgrade to a sliding window
    // by querying actual message counts from smsInboundMessages.
    const resetCount = existing.lastMessageAt < oneHourAgo;
    const newCount = resetCount ? 1 : existing.messageCount + 1;

    // Check rate limit
    if (newCount > UNKNOWN_SENDER_RATE_LIMIT) {
        await db
            .update(schema.unknownSmsSenders)
            .set({
                messageCount: newCount,
                lastMessageAt: now,
                blockedAt: now,
            })
            .where(eq(schema.unknownSmsSenders.id, existing.id));

        logger.warn(
            { phoneNumber, messageCount: newCount },
            "Unknown sender rate limited and blocked"
        );

        Sentry.captureMessage("Unknown SMS sender blocked for rate limiting", {
            level: "warning",
            tags: { component: "webhook", route: "quo", action: "rate_limit" },
            extra: { phoneNumber, messageCount: newCount },
        });

        return { allowed: false, shouldPrompt: false, isNewSender: false };
    }

    // Check if we should prompt again (24 hour interval)
    const shouldPrompt =
        !existing.lastPromptedAt ||
        now.getTime() - existing.lastPromptedAt.getTime() >
            UNKNOWN_SENDER_PROMPT_INTERVAL_MS;

    // Update record
    await db
        .update(schema.unknownSmsSenders)
        .set({
            messageCount: newCount,
            lastMessageAt: now,
            ...(shouldPrompt && { lastPromptedAt: now }),
        })
        .where(eq(schema.unknownSmsSenders.id, existing.id));

    return { allowed: true, shouldPrompt, isNewSender: false };
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handle message.received event
 *
 * Stores the inbound message for later processing.
 * Milestone 1: Just logs to database. Later milestones add routing.
 */
async function handleMessageReceived(message: QuoMessageData): Promise<void> {
    const requestLogger = logger.child({
        quoMessageId: message.id,
        fromPhone: message.from,
    });

    // Check for duplicate (idempotency)
    const [existing] = await db
        .select({ id: schema.smsInboundMessages.id })
        .from(schema.smsInboundMessages)
        .where(eq(schema.smsInboundMessages.quoMessageId, message.id))
        .limit(1);

    if (existing) {
        requestLogger.debug("Duplicate webhook received, skipping");
        return;
    }

    // TODO: Milestone 2 - Look up user by phone number
    // For now, all messages are from unknown senders
    const userEmail: string | null = null;

    // Check rate limiting for unknown senders
    if (!userEmail) {
        const rateCheck = await checkUnknownSenderRateLimit(message.from);

        if (!rateCheck.allowed) {
            // Still store the message for audit trail, but mark as blocked
            await db.insert(schema.smsInboundMessages).values({
                quoMessageId: message.id,
                fromPhone: message.from,
                toPhone: message.to[0] ?? "",
                content: message.text,
                quoPhoneNumberId: message.phoneNumberId,
                processingStatus: "failed",
                errorMessage: "Rate limited: unknown sender blocked",
                quoCreatedAt: new Date(message.createdAt),
            });

            requestLogger.warn("Message from rate-limited unknown sender stored");
            return;
        }

        // Log the prompt decision for debugging
        if (rateCheck.shouldPrompt) {
            requestLogger.info(
                { isNewSender: rateCheck.isNewSender },
                "Would send 'Who is this?' prompt (not implemented in Milestone 1)"
            );
        }
    }

    // Store the message
    await db.insert(schema.smsInboundMessages).values({
        quoMessageId: message.id,
        fromPhone: message.from,
        toPhone: message.to[0] ?? "",
        content: message.text,
        quoPhoneNumberId: message.phoneNumberId,
        processingStatus: "pending", // Will be 'completed' after Milestone 3 routing
        userEmail,
        quoCreatedAt: new Date(message.createdAt),
    });

    requestLogger.info(
        { contentLength: message.text.length },
        "Inbound SMS stored successfully"
    );
}

/**
 * Handle message.delivered event
 *
 * Updates delivery status for outbound messages.
 * Milestone 1: Just logs. Full implementation in Milestone 4.
 */
async function handleMessageDelivered(message: QuoMessageData): Promise<void> {
    logger.debug(
        { quoMessageId: message.id, status: message.status },
        "Message delivery confirmation received (not fully implemented in Milestone 1)"
    );

    // TODO: Milestone 4 - Update sms_context.deliveryStatus
}

// ============================================================================
// Webhook Verification
// ============================================================================

/**
 * Verify and parse the incoming webhook request
 *
 * Uses Svix signature verification. Fails closed on any verification error.
 */
async function verifyWebhook(request: Request): Promise<QuoWebhookEvent> {
    assertEnv(env.QUO_WEBHOOK_SECRET, "QUO_WEBHOOK_SECRET");

    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        throw new Error("Missing Svix headers");
    }

    const body = await request.text();
    const wh = new Webhook(env.QUO_WEBHOOK_SECRET);

    const payload = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
    }) as QuoWebhookPayload;

    // Transform to our event type
    return {
        type: payload.type as QuoWebhookEvent["type"],
        data: payload.data.object,
    };
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * POST /api/webhooks/quo
 *
 * Receives and processes Quo webhook events.
 * Verifies signature before processing to prevent spoofing.
 */
export async function POST(request: Request): Promise<NextResponse> {
    let event: QuoWebhookEvent;

    try {
        event = await verifyWebhook(request);
    } catch (error) {
        logger.error({ error }, "Failed to verify Quo webhook");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    try {
        switch (event.type) {
            case "message.received":
                await handleMessageReceived(event.data);
                break;
            case "message.delivered":
                await handleMessageDelivered(event.data);
                break;
            default:
                // Log but don't fail for unknown events
                logger.debug(
                    { type: (event as { type: string }).type },
                    "Unhandled Quo webhook event"
                );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ error, eventType: event.type }, "Failed to process Quo webhook");

        Sentry.captureException(error, {
            tags: {
                component: "webhook",
                route: "quo",
                action: "process_event",
            },
            extra: { eventType: event.type },
        });

        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
}
