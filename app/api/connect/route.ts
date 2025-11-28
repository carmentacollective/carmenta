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
 * Request body schema for validation
 */
const requestSchema = z.object({
    messages: z.array(z.any()).min(1, "At least one message is required"),
});

/**
 * Mock weather data ranges - in production these would come from a real API
 */
const MOCK_WEATHER = {
    TEMP_MIN: 10,
    TEMP_RANGE: 25,
    HUMIDITY_MIN: 40,
    HUMIDITY_RANGE: 40,
    WIND_MIN: 5,
    WIND_RANGE: 20,
    CONDITIONS: ["sunny", "cloudy", "rainy", "partly cloudy"] as const,
};

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
            return {
                location,
                temperature:
                    Math.floor(Math.random() * MOCK_WEATHER.TEMP_RANGE) +
                    MOCK_WEATHER.TEMP_MIN,
                condition:
                    MOCK_WEATHER.CONDITIONS[
                        Math.floor(Math.random() * MOCK_WEATHER.CONDITIONS.length)
                    ],
                humidity:
                    Math.floor(Math.random() * MOCK_WEATHER.HUMIDITY_RANGE) +
                    MOCK_WEATHER.HUMIDITY_MIN,
                windSpeed:
                    Math.floor(Math.random() * MOCK_WEATHER.WIND_RANGE) +
                    MOCK_WEATHER.WIND_MIN,
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

        // Validate request body
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
            logger.warn(
                { userEmail, error: parseResult.error.flatten() },
                "Invalid request body"
            );
            return new Response(
                JSON.stringify({
                    error: "We couldn't understand that request. Mind trying again?",
                    details: parseResult.error.flatten(),
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const { messages } = parseResult.data as { messages: UIMessage[] };

        logger.info(
            {
                userEmail,
                messageCount: messages.length,
                model: MODEL_ID,
                toolsAvailable: Object.keys(tools),
            },
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
        // Extract detailed error info
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : "Unknown";
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Log detailed error for debugging
        logger.error(
            {
                error: errorMessage,
                errorName,
                errorStack,
                userEmail,
                model: MODEL_ID,
            },
            "❌ Connect request failed"
        );

        Sentry.captureException(error, {
            tags: {
                component: "api",
                route: "connect",
                errorName,
            },
            extra: {
                userEmail,
                model: MODEL_ID,
                errorMessage,
            },
        });

        // Return error response with details (safe for client)
        return new Response(
            JSON.stringify({
                error: "We hit a snag processing that. Let's try again.",
                // Include error type for debugging (not the full message which might contain sensitive info)
                errorType: errorName,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
