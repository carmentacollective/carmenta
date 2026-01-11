/**
 * Push Notification Service
 *
 * Sends PWA push notifications to users' subscribed devices.
 * Uses the Web Push protocol with VAPID authentication.
 *
 * Features:
 * - Multi-device support (sends to all active subscriptions)
 * - Automatic subscription cleanup on 410 Gone (expired)
 * - Graceful degradation (continues if some devices fail)
 * - Sentry tracking for failures
 */

import * as Sentry from "@sentry/nextjs";
import webpush from "web-push";

import {
    getActiveSubscriptions,
    deactivateSubscription,
} from "@/lib/db/push-subscriptions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Notification payload - matches service worker expectations
 */
export interface PushNotificationPayload {
    /** Notification title */
    title: string;
    /** Notification body text */
    body: string;
    /** URL to navigate to when clicked */
    url?: string;
    /** Icon URL (defaults to Carmenta logo) */
    icon?: string;
    /** Action buttons */
    actions?: Array<{ action: string; title: string }>;
    /** Additional data passed to service worker */
    data?: Record<string, unknown>;
}

/**
 * Send notification parameters
 */
export interface SendPushParams {
    /** Recipient user email */
    userEmail: string;
    /** Notification content */
    notification: PushNotificationPayload;
}

/**
 * Send result for a single subscription
 */
interface SubscriptionResult {
    endpoint: string;
    success: boolean;
    error?: string;
}

/**
 * Send notification result
 */
export interface SendPushResult {
    success: boolean;
    /** Number of devices notified successfully */
    devicesNotified: number;
    /** Total number of active subscriptions */
    totalSubscriptions: number;
    /** Per-subscription results (for debugging) */
    results: SubscriptionResult[];
    /** Error message if complete failure */
    error?: string;
}

/**
 * VAPID configuration state (cached for performance)
 * - null: not yet checked
 * - true: configured successfully
 * - false: missing required env vars, feature disabled
 *
 * Intentionally cached to avoid repeated env var checks on each notification.
 * Assumes VAPID keys don't change at runtime (true for typical deployments).
 */
let vapidConfigured: boolean | null = null;

/**
 * Attempt to configure VAPID details for web-push
 * Returns false if env vars are missing (graceful degradation)
 */
function ensureVapidConfigured(): boolean {
    if (vapidConfigured !== null) return vapidConfigured;

    // Check all required env vars are present
    if (
        !env.VAPID_PRIVATE_KEY ||
        !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        !env.VAPID_SUBJECT_EMAIL
    ) {
        logger.info(
            "Push notifications disabled: VAPID keys not configured. " +
                "Set VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_SUBJECT_EMAIL to enable."
        );
        vapidConfigured = false;
        return false;
    }

    webpush.setVapidDetails(
        `mailto:${env.VAPID_SUBJECT_EMAIL}`,
        env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );

    vapidConfigured = true;
    logger.info("Web Push VAPID configured");
    return true;
}

/**
 * Send a push notification to all of a user's subscribed devices
 *
 * This is the main entry point for sending push notifications.
 * It handles:
 * - Looking up all active subscriptions for the user
 * - Sending to each device in parallel
 * - Cleaning up expired subscriptions (410 Gone)
 * - Graceful failure (some devices may fail, others succeed)
 */
export async function sendPushNotification(
    params: SendPushParams
): Promise<SendPushResult> {
    const { userEmail, notification } = params;

    const requestLogger = logger.child({
        userEmail,
        notificationTitle: notification.title,
    });

    return Sentry.startSpan(
        {
            op: "push.send",
            name: "PushNotificationService.sendPushNotification",
        },
        async (span) => {
            span.setAttribute("push.user_email", userEmail);
            span.setAttribute("push.title", notification.title);

            try {
                // Configure VAPID if not already done - gracefully degrade if not configured
                if (!ensureVapidConfigured()) {
                    return {
                        success: false,
                        devicesNotified: 0,
                        totalSubscriptions: 0,
                        results: [],
                        error: "Push notifications not configured (missing VAPID keys)",
                    };
                }

                // Get all active subscriptions for the user
                const subscriptions = await getActiveSubscriptions(userEmail);

                if (subscriptions.length === 0) {
                    requestLogger.debug("No active push subscriptions for user");
                    return {
                        success: false,
                        devicesNotified: 0,
                        totalSubscriptions: 0,
                        results: [],
                        error: "No active push subscriptions",
                    };
                }

                span.setAttribute("push.subscription_count", subscriptions.length);

                // Prepare payload
                const payload = JSON.stringify({
                    title: notification.title,
                    body: notification.body,
                    icon: notification.icon ?? "/logos/icon-transparent-192.png",
                    url: notification.url ?? "/",
                    actions: notification.actions ?? [],
                    ...notification.data,
                });

                // Send to all subscriptions in parallel
                const results = await Promise.all(
                    subscriptions.map(async (sub): Promise<SubscriptionResult> => {
                        try {
                            await webpush.sendNotification(sub.subscription, payload);

                            return {
                                endpoint: sub.endpoint,
                                success: true,
                            };
                        } catch (error) {
                            const webPushError = error as { statusCode?: number };

                            // 410 Gone = subscription expired, clean it up
                            if (webPushError.statusCode === 410) {
                                requestLogger.info(
                                    { endpoint: sub.endpoint },
                                    "Push subscription expired (410), deactivating"
                                );
                                try {
                                    await deactivateSubscription(sub.endpoint);
                                } catch (cleanupError) {
                                    requestLogger.error(
                                        { error: cleanupError, endpoint: sub.endpoint },
                                        "Failed to deactivate expired subscription"
                                    );
                                }
                                return {
                                    endpoint: sub.endpoint,
                                    success: false,
                                    error: "Subscription expired",
                                };
                            }

                            // 404 = subscription not found on push service
                            if (webPushError.statusCode === 404) {
                                requestLogger.info(
                                    { endpoint: sub.endpoint },
                                    "Push subscription not found (404), deactivating"
                                );
                                try {
                                    await deactivateSubscription(sub.endpoint);
                                } catch (cleanupError) {
                                    requestLogger.error(
                                        { error: cleanupError, endpoint: sub.endpoint },
                                        "Failed to deactivate not-found subscription"
                                    );
                                }
                                return {
                                    endpoint: sub.endpoint,
                                    success: false,
                                    error: "Subscription not found",
                                };
                            }

                            // Other errors - log but don't deactivate
                            requestLogger.error(
                                { error, endpoint: sub.endpoint },
                                "Failed to send push notification to device"
                            );

                            return {
                                endpoint: sub.endpoint,
                                success: false,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : "Unknown error",
                            };
                        }
                    })
                );

                const successCount = results.filter((r) => r.success).length;

                span.setAttribute("push.devices_notified", successCount);

                if (successCount > 0) {
                    requestLogger.info(
                        {
                            devicesNotified: successCount,
                            totalSubscriptions: subscriptions.length,
                        },
                        "🔔 Push notifications sent"
                    );
                } else {
                    requestLogger.warn(
                        {
                            totalSubscriptions: subscriptions.length,
                            errors: results.map((r) => r.error).filter(Boolean),
                        },
                        "⚠️ All push notifications failed"
                    );
                }

                span.setStatus({ code: successCount > 0 ? 1 : 2 });

                return {
                    success: successCount > 0,
                    devicesNotified: successCount,
                    totalSubscriptions: subscriptions.length,
                    results,
                };
            } catch (error) {
                requestLogger.error({ error }, "❌ Failed to send push notifications");

                Sentry.captureException(error, {
                    tags: { component: "push", action: "send_notification" },
                    extra: { userEmail, notification },
                });

                span.setStatus({ code: 2, message: "error" });

                return {
                    success: false,
                    devicesNotified: 0,
                    totalSubscriptions: 0,
                    results: [],
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        }
    );
}

/**
 * Check if push notifications are configured
 * Returns false if VAPID keys are not set
 */
export function isPushConfigured(): boolean {
    return !!(
        env.VAPID_PRIVATE_KEY &&
        env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        env.VAPID_SUBJECT_EMAIL
    );
}
