/**
 * SMS User Tool for DCOS
 *
 * Enables Carmenta to proactively text users via SMS.
 * This is system-level messaging - Carmenta reaching out, not just responding.
 *
 * Uses QuoNotificationService under the hood with dedicated API key.
 * Requires user to have a verified, opted-in phone number.
 */

import { tool } from "ai";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/sms/quo-notification-service";
import {
    type SubagentResult,
    type SubagentDescription,
    type SubagentContext,
    successResult,
    errorResult,
} from "@/lib/ai-team/dcos/types";
import { safeInvoke } from "@/lib/ai-team/dcos/utils";

const TOOL_ID = "smsUser";

/**
 * Describe tool operations for progressive disclosure
 */
function describeOperations(): SubagentDescription {
    return {
        id: TOOL_ID,
        name: "SMS User",
        summary:
            "Text them via SMS. Use when there's something important to share proactively - agent results, alerts, reminders.",
        operations: [
            {
                name: "send",
                description:
                    "Send an SMS to their verified phone number. Keep messages brief (1-2 segments, ~160-320 chars). Requires a verified, opted-in phone number.",
                params: [
                    {
                        name: "message",
                        type: "string",
                        description:
                            "The SMS content. Keep it conversational and brief - SMS isn't email.",
                        required: true,
                    },
                    {
                        name: "reason",
                        type: "string",
                        description:
                            "Why you're texting: briefing, alert, reminder, or agent. Helps with routing.",
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
    messageId?: number;
    quoMessageId?: string;
}

/**
 * Execute send action
 */
async function executeSend(
    params: { message: string; reason?: string },
    context: SubagentContext
): Promise<SubagentResult<SendData>> {
    const { message, reason } = params;

    // Map reason to source type
    const sourceMap: Record<
        string,
        "briefing" | "alert" | "reminder" | "scheduled_agent"
    > = {
        briefing: "briefing",
        alert: "alert",
        reminder: "reminder",
        agent: "scheduled_agent",
        scheduled: "scheduled_agent",
    };

    const source = sourceMap[reason?.toLowerCase() ?? ""] ?? "alert";

    const result = await sendNotification({
        userEmail: context.userEmail,
        content: message,
        source,
    });

    if (!result.success) {
        logger.warn(
            {
                userEmail: context.userEmail,
                error: result.error,
            },
            "📱 SMS failed - user may not have verified phone"
        );

        return errorResult(
            "VALIDATION",
            result.error ??
                "No verified phone number on file. They'll need to add one in settings."
        );
    }

    logger.info(
        {
            userEmail: context.userEmail,
            messageId: result.messageId,
            quoMessageId: result.quoMessageId,
            source,
        },
        "📱 SMS sent"
    );

    return successResult<SendData>({
        sent: true,
        messageId: result.messageId,
        quoMessageId: result.quoMessageId,
    });
}

/**
 * Tool input schema
 */
const smsUserSchema = z.object({
    action: z
        .enum(["describe", "send"])
        .describe("Operation to perform. Use 'describe' to see full documentation."),
    message: z
        .string()
        .optional()
        .describe("SMS content. Keep brief - aim for 1-2 segments (160-320 chars)."),
    reason: z
        .string()
        .optional()
        .describe("Why you're texting: briefing, alert, reminder, or agent."),
});

type SmsUserAction = z.infer<typeof smsUserSchema>;

/**
 * Validate required fields
 */
function validateParams(
    params: SmsUserAction
): { valid: true } | { valid: false; error: string } {
    if (params.action === "describe") {
        return { valid: true };
    }

    if (params.action === "send") {
        if (!params.message) {
            return { valid: false, error: "message is required for send" };
        }
        if (params.message.length > 1600) {
            return {
                valid: false,
                error: "message too long - keep under 1600 chars (10 segments max)",
            };
        }
        return { valid: true };
    }

    return { valid: false, error: `Unknown action: ${params.action}` };
}

/**
 * Create the smsUser tool for DCOS
 *
 * Enables Carmenta to text users proactively via SMS.
 * Uses progressive disclosure - call with action='describe' for full docs.
 */
export function createSmsUserTool(context: SubagentContext) {
    return tool({
        description:
            "Text them via SMS. Use when there's something important to share proactively. Requires a verified phone number.",
        inputSchema: smsUserSchema,
        execute: async (params: SmsUserAction) => {
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
                            { message: params.message!, reason: params.reason },
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
