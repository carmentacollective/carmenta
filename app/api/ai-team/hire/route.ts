/**
 * AI Team Hiring Wizard API
 *
 * Conversational interface for creating new automations.
 * Uses AI to understand user needs and generate a structured playbook.
 */

import { NextResponse } from "next/server";
import { generateText } from "ai";
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
 * System prompt for the hiring wizard
 */
const HIRING_WIZARD_PROMPT = `You are Carmenta's hiring wizard, helping users create AI automations.

<your-role>
You help users describe what they need automated, then generate a structured playbook they can "hire" as a team member.

Guide users conversationally to understand:
1. What task they want automated (email triage, news monitoring, etc.)
2. How often it should run (daily, hourly, weekly)
3. What actions to take (summarize, flag important, notify, etc.)
4. What integrations are needed
</your-role>

<connected-integrations>
The user has connected: {{INTEGRATIONS}}
</connected-integrations>

<response-format>
When you have enough information to create an automation, respond with the playbook in this format:

**Ready to hire your new team member!**

**Name:** [Short descriptive name]
**Schedule:** [Human readable, e.g., "Every morning at 9am"]
**What it does:** [1-2 sentence description]

Here's the detailed playbook:

\`\`\`json
{
  "name": "Email Triage Assistant",
  "description": "Reviews your inbox and flags important messages",
  "schedule": {
    "cron": "0 9 * * *",
    "displayText": "Every morning at 9am"
  },
  "prompt": "Check my email inbox and identify messages that need immediate attention. Look for: urgent requests, messages from important contacts, time-sensitive items. Create a summary of top 3-5 items I should address first.",
  "requiredIntegrations": ["gmail"]
}
\`\`\`

Does this look right? Click "Hire This Team Member" to get started, or tell me if you'd like to adjust anything.
</response-format>

<cron-reference>
Common cron patterns:
- "0 9 * * *" = Every day at 9am
- "0 9 * * 1-5" = Weekdays at 9am
- "0 */2 * * *" = Every 2 hours
- "0 9 * * 1" = Every Monday at 9am
- "0 9,17 * * *" = Twice daily (9am and 5pm)
</cron-reference>

<conversation-style>
- Be warm and conversational
- Ask clarifying questions one at a time
- Suggest common patterns based on what they describe
- Use "we" language (e.g., "We can set that up to...")
- Keep responses concise (2-4 paragraphs max)
</conversation-style>`;

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

        // Try to extract playbook from response
        let playbook = null;
        const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                playbook = JSON.parse(jsonMatch[1]);
            } catch {
                // Parsing failed, that's okay - user can continue conversation
            }
        }

        logger.info(
            {
                userId,
                messageCount: messages.length,
                hasPlaybook: !!playbook,
            },
            "Hiring wizard response generated"
        );

        return NextResponse.json({
            content: result.text,
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
