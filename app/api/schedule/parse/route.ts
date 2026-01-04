/**
 * Schedule Parsing API
 *
 * POST /api/schedule/parse - Parse natural language schedule descriptions
 *
 * Uses LLM to convert natural language like "every weekday at 8am Austin time"
 * into cron expressions with human-readable display text.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import parser from "cron-parser";

import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { logger } from "@/lib/logger";

const requestSchema = z.object({
    input: z.string().min(1).max(500),
    currentTimezone: z.string().default("UTC"),
});

const scheduleSchema = z.object({
    cron: z
        .string()
        .describe(
            "5-part cron expression (minute hour day-of-month month day-of-week)"
        ),
    displayText: z
        .string()
        .describe("Human-readable schedule description with timezone abbreviation"),
    timezone: z
        .string()
        .describe("IANA timezone identifier (e.g., America/Chicago, UTC)"),
});

const SYSTEM_PROMPT = `You are a schedule parser that converts natural language schedule descriptions into cron expressions.

<rules>
1. Output valid 5-part cron expressions (minute hour day-of-month month day-of-week)
2. Never output cron that runs more than once per minute (minute field cannot be *)
3. Parse timezone from the input if mentioned, otherwise use the provided currentTimezone
4. Generate a human-readable displayText that includes the timezone abbreviation

Common timezone mappings:
- "Austin time", "CT", "Central" → America/Chicago
- "NYC time", "ET", "Eastern" → America/New_York
- "LA time", "PT", "Pacific" → America/Los_Angeles
- "London", "GMT", "BST" → Europe/London
- "UTC" → UTC

Common schedule patterns:
- "every morning" → 0 9 * * * (9am daily)
- "business hours" → refers to 9am-5pm Mon-Fri schedule
- "weekdays" → Mon-Fri (day-of-week: 1-5)
- "every Monday" → day-of-week: 1
- "twice daily" → could be 9am and 5pm
</rules>

<examples>
Input: "every weekday at 8am Austin time"
Output: { cron: "0 8 * * 1-5", displayText: "Every weekday at 8am CT", timezone: "America/Chicago" }

Input: "every morning at 7am"
Output: { cron: "0 7 * * *", displayText: "Every day at 7am", timezone: "{currentTimezone}" }

Input: "monthly on the first"
Output: { cron: "0 9 1 * *", displayText: "First of each month at 9am", timezone: "{currentTimezone}" }

Input: "every 2 hours during business hours"
Output: { cron: "0 9,11,13,15,17 * * 1-5", displayText: "Every 2 hours 9am-5pm weekdays", timezone: "{currentTimezone}" }
</examples>`;

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { input, currentTimezone } = requestSchema.parse(body);

        const gateway = getGatewayClient();

        const result = await generateObject({
            model: gateway(translateModelId("anthropic/claude-sonnet-4")),
            schema: scheduleSchema,
            prompt: `Parse this schedule: "${input}"\n\nCurrent timezone if not specified: ${currentTimezone}`,
            system: SYSTEM_PROMPT.replace("{currentTimezone}", currentTimezone),
            providerOptions: {
                gateway: {
                    models: [
                        "anthropic/claude-sonnet-4",
                        "anthropic/claude-3-5-sonnet-20241022",
                    ].map(translateModelId),
                },
            },
        });

        const { cron, displayText, timezone } = result.object;

        // Validate the cron expression
        const parts = cron.trim().split(/\s+/);
        if (parts.length !== 5) {
            throw new Error("Invalid cron expression generated");
        }

        // Reject expressions that run every minute
        if (parts[0] === "*") {
            throw new Error("Schedule would run too frequently");
        }

        // Validate with cron-parser
        try {
            parser.parse(cron);
        } catch (error) {
            throw new Error(
                `Invalid cron expression: ${error instanceof Error ? error.message : "parsing failed"}`
            );
        }

        logger.info(
            { userId, input, cron, timezone },
            "Parsed natural language schedule"
        );

        return NextResponse.json({ cron, displayText, timezone });
    } catch (error) {
        logger.error({ error, userId }, "Failed to parse schedule");
        Sentry.captureException(error, {
            tags: { route: "/api/schedule/parse", action: "parse" },
            extra: { userId },
        });

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not understand that schedule. Try something like 'every weekday at 9am'",
            },
            { status: 400 }
        );
    }
}
