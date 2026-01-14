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
 * Failure reason categories for LLM decision-making
 */
export type FailureReason =
    | "subscription_expired" // User needs to re-subscribe
    | "subscription_not_found" // Browser cleared data
    | "network_error" // Temporary, worth retrying
    | "push_service_error" // Push service issue
    | "unknown";

/**
 * Send result for a single subscription
 */
export interface SubscriptionResult {
    endpoint: string;
    success: boolean;
    deviceType: string | null;
    error?: string;
    failureReason?: FailureReason;
}

/**
 * Send notification result - enriched for LLM decision-making
 */
export interface SendPushResult {
    success: boolean;
    /** Number of devices notified successfully */
    devicesNotified: number;
    /** Total number of active subscriptions */
    totalSubscriptions: number;
    /** Device types that received the notification */
    deviceTypesNotified: string[];
    /** Device types that failed */
    deviceTypesFailed: string[];
    /** Categorized failure reasons (deduped) */
    failureReasons: FailureReason[];
    /** Per-subscription results (for debugging) */
    results: SubscriptionResult[];
    /** Error message if complete failure */
    error?: string;
    /** ISO timestamp when notification was sent */
    sentAt: string;
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
                const sentAt = new Date().toISOString();

                // Configure VAPID if not already done - gracefully degrade if not configured
                if (!ensureVapidConfigured()) {
                    return {
                        success: false,
                        devicesNotified: 0,
                        totalSubscriptions: 0,
                        deviceTypesNotified: [],
                        deviceTypesFailed: [],
                        failureReasons: [],
                        results: [],
                        error: "Push notifications not configured (missing VAPID keys)",
                        sentAt,
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
                        deviceTypesNotified: [],
                        deviceTypesFailed: [],
                        failureReasons: [],
                        results: [],
                        error: "No active push subscriptions",
                        sentAt,
                    };
                }

                span.setAttribute("push.subscription_count", subscriptions.length);

                // Prepare payload (spread data first so explicit fields take precedence)
                const payload = JSON.stringify({
                    ...notification.data,
                    title: notification.title,
                    body: notification.body,
                    icon: notification.icon ?? "/logos/icon-transparent-192.png",
                    url: notification.url ?? "/",
                    actions: notification.actions ?? [],
                });

                // Send to all subscriptions in parallel
                const results = await Promise.all(
                    subscriptions.map(async (sub): Promise<SubscriptionResult> => {
                        const deviceType = sub.deviceType;

                        try {
                            await webpush.sendNotification(sub.subscription, payload);

                            return {
                                endpoint: sub.endpoint,
                                success: true,
                                deviceType,
                            };
                        } catch (error) {
                            const webPushError = error as { statusCode?: number };

                            // 410 Gone = subscription expired, clean it up
                            if (webPushError.statusCode === 410) {
                                requestLogger.info(
                                    { endpoint: sub.endpoint, deviceType },
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
                                    deviceType,
                                    error: "Subscription expired",
                                    failureReason: "subscription_expired",
                                };
                            }

                            // 404 = subscription not found on push service
                            if (webPushError.statusCode === 404) {
                                requestLogger.info(
                                    { endpoint: sub.endpoint, deviceType },
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
                                    deviceType,
                                    error: "Subscription not found",
                                    failureReason: "subscription_not_found",
                                };
                            }

                            // Network errors are temporary
                            const errorMsg =
                                error instanceof Error
                                    ? error.message
                                    : "Unknown error";
                            const isNetworkError =
                                errorMsg.includes("ECONNREFUSED") ||
                                errorMsg.includes("ETIMEDOUT") ||
                                errorMsg.includes("ENOTFOUND") ||
                                errorMsg.includes("network") ||
                                errorMsg.includes("timeout");

                            // Other errors - log but don't deactivate
                            requestLogger.error(
                                { error, endpoint: sub.endpoint, deviceType },
                                "Failed to send push notification to device"
                            );

                            return {
                                endpoint: sub.endpoint,
                                success: false,
                                deviceType,
                                error: errorMsg,
                                failureReason: isNetworkError
                                    ? "network_error"
                                    : "push_service_error",
                            };
                        }
                    })
                );

                // Aggregate results for LLM feedback
                const successCount = results.filter((r) => r.success).length;
                const successResults = results.filter((r) => r.success);
                const failedResults = results.filter((r) => !r.success);

                // Unique device types that received the notification
                const deviceTypesNotified = [
                    ...new Set(
                        successResults
                            .map((r) => r.deviceType)
                            .filter((dt): dt is string => dt !== null)
                    ),
                ];

                // Unique device types that failed
                const deviceTypesFailed = [
                    ...new Set(
                        failedResults
                            .map((r) => r.deviceType)
                            .filter((dt): dt is string => dt !== null)
                    ),
                ];

                // Unique failure reasons
                const failureReasons = [
                    ...new Set(
                        failedResults
                            .map((r) => r.failureReason)
                            .filter((fr): fr is FailureReason => fr !== undefined)
                    ),
                ];

                span.setAttribute("push.devices_notified", successCount);
                span.setAttribute("push.device_types", deviceTypesNotified.join(","));

                if (successCount > 0) {
                    requestLogger.info(
                        {
                            devicesNotified: successCount,
                            totalSubscriptions: subscriptions.length,
                            deviceTypes: deviceTypesNotified,
                        },
                        "🔔 Push notifications sent"
                    );
                } else {
                    requestLogger.warn(
                        {
                            totalSubscriptions: subscriptions.length,
                            failureReasons,
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
                    deviceTypesNotified,
                    deviceTypesFailed,
                    failureReasons,
                    results,
                    sentAt,
                };
            } catch (error) {
                const sentAt = new Date().toISOString();
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
                    deviceTypesNotified: [],
                    deviceTypesFailed: [],
                    failureReasons: [],
                    results: [],
                    error: error instanceof Error ? error.message : "Unknown error",
                    sentAt,
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
