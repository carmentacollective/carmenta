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
 * Result data for send action
 */
interface SendData {
    sent: boolean;
    devicesNotified: number;
    totalSubscriptions: number;
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
            "Push notifications aren't set up on this server. The notification wasn't sent, but you can continue."
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
                "They haven't enabled push notifications yet. The notification wasn't sent, but you can continue with other methods."
            );
        }

        if (!result.success) {
            logger.warn(
                {
                    userEmail: context.userEmail,
                    error: result.error,
                    totalSubscriptions: result.totalSubscriptions,
                },
                "🔔 Push notification failed to all devices"
            );

            return errorResult(
                "TEMPORARY",
                result.error ??
                    "Push notification failed to send. Try SMS as a fallback."
            );
        }

        logger.info(
            {
                userEmail: context.userEmail,
                devicesNotified: result.devicesNotified,
                totalSubscriptions: result.totalSubscriptions,
                title,
            },
            "🔔 Push notification sent"
        );

        return successResult<SendData>({
            sent: true,
            devicesNotified: result.devicesNotified,
            totalSubscriptions: result.totalSubscriptions,
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

        return errorResult(
            "PERMANENT",
            error instanceof Error
                ? `Notification couldn't go through: ${error.message}`
                : "Notification couldn't go through. The robots have been notified. 🤖"
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
