import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
    convertToModelMessages,
    streamText,
    tool,
    stepCountIs,
    type UIMessage,
} from "ai";
import { z } from "zod";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

const MODEL_ID = "anthropic/claude-sonnet-4.5";

/**
 * Tools available to the AI for generating purpose-built UI responses
 */
const tools = {
    getWeather: tool({
        description:
            "Get current weather for a location. Use this when the user asks about weather.",
        inputSchema: z.object({
            location: z.string().describe("City name or location"),
        }),
        execute: async ({ location }) => {
            // Mock weather data for demo - in production this would call a weather API
            const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"] as const;
            return {
                location,
                temperature: Math.floor(Math.random() * 25) + 10,
                condition: conditions[Math.floor(Math.random() * conditions.length)],
                humidity: Math.floor(Math.random() * 40) + 40,
                windSpeed: Math.floor(Math.random() * 20) + 5,
            };
        },
    }),

    compareOptions: tool({
        description:
            "Compare multiple options in a table format. Use this when the user wants to compare products, services, or alternatives.",
        inputSchema: z.object({
            title: z.string().describe("Title for the comparison"),
            options: z
                .array(
                    z.object({
                        name: z.string().describe("Name of the option"),
                        attributes: z
                            .record(z.string(), z.string())
                            .describe("Key-value pairs of attributes"),
                    })
                )
                .min(2)
                .describe("Options to compare (minimum 2)"),
        }),
        execute: async ({ title, options }) => {
            return { title, options };
        },
    }),
};

export async function POST(req: Request) {
    let userEmail: string | null = null;

    try {
        // Require authentication for connect API
        const user = await currentUser();
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Email is guaranteed by Clerk - it's required for all auth methods we support
        userEmail = user.emailAddresses[0]?.emailAddress ?? null;

        assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

        const openrouter = createOpenRouter({
            apiKey: env.OPENROUTER_API_KEY,
        });

        const { messages } = (await req.json()) as { messages: UIMessage[] };

        logger.info(
            { userEmail, messageCount: messages?.length ?? 0, model: MODEL_ID },
            "Starting connect stream"
        );

        // Add breadcrumb for Sentry tracing
        Sentry.addBreadcrumb({
            category: "ai.connect",
            message: "Starting LLM request",
            level: "info",
            data: {
                userEmail,
                model: MODEL_ID,
                messageCount: messages?.length ?? 0,
            },
        });

        const result = await streamText({
            model: openrouter.chat(MODEL_ID),
            system: SYSTEM_PROMPT,
            messages: convertToModelMessages(messages),
            tools,
            stopWhen: stepCountIs(5), // Allow up to 5 steps for multi-step tool usage
            // Enable Sentry LLM tracing via Vercel AI SDK telemetry
            experimental_telemetry: {
                isEnabled: true,
                functionId: "connect",
                // Record inputs/outputs for debugging (be mindful of PII)
                recordInputs: true,
                recordOutputs: true,
                metadata: {
                    userEmail,
                    model: MODEL_ID,
                },
            },
        });

        logger.debug(
            { messageCount: messages?.length ?? 0 },
            "Connect stream initiated"
        );

        return result.toUIMessageStreamResponse({
            originalMessages: messages,
        });
    } catch (error) {
        // Log and report error with user context when available
        logger.error({ error, userEmail }, "Connect request failed");
        Sentry.captureException(error, {
            tags: {
                component: "api",
                route: "connect",
            },
            extra: {
                userEmail,
            },
        });

        // Return user-friendly error response
        return new Response(
            JSON.stringify({
                error: "Failed to process connect request. Please try again.",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
