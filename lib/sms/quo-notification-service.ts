/**
 * Quo Notification Service
 *
 * System-level SMS notifications from Carmenta to users.
 * Uses a dedicated API key (QUO_NOTIFICATION_API_KEY) separate from
 * user API keys used for tool calls.
 *
 * Features:
 * - Rate limiting (10 req/s Quo limit)
 * - Exponential backoff retry (3 attempts over 15 minutes)
 * - Delivery tracking in sms_outbound_messages table
 * - Context window for reply routing (4 hours)
 * - TCPA compliance (only sends to opted-in users)
 */

import * as Sentry from "@sentry/nextjs";
import { and, eq, lte, isNotNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { env, assertEnv } from "@/lib/env";
import { httpClient } from "@/lib/http-client";
import { logger } from "@/lib/logger";

const QUO_API_BASE = "https://api.openphone.com/v1";

// Context window for reply routing (4 hours)
const CONTEXT_WINDOW_MS = 4 * 60 * 60 * 1000;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 60_000; // 1 minute
const MAX_RETRY_DELAY_MS = 15 * 60_000; // 15 minutes

// Rate limiting: 10 req/s with 100ms spacing
const MIN_REQUEST_INTERVAL_MS = 100;
let lastRequestTime = 0;

/**
 * Notification parameters
 */
export interface SendNotificationParams {
    /** Recipient user email */
    userEmail: string;
    /** SMS content (aim for 160-320 chars / 1-2 segments) */
    content: string;
    /** What triggered this notification */
    source: "scheduled_agent" | "alert" | "briefing" | "reminder" | "verification";
    /** Link to existing conversation for context routing */
    conversationId?: number;
    /** Link to job run (for scheduled agents) */
    jobRunId?: string;
}

/**
 * Notification result
 */
export interface SendNotificationResult {
    success: boolean;
    messageId?: number;
    quoMessageId?: string;
    error?: string;
}

/**
 * Build headers for Quo API requests
 */
function buildHeaders(apiKey: string): Record<string, string> {
    return {
        Authorization: apiKey,
        "Content-Type": "application/json",
    };
}

/**
 * Simple rate limiter - ensures minimum spacing between requests
 */
async function waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
        await new Promise((resolve) =>
            setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest)
        );
    }
    lastRequestTime = Date.now();
}

/**
 * Calculate next retry delay with exponential backoff
 */
function calculateRetryDelay(retryCount: number): number {
    const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Get user's primary opted-in phone number
 */
async function getUserPhoneNumber(
    userEmail: string
): Promise<{ phoneNumber: string } | null> {
    const phoneRecord = await db.query.userPhoneNumbers.findFirst({
        where: and(
            eq(schema.userPhoneNumbers.userEmail, userEmail),
            eq(schema.userPhoneNumbers.verified, true),
            eq(schema.userPhoneNumbers.smsOptIn, true),
            eq(schema.userPhoneNumbers.isPrimary, true)
        ),
        columns: { phoneNumber: true },
    });

    return phoneRecord ?? null;
}

/**
 * Send an SMS notification to a user
 *
 * This is the main entry point for sending proactive notifications.
 * It handles:
 * - Looking up the user's phone number
 * - Checking opt-in status (TCPA compliance)
 * - Creating the outbound message record
 * - Sending via Quo API with rate limiting
 * - Tracking delivery status
 */
export async function sendNotification(
    params: SendNotificationParams
): Promise<SendNotificationResult> {
    const { userEmail, content, source, conversationId, jobRunId } = params;

    const requestLogger = logger.child({
        userEmail,
        source,
        conversationId,
        jobRunId,
    });

    return Sentry.startSpan(
        {
            op: "sms.send",
            name: "QuoNotificationService.sendNotification",
        },
        async (span) => {
            span.setAttribute("sms.source", source);
            span.setAttribute("sms.user_email", userEmail);

            // Track message ID for retry on failure
            let createdMessageId: number | undefined;

            try {
                // Get user's phone number
                const phoneRecord = await getUserPhoneNumber(userEmail);
                if (!phoneRecord) {
                    requestLogger.warn(
                        "Cannot send SMS: user has no verified, opted-in phone number"
                    );
                    return {
                        success: false,
                        error: "User has no verified, opted-in phone number",
                    };
                }

                // Get API key
                assertEnv(env.QUO_NOTIFICATION_API_KEY, "QUO_NOTIFICATION_API_KEY");
                const apiKey = env.QUO_NOTIFICATION_API_KEY;

                // Get Carmenta's phone number from env
                assertEnv(env.QUO_PHONE_NUMBER, "QUO_PHONE_NUMBER");
                const fromPhone = env.QUO_PHONE_NUMBER;

                // Calculate context window end
                const contextWindowEnds = new Date(Date.now() + CONTEXT_WINDOW_MS);

                // Create outbound message record
                const [outboundMessage] = await db
                    .insert(schema.smsOutboundMessages)
                    .values({
                        userEmail,
                        toPhone: phoneRecord.phoneNumber,
                        fromPhone,
                        content,
                        source,
                        conversationId: conversationId ?? null,
                        jobRunId: jobRunId ?? null,
                        deliveryStatus: "queued",
                        contextWindowEnds,
                    })
                    .returning();

                // Track for retry if API call fails
                createdMessageId = outboundMessage.id;

                requestLogger.info(
                    { messageId: outboundMessage.id },
                    "📤 SMS notification queued"
                );

                // Send via Quo API with rate limiting
                await waitForRateLimit();

                const response = await httpClient
                    .post(`${QUO_API_BASE}/messages`, {
                        headers: buildHeaders(apiKey),
                        json: {
                            from: fromPhone,
                            to: [phoneRecord.phoneNumber],
                            content,
                        },
                    })
                    .json<{
                        id: string;
                        from: string;
                        to: string[];
                        status: string;
                        createdAt: string;
                    }>();

                // Update record with Quo message ID and sent status
                // If this fails, SMS was still sent - return success with warning
                try {
                    await db
                        .update(schema.smsOutboundMessages)
                        .set({
                            quoMessageId: response.id,
                            deliveryStatus: "sent",
                            sentAt: new Date(),
                        })
                        .where(eq(schema.smsOutboundMessages.id, outboundMessage.id));
                } catch (updateError) {
                    // SMS was sent but tracking failed - log but don't fail
                    requestLogger.error(
                        {
                            error: updateError,
                            messageId: outboundMessage.id,
                            quoMessageId: response.id,
                        },
                        "⚠️ SMS sent but tracking update failed"
                    );
                    Sentry.captureException(updateError, {
                        level: "warning",
                        tags: { component: "sms", action: "update_tracking" },
                        extra: {
                            messageId: outboundMessage.id,
                            quoMessageId: response.id,
                        },
                    });
                }

                requestLogger.info(
                    { messageId: outboundMessage.id, quoMessageId: response.id },
                    "✅ SMS notification sent"
                );

                span.setStatus({ code: 1, message: "ok" });

                return {
                    success: true,
                    messageId: outboundMessage.id,
                    quoMessageId: response.id,
                };
            } catch (error) {
                requestLogger.error({ error }, "❌ Failed to send SMS notification");

                Sentry.captureException(error, {
                    tags: {
                        component: "sms",
                        action: "send_notification",
                        source,
                    },
                    extra: { userEmail, conversationId, jobRunId, createdMessageId },
                });

                // Queue for retry if message was created before failure
                if (createdMessageId) {
                    try {
                        await queueForRetry(createdMessageId);
                    } catch (retryError) {
                        // If retry queueing fails, log but don't throw
                        requestLogger.error(
                            { error: retryError, messageId: createdMessageId },
                            "Failed to queue message for retry"
                        );
                    }
                }

                span.setStatus({ code: 2, message: "error" });

                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        }
    );
}

/**
 * Queue a notification for retry with exponential backoff
 *
 * Called when initial send fails. Updates the message record with
 * next retry time. A background job processes the retry queue.
 */
export async function queueForRetry(messageId: number): Promise<boolean> {
    const message = await db.query.smsOutboundMessages.findFirst({
        where: eq(schema.smsOutboundMessages.id, messageId),
    });

    if (!message) {
        logger.warn({ messageId }, "Cannot retry: message not found");
        return false;
    }

    if (message.retryCount >= MAX_RETRIES) {
        // Exceeded retry limit - mark as failed
        await db
            .update(schema.smsOutboundMessages)
            .set({
                deliveryStatus: "failed",
                errorMessage: "Exceeded maximum retry attempts",
            })
            .where(eq(schema.smsOutboundMessages.id, messageId));

        logger.warn(
            { messageId, retryCount: message.retryCount },
            "SMS notification failed after max retries"
        );

        return false;
    }

    const retryDelay = calculateRetryDelay(message.retryCount);
    const nextRetryAt = new Date(Date.now() + retryDelay);

    await db
        .update(schema.smsOutboundMessages)
        .set({
            retryCount: message.retryCount + 1,
            nextRetryAt,
        })
        .where(eq(schema.smsOutboundMessages.id, messageId));

    logger.info(
        { messageId, retryCount: message.retryCount + 1, nextRetryAt },
        "📅 SMS notification queued for retry"
    );

    return true;
}

/**
 * Process the retry queue
 *
 * Called by a background job (e.g., Temporal workflow or cron).
 * Finds messages that need retry and attempts to resend them.
 */
export async function processRetryQueue(): Promise<number> {
    const now = new Date();

    // Find messages ready for retry (queued with nextRetryAt in the past)
    const messages = await db.query.smsOutboundMessages.findMany({
        where: and(
            eq(schema.smsOutboundMessages.deliveryStatus, "queued"),
            isNotNull(schema.smsOutboundMessages.nextRetryAt),
            lte(schema.smsOutboundMessages.nextRetryAt, now)
        ),
        limit: 10, // Process in batches
    });

    let processed = 0;

    for (const message of messages) {
        try {
            assertEnv(env.QUO_NOTIFICATION_API_KEY, "QUO_NOTIFICATION_API_KEY");
            const apiKey = env.QUO_NOTIFICATION_API_KEY;

            await waitForRateLimit();

            const response = await httpClient
                .post(`${QUO_API_BASE}/messages`, {
                    headers: buildHeaders(apiKey),
                    json: {
                        from: message.fromPhone,
                        to: [message.toPhone],
                        content: message.content,
                    },
                })
                .json<{ id: string }>();

            await db
                .update(schema.smsOutboundMessages)
                .set({
                    quoMessageId: response.id,
                    deliveryStatus: "sent",
                    sentAt: new Date(),
                    nextRetryAt: null,
                })
                .where(eq(schema.smsOutboundMessages.id, message.id));

            logger.info(
                { messageId: message.id, quoMessageId: response.id },
                "✅ SMS retry successful"
            );
            processed++;
        } catch (error) {
            // Log failure and queue for another retry
            logger.error(
                { error, messageId: message.id, retryCount: message.retryCount },
                "❌ SMS retry attempt failed"
            );

            Sentry.captureException(error, {
                tags: { component: "sms", action: "process_retry_queue" },
                extra: {
                    messageId: message.id,
                    retryCount: message.retryCount,
                    toPhone: message.toPhone,
                },
            });

            // Queue for retry - don't let this block processing other messages
            try {
                await queueForRetry(message.id);
            } catch (retryError) {
                logger.error(
                    { error: retryError, messageId: message.id },
                    "Failed to queue message for retry in processRetryQueue"
                );
            }
        }
    }

    return processed;
}

/**
 * Update delivery status from webhook
 *
 * Called when we receive a message.delivered webhook from Quo.
 */
export async function updateDeliveryStatus(
    quoMessageId: string,
    status: "delivered" | "failed",
    errorMessage?: string
): Promise<void> {
    const updates: Partial<typeof schema.smsOutboundMessages.$inferInsert> = {
        deliveryStatus: status,
    };

    if (status === "delivered") {
        updates.deliveredAt = new Date();
    } else if (errorMessage) {
        updates.errorMessage = errorMessage;
    }

    const result = await db
        .update(schema.smsOutboundMessages)
        .set(updates)
        .where(eq(schema.smsOutboundMessages.quoMessageId, quoMessageId))
        .returning({ id: schema.smsOutboundMessages.id });

    if (result.length === 0) {
        logger.warn(
            { quoMessageId, status },
            "📬 Delivery webhook for unknown message (no matching quoMessageId)"
        );
    } else {
        logger.info({ quoMessageId, status }, `📬 SMS delivery status updated`);
    }
}

/**
 * Mark a message as replied to
 *
 * Called when we receive an inbound message that matches context routing.
 */
export async function markAsReplied(messageId: number): Promise<void> {
    await db
        .update(schema.smsOutboundMessages)
        .set({ repliedAt: new Date() })
        .where(eq(schema.smsOutboundMessages.id, messageId));
}
