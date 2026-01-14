/**
 * Push Notification Tool for DCOS
 *
 * Enables AI agents to send push notifications to users' iOS devices.
 * Primary use case: Scheduled agents (like email steward) alerting users
 * about important items that need attention.
 *
 * Requires user to have:
 * 1. Added Carmenta to their iOS Home Screen
 * 2. Granted notification permission
 * 3. Active push subscription
 *
 * Falls back gracefully when push isn't configured or user hasn't subscribed.
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { sendPushNotification, isPushConfigured } from "@/lib/push";
import type {
    SendPushResult,
    SubscriptionResult,
} from "@/lib/push/notification-service";
import {
    type SubagentResult,
    type SubagentDescription,
    type SubagentContext,
    successResult,
    errorResult,
} from "@/lib/ai-team/dcos/types";
import { safeInvoke } from "@/lib/ai-team/dcos/utils";

const TOOL_ID = "pushNotification";

/**
 * Describe tool operations for progressive disclosure
 */
function describeOperations(): SubagentDescription {
    return {
        id: TOOL_ID,
        name: "Push Notification",
        summary:
            "Send a push notification to their iOS device. Use for important alerts that need immediate attention.",
        operations: [
            {
                name: "send",
                description:
                    "Send a push notification. User must have Carmenta installed as PWA and notifications enabled. Keep titles short (50 chars) and body concise (100-150 chars).",
                params: [
                    {
                        name: "title",
                        type: "string",
                        description:
                            "Notification title. Short and attention-grabbing.",
                        required: true,
                    },
                    {
                        name: "body",
                        type: "string",
                        description:
                            "Notification body. Brief summary of what needs attention.",
                        required: true,
                    },
                    {
                        name: "url",
                        type: "string",
                        description:
                            "URL to open when notification is tapped (default: /). Use to deep-link to relevant content.",
                        required: false,
                    },
                ],
            },
        ],
    };
}

/**
 * Result data for send action - enriched for LLM decision-making
 */
interface SendData {
    /** Whether notification was successfully sent to at least one device */
    sent: boolean;
    /** Number of devices that received the notification */
    devicesNotified: number;
    /** Total active subscriptions for this user */
    totalSubscriptions: number;
    /** Device types that received the notification (e.g., ["ios", "mac"]) */
    deviceTypes: string[];
    /** Why some devices failed, if any (helps decide next steps) */
    failureReasons?: string[];
    /** ISO timestamp when notification was sent */
    sentAt: string;
    /** Guidance for what to do next based on the result */
    nextStep?: string;
}

/**
 * Determine next step guidance based on notification result
 */
function getNextStepGuidance(result: SendPushResult): string | undefined {
    if (result.success && result.devicesNotified === result.totalSubscriptions) {
        // Complete success
        return undefined;
    }

    if (result.success && result.devicesNotified < result.totalSubscriptions) {
        // Partial success - count failures by reason
        const failedCount = result.totalSubscriptions - result.devicesNotified;
        const expiredCount = result.results.filter(
            (r: SubscriptionResult) =>
                !r.success && r.failureReason === "subscription_expired"
        ).length;

        if (expiredCount > 0) {
            return `${expiredCount} device(s) had expired subscriptions. The notification reached their other devices.`;
        }
        return `Notification delivered to ${result.devicesNotified} of ${result.totalSubscriptions} devices.`;
    }

    // Complete failure
    if (result.failureReasons.includes("network_error")) {
        return "Network issue prevented delivery. Consider SMS as fallback for time-sensitive messages.";
    }
    if (
        result.failureReasons.includes("subscription_expired") ||
        result.failureReasons.includes("subscription_not_found")
    ) {
        return "All subscriptions expired. They'll need to re-enable notifications in Carmenta.";
    }

    return "Push delivery failed. Consider SMS for urgent messages.";
}

/**
 * Execute send action
 */
async function executeSend(
    params: { title: string; body: string; url?: string },
    context: SubagentContext
): Promise<SubagentResult<SendData>> {
    const { title, body, url } = params;

    // Check if push is configured server-side
    if (!isPushConfigured()) {
        logger.debug(
            { userEmail: context.userEmail },
            "🔔 Push not configured - skipping notification"
        );
        return errorResult(
            "PERMANENT",
            "Push notifications aren't set up on this server. Consider SMS as an alternative."
        );
    }

    try {
        const result = await sendPushNotification({
            userEmail: context.userEmail,
            notification: {
                title,
                body,
                url: url ?? "/",
            },
        });

        if (!result.success && result.totalSubscriptions === 0) {
            logger.debug(
                { userEmail: context.userEmail },
                "🔔 No push subscriptions - user may not have enabled notifications"
            );

            return errorResult(
                "PERMANENT",
                "They haven't enabled push notifications yet (no devices registered). Consider SMS for urgent messages."
            );
        }

        if (!result.success) {
            logger.warn(
                {
                    userEmail: context.userEmail,
                    error: result.error,
                    totalSubscriptions: result.totalSubscriptions,
                    failureReasons: result.failureReasons,
                },
                "🔔 Push notification failed to all devices"
            );

            const guidance = getNextStepGuidance(result);

            return errorResult(
                result.failureReasons.includes("network_error")
                    ? "TEMPORARY"
                    : "PERMANENT",
                guidance ?? result.error ?? "Push notification failed to send."
            );
        }

        logger.info(
            {
                userEmail: context.userEmail,
                devicesNotified: result.devicesNotified,
                totalSubscriptions: result.totalSubscriptions,
                deviceTypes: result.deviceTypesNotified,
                title,
            },
            "🔔 Push notification sent"
        );

        const nextStep = getNextStepGuidance(result);

        return successResult<SendData>({
            sent: true,
            devicesNotified: result.devicesNotified,
            totalSubscriptions: result.totalSubscriptions,
            deviceTypes: result.deviceTypesNotified,
            failureReasons:
                result.failureReasons.length > 0 ? result.failureReasons : undefined,
            sentAt: result.sentAt,
            nextStep,
        });
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail },
            "🔔 Push notification failed unexpectedly"
        );

        Sentry.captureException(error, {
            tags: { component: "pushNotification", action: "send" },
            extra: { userEmail: context.userEmail, title, bodyLength: body.length },
        });

        // Distinguish network/timeout errors (temporary) from other errors (permanent)
        const isNetworkError =
            error instanceof Error &&
            (error.message.includes("ECONNREFUSED") ||
                error.message.includes("ETIMEDOUT") ||
                error.message.includes("ENOTFOUND") ||
                error.message.includes("network") ||
                error.message.includes("timeout"));

        return errorResult(
            isNetworkError ? "TEMPORARY" : "PERMANENT",
            isNetworkError
                ? "Network issue prevented delivery. Consider SMS as fallback."
                : "Unexpected error sending notification. The team has been notified."
        );
    }
}

/**
 * Tool input schema
 */
const pushNotificationSchema = z.object({
    action: z
        .enum(["describe", "send"])
        .describe("Operation to perform. Use 'describe' to see full documentation."),
    title: z.string().optional().describe("Notification title. Keep short (50 chars)."),
    body: z
        .string()
        .optional()
        .describe("Notification body. Brief summary (100-150 chars)."),
    url: z.string().optional().describe("URL to open when tapped (default: /)."),
});

type PushNotificationAction = z.infer<typeof pushNotificationSchema>;

/**
 * Validate required fields
 */
function validateParams(
    params: PushNotificationAction
): { valid: true } | { valid: false; error: string } {
    if (params.action === "describe") {
        return { valid: true };
    }

    if (params.action === "send") {
        if (!params.title) {
            return { valid: false, error: "title is required for send" };
        }
        if (!params.body) {
            return { valid: false, error: "body is required for send" };
        }
        if (params.title.length > 100) {
            return {
                valid: false,
                error: "title too long - keep under 100 chars",
            };
        }
        if (params.body.length > 500) {
            return {
                valid: false,
                error: "body too long - keep under 500 chars for readability",
            };
        }
        return { valid: true };
    }

    return { valid: false, error: `Unknown action: ${params.action}` };
}

/**
 * Create the pushNotification tool for DCOS
 *
 * Enables AI agents to send push notifications to users' iOS devices.
 * Uses progressive disclosure - call with action='describe' for full docs.
 *
 * Best used for:
 * - Important emails needing attention (email steward)
 * - Completed background tasks
 * - Time-sensitive alerts
 *
 * Not ideal for:
 * - Routine updates (use in-app notifications)
 * - Non-urgent information (respect notification fatigue)
 */
export function createPushNotificationTool(context: SubagentContext) {
    return tool({
        description:
            "Send a push notification to their iOS device. Use for important alerts needing immediate attention.",
        inputSchema: pushNotificationSchema,
        execute: async (params: PushNotificationAction) => {
            if (params.action === "describe") {
                return describeOperations();
            }

            const validation = validateParams(params);
            if (!validation.valid) {
                return errorResult("VALIDATION", validation.error);
            }

            const result = await safeInvoke(
                TOOL_ID,
                params.action,
                async (ctx) => {
                    if (params.action === "send") {
                        return executeSend(
                            {
                                title: params.title!,
                                body: params.body!,
                                url: params.url,
                            },
                            ctx
                        );
                    }
                    return errorResult(
                        "VALIDATION",
                        `Unknown action: ${params.action}`
                    );
                },
                context
            );

            return result;
        },
    });
}
