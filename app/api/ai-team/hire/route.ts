/**
 * AI Team Hiring Wizard API
 *
 * Streaming endpoint for the hire wizard. Two-phase approach:
 * 1. Conversational: Stream responses to understand what the user needs
 * 2. Extraction: When READY_TO_HIRE signal detected, extract playbook and emit as data part
 *
 * Compatible with useChat / ConnectRuntimeProvider for unified chat interface.
 */

import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    streamText,
    generateObject,
    type UIMessage,
} from "ai";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";

import { logger } from "@/lib/logger";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";
import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { getConnectedServices } from "@/lib/integrations/connection-manager";

export const maxDuration = 60;

/**
 * UIMessage schema for request validation
 */
const messageSchema = z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.unknown()).min(1),
}) as z.ZodType<UIMessage>;

const requestSchema = z.object({
    messages: z.array(messageSchema).min(1, "At least one message is required"),
});

/**
 * Playbook schema for structured extraction
 */
const playbookSchema = z.object({
    name: z
        .string()
        .describe(
            "Human-friendly display name (2-4 words, title case). Examples: 'Morning Email Digest', 'Team Update Monitor', 'Priority DM Alert'"
        ),
    description: z.string().describe("1-2 sentence description of what it does"),
    schedule: z.object({
        cron: z.string().describe("Cron expression, e.g., '0 9 * * *' for 9am daily"),
        displayText: z
            .string()
            .describe("Human readable schedule, e.g., 'Every morning at 9am'"),
    }),
    prompt: z
        .string()
        .describe("The detailed instructions for what the automation should do"),
});

/**
 * System prompt for the hiring wizard - purely conversational, no JSON
 */
const HIRING_WIZARD_PROMPT = `You are Carmenta's hiring wizard, helping users create AI automations.

<your-role>
Guide users conversationally to understand what they need automated. Ask clarifying questions to gather:
1. What task they want automated (email triage, news monitoring, etc.)
2. How often it should run (daily, hourly, weekly, specific times)
3. What actions to take (summarize, flag important, notify, etc.)
4. What integrations are needed
</your-role>

<connected-integrations>
The user has connected: {{INTEGRATIONS}}
</connected-integrations>

<when-ready>
When you have enough information to create the automation, summarize what you understood and end your response with:

**Ready to hire your new team member!**

Then on a new line, add this EXACT HTML comment (invisible to user but system detects it):
<!-- READY_TO_HIRE -->

This signals that you've gathered enough info. The system will then extract the details automatically.
</when-ready>

<cron-reference>
Common schedules you might suggest:
- Every morning at 9am (weekdays)
- Every 2 hours during work hours
- Every Monday morning
- Twice daily (morning and evening)
</cron-reference>

<conversation-style>
- Be warm and conversational
- Ask clarifying questions one at a time
- Suggest common patterns based on what they describe
- Use "we" language (e.g., "We can set that up to...")
- Keep responses concise (2-4 paragraphs max)
- NEVER output JSON or code blocks - keep it purely conversational
</conversation-style>`;

/**
 * System prompt for extracting playbook from conversation
 */
const EXTRACTION_PROMPT = `Extract the automation details from this conversation.
The user wants to create an AI team member to help with their task.
Based on the conversation, extract:
- A short, descriptive name
- What it does (description)
- When it should run (cron schedule)
- The detailed instructions (prompt) for the automation
- Which integrations are needed`;

/**
 * Helper to extract text content from UIMessage parts
 */
function getMessageText(message: UIMessage): string {
    if (!message.parts || !Array.isArray(message.parts)) return "";
    return message.parts
        .filter(
            (part): part is { type: "text"; text: string } =>
                typeof part === "object" &&
                part !== null &&
                "type" in part &&
                part.type === "text" &&
                "text" in part
        )
        .map((part) => part.text)
        .join("");
}

export async function POST(request: Request) {
    const { userId } = await auth();
    let userEmail: string | undefined;

    try {
        if (!userId) {
            return unauthorizedResponse();
        }

        const user = await currentUser();
        userEmail = user?.emailAddresses[0]?.emailAddress;

        if (!userEmail) {
            return validationErrorResponse(null, "Account missing email address");
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return validationErrorResponse(null, "Invalid JSON in request body");
        }

        const parseResult = requestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(parseResult.error.flatten());
        }

        const { messages } = parseResult.data;

        // Get user's connected integrations
        let connectedIntegrations: string[] = [];
        try {
            connectedIntegrations = await getConnectedServices(userEmail);
        } catch {
            // Non-critical - continue without integration info
        }

        const integrationList =
            connectedIntegrations.length > 0
                ? connectedIntegrations.join(", ")
                : "None yet (they can connect integrations later)";

        // Build system prompt with integration context
        const systemPrompt = HIRING_WIZARD_PROMPT.replace(
            "{{INTEGRATIONS}}",
            integrationList
        );

        const gateway = getGatewayClient();

        // Convert UIMessages to simple format for the model
        const simpleMessages = messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: getMessageText(m),
        }));

        logger.info(
            {
                userId,
                userEmail,
                messageCount: messages.length,
            },
            "Hiring wizard request received"
        );

        // Create streaming response
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                try {
                    // Stream the conversational response
                    const result = streamText({
                        model: gateway(translateModelId("anthropic/claude-sonnet-4.5")),
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...simpleMessages,
                        ],
                        providerOptions: {
                            gateway: {
                                models: [
                                    "anthropic/claude-sonnet-4.5",
                                    "google/gemini-3-pro-preview",
                                ].map(translateModelId),
                            },
                        },
                        onFinish: async ({ text }) => {
                            try {
                                // Check if wizard signaled readiness (HTML comment won't render)
                                const isReady = text.includes("<!-- READY_TO_HIRE -->");

                                if (isReady) {
                                    // Build conversation context for extraction
                                    const conversationContext = simpleMessages
                                        .map(
                                            (m) =>
                                                `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
                                        )
                                        .join("\n\n");

                                    // Extract playbook
                                    const extraction = await generateObject({
                                        model: gateway(
                                            translateModelId(
                                                "anthropic/claude-sonnet-4.5"
                                            )
                                        ),
                                        schema: playbookSchema,
                                        prompt: `${EXTRACTION_PROMPT}\n\nConversation:\n${conversationContext}\n\nAssistant's final response:\n${text}`,
                                        providerOptions: {
                                            gateway: {
                                                models: [
                                                    "anthropic/claude-sonnet-4.5",
                                                    "google/gemini-3-pro-preview",
                                                ].map(translateModelId),
                                            },
                                        },
                                    });

                                    // Emit playbook as data part
                                    writer.write({
                                        type: "data-playbook" as const,
                                        data: extraction.object,
                                    });

                                    logger.info(
                                        {
                                            userId,
                                            playbook: extraction.object.name,
                                        },
                                        "Playbook extracted from hiring conversation"
                                    );
                                }
                            } catch (extractionError) {
                                logger.error(
                                    { error: extractionError, userId },
                                    "Playbook extraction failed"
                                );
                                Sentry.captureException(extractionError, {
                                    tags: {
                                        route: "/api/ai-team/hire",
                                        action: "extract-playbook",
                                    },
                                    extra: { userId, userEmail },
                                });
                            }
                        },
                    });

                    // Merge the stream (READY_TO_HIRE marker is an HTML comment, won't render)
                    writer.merge(result.toUIMessageStream({ sendReasoning: false }));
                } catch (streamError) {
                    // Re-throw to outer catch which handles Sentry capture + error response
                    logger.error(
                        { error: streamError, userId },
                        "Stream execution failed"
                    );
                    throw streamError;
                }
            },
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        logger.error({ error, userId, userEmail }, "Hiring wizard error");
        Sentry.captureException(error, {
            tags: { route: "/api/ai-team/hire", action: "generate" },
            extra: { userId, userEmail },
        });

        return serverErrorResponse(error, {
            userEmail,
            route: "ai-team-hire",
        });
    }
}
