/**
 * AI Team Hiring Wizard API
 *
 * Two-phase approach:
 * 1. Conversational: Understand what the user needs (no structured output)
 * 2. Extraction: When ready, use generateObject to extract the playbook
 *
 * The wizard signals readiness by including "READY_TO_HIRE" in its response.
 * We then make a separate structured extraction call.
 */

import { NextResponse } from "next/server";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { auth, currentUser } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";
import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { getConnectedServices } from "@/lib/integrations/connection-manager";

const requestSchema = z.object({
    messages: z.array(
        z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
        })
    ),
});

/**
 * Playbook schema for structured extraction
 */
const playbookSchema = z.object({
    name: z.string().describe("Short descriptive name for the automation"),
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
    requiredIntegrations: z
        .array(z.string())
        .describe("List of integration names needed, e.g., ['gmail', 'slack']"),
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
When you have enough information to create the automation, summarize what you understood and end your response with the exact phrase:

**Ready to hire your new team member!**

READY_TO_HIRE

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

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { messages } = requestSchema.parse(body);

        const user = await currentUser();
        const userEmail = user?.emailAddresses[0]?.emailAddress;

        // Get user's connected integrations
        let connectedIntegrations: string[] = [];
        if (userEmail) {
            try {
                connectedIntegrations = await getConnectedServices(userEmail);
            } catch {
                // Non-critical - continue without integration info
            }
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

        // Phase 1: Conversational response
        const result = await generateText({
            model: gateway(translateModelId("anthropic/claude-sonnet-4")),
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            providerOptions: {
                gateway: {
                    models: [
                        "anthropic/claude-sonnet-4",
                        "anthropic/claude-3-5-sonnet-20241022",
                    ].map(translateModelId),
                },
            },
        });

        // Check if wizard signaled readiness
        const isReady = result.text.includes("READY_TO_HIRE");
        let playbook = null;

        if (isReady) {
            // Phase 2: Structured extraction
            const conversationContext = messages
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n\n");

            const extraction = await generateObject({
                model: gateway(translateModelId("anthropic/claude-sonnet-4")),
                schema: playbookSchema,
                prompt: `${EXTRACTION_PROMPT}\n\nConversation:\n${conversationContext}\n\nAssistant's final response:\n${result.text}`,
                providerOptions: {
                    gateway: {
                        models: [
                            "anthropic/claude-sonnet-4",
                            "anthropic/claude-3-5-sonnet-20241022",
                        ].map(translateModelId),
                    },
                },
            });

            playbook = extraction.object;
        }

        // Clean up the response - remove the READY_TO_HIRE marker
        const cleanContent = result.text.replace(/\n*READY_TO_HIRE\n*/g, "").trim();

        logger.info(
            {
                userId,
                messageCount: messages.length,
                hasPlaybook: !!playbook,
            },
            "Hiring wizard response generated"
        );

        return NextResponse.json({
            content: cleanContent,
            playbook,
        });
    } catch (error) {
        logger.error({ error }, "Hiring wizard error");
        Sentry.captureException(error, {
            tags: { route: "/api/ai-team/hire", action: "generate" },
        });

        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}
