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

import { runConcierge, CONCIERGE_DEFAULTS } from "@/lib/concierge";
import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";
import { getWebIntelligenceProvider } from "@/lib/web-intelligence";

/**
 * Route segment config for Vercel
 * Deep research can take up to 120 seconds - requires Vercel Pro or higher
 */
export const maxDuration = 120;

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

    webSearch: tool({
        description:
            "Search the web for current information. Use when you need fresh data, recent news, or to verify facts. Returns concise results with snippets and URLs.",
        inputSchema: z.object({
            query: z
                .string()
                .describe("The search query. Be specific and include key terms."),
            maxResults: z
                .number()
                .min(1)
                .max(20)
                .optional()
                .describe("Maximum number of results to return (default: 5)."),
        }),
        execute: async ({ query, maxResults }) => {
            const provider = getWebIntelligenceProvider();
            const result = await provider.search(query, { maxResults });

            if (!result) {
                return {
                    error: true,
                    message: "Search failed. Please try again.",
                    results: [],
                };
            }

            return {
                error: false,
                results: result.results,
                query: result.query,
            };
        },
    }),

    fetchPage: tool({
        description:
            "Fetch and extract the main content from a web page. Returns clean, readable text without ads or navigation. Use when you have a specific URL to read. If warning is present, the extraction was partial - inform the user and work with other sources.",
        inputSchema: z.object({
            url: z.string().url().describe("The URL to fetch content from."),
            maxLength: z
                .number()
                .optional()
                .describe(
                    "Maximum characters to return. Use for long pages where you only need the beginning."
                ),
        }),
        execute: async ({ url, maxLength }) => {
            const provider = getWebIntelligenceProvider();
            const result = await provider.extract(url, { maxLength });

            if (!result) {
                return {
                    error: true,
                    message:
                        "Failed to fetch page content. The page may be unavailable or blocked.",
                    title: "",
                    content: "",
                    url,
                };
            }

            // Surface warnings about partial/problematic extractions
            // so the AI can respond appropriately to the user
            if (result.warning) {
                return {
                    error: false,
                    warning: result.warning,
                    title: result.title,
                    content: result.content,
                    url: result.url,
                };
            }

            return {
                error: false,
                title: result.title,
                content: result.content,
                url: result.url,
            };
        },
    }),

    deepResearch: tool({
        description:
            "Conduct comprehensive research on a topic. Searches multiple sources, reads relevant pages, and synthesizes findings. Use for complex questions requiring thorough analysis. Takes 30-60 seconds.",
        inputSchema: z.object({
            objective: z
                .string()
                .describe(
                    "What you want to research. Be specific about the question or topic."
                ),
            depth: z
                .enum(["quick", "standard", "deep"])
                .optional()
                .describe(
                    '"quick" for basic overview, "standard" for solid analysis, "deep" for comprehensive investigation.'
                ),
            focusAreas: z
                .array(z.string())
                .optional()
                .describe("Specific aspects to focus on."),
        }),
        execute: async ({ objective, depth, focusAreas }) => {
            const provider = getWebIntelligenceProvider();
            const result = await provider.research(objective, { depth, focusAreas });

            if (!result) {
                return {
                    error: true,
                    message:
                        "Research failed. Please try again with a different query.",
                    summary: "",
                    findings: [],
                    sources: [],
                };
            }

            return {
                error: false,
                summary: result.summary,
                findings: result.findings,
                sources: result.sources,
            };
        },
    }),
};

export async function POST(req: Request) {
    let userEmail: string | null = null;

    try {
        // Authentication: required in production, optional in development
        // This allows git worktrees, forks, and local dev without Clerk setup
        const user = await currentUser();
        if (!user && process.env.NODE_ENV === "production") {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Use actual email if authenticated, fallback for development
        userEmail = user?.emailAddresses[0]?.emailAddress ?? "dev-user@local";

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

        // Run the Concierge to select model and temperature
        const concierge = await runConcierge(messages);

        logger.info(
            {
                userEmail,
                messageCount: messages.length,
                model: concierge.modelId,
                temperature: concierge.temperature,
                reasoning: concierge.reasoning,
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
                model: concierge.modelId,
                temperature: concierge.temperature,
                messageCount: messages?.length ?? 0,
            },
        });

        const result = await streamText({
            model: openrouter.chat(concierge.modelId),
            system: SYSTEM_PROMPT,
            messages: convertToModelMessages(messages),
            tools,
            temperature: concierge.temperature,
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
                    model: concierge.modelId,
                    temperature: concierge.temperature,
                },
            },
        });

        logger.debug(
            { messageCount: messages?.length ?? 0 },
            "Connect stream initiated"
        );

        // Get the stream response and add concierge headers
        const response = result.toUIMessageStreamResponse({
            originalMessages: messages,
        });

        // Clone headers and add concierge data
        const headers = new Headers(response.headers);
        headers.set("X-Concierge-Model-Id", concierge.modelId);
        headers.set("X-Concierge-Temperature", String(concierge.temperature));
        headers.set("X-Concierge-Reasoning", encodeURIComponent(concierge.reasoning));

        // Return response with concierge headers
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
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
                model: CONCIERGE_DEFAULTS.modelId,
            },
            "Connect request failed"
        );

        Sentry.captureException(error, {
            tags: {
                component: "api",
                route: "connect",
                errorName,
            },
            extra: {
                userEmail,
                model: CONCIERGE_DEFAULTS.modelId,
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
