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
import { nanoid } from "nanoid";
import { z } from "zod";

import {
    runConcierge,
    CONCIERGE_DEFAULTS,
    type OpenRouterEffort,
} from "@/lib/concierge";
import {
    getOrCreateUser,
    createConnection,
    upsertMessage,
    updateStreamingStatus,
    type UIMessageLike,
} from "@/lib/db";
import { assertEnv, env } from "@/lib/env";
import { decodeConnectionId, encodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { getModel } from "@/lib/models";
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
    /** Connection ID - 6+ character Sqid (lowercase alphanumeric only) */
    connectionId: z
        .string()
        .regex(/^[0-9a-z]{6,}$/, "Invalid connection ID format")
        .optional(),
    /** User override for model - bypasses concierge selection */
    modelOverride: z.string().optional(),
    /** User override for temperature (0-1) - bypasses concierge selection */
    temperatureOverride: z.number().min(0).max(1).optional(),
    /** User override for reasoning level - bypasses concierge selection */
    reasoningOverride: z.enum(["none", "low", "medium", "high"]).optional(),
});

/**
 * Tools available to the AI for generating purpose-built UI responses
 */
const tools = {
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
    /** Internal numeric ID for database operations */
    let connectionId: number | null = null;
    /** Public Sqid for response headers */
    let connectionPublicId: string | null = null;

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

        const {
            messages,
            connectionId: existingConnectionId,
            modelOverride,
            temperatureOverride,
            reasoningOverride,
        } = parseResult.data as {
            messages: UIMessage[];
            connectionId?: string;
            modelOverride?: string;
            temperatureOverride?: number;
            reasoningOverride?: "none" | "low" | "medium" | "high";
        };

        // ========================================================================
        // PERSISTENCE: Get or create user and connection
        // ========================================================================

        // Ensure user exists in database
        // In development without auth, we use a dev user ID
        const dbUser = await getOrCreateUser(user?.id ?? "dev-user-id", userEmail!, {
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            displayName: user?.fullName ?? null,
            imageUrl: user?.imageUrl ?? null,
        });

        // Run the Concierge FIRST to get model selection AND title (for new connections)
        const conciergeResult = await runConcierge(messages);

        // Track if this is a new connection (for header response)
        let isNewConnection = false;
        let connectionSlug: string | null = null;

        // Get or create connection
        if (existingConnectionId) {
            // Decode Sqid string to internal integer ID
            connectionId = decodeConnectionId(existingConnectionId);
            if (connectionId === null) {
                return new Response(
                    JSON.stringify({ error: "Invalid connection ID" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }
            connectionPublicId = existingConnectionId;
        } else {
            // New connection - create it with title from concierge
            isNewConnection = true;
            try {
                const connection = await createConnection(
                    dbUser.id,
                    conciergeResult.title, // Title from concierge
                    conciergeResult.modelId
                );
                connectionId = connection.id;
                connectionPublicId = encodeConnectionId(connection.id);
                connectionSlug = connection.slug;
                logger.info(
                    {
                        connectionId,
                        publicId: connectionPublicId,
                        slug: connectionSlug,
                        title: conciergeResult.title,
                        userId: dbUser.id,
                    },
                    "Created new connection with title"
                );
            } catch (error) {
                logger.error(
                    { error, userId: dbUser.id, title: conciergeResult.title },
                    "Failed to create connection"
                );
                throw error;
            }
        }

        // Save the latest user message before streaming
        // (messages array may contain history, we only need to save new messages)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === "user") {
            await upsertMessage(connectionId, lastMessage as UIMessageLike);
        }

        // Mark connection as streaming
        await updateStreamingStatus(connectionId, "streaming");

        // Apply user overrides if provided (these take precedence over concierge)
        const hasOverrides =
            modelOverride || temperatureOverride !== undefined || reasoningOverride;

        // Map reasoning override to concierge format
        // Type matches the Zod enum from requestSchema.reasoningOverride
        type ReasoningLevel = "none" | "low" | "medium" | "high";
        const reasoningPresetMap: Record<
            ReasoningLevel,
            { enabled: boolean; maxTokens?: number; effort?: OpenRouterEffort }
        > = {
            none: { enabled: false },
            low: { enabled: true, maxTokens: 2048, effort: "low" },
            medium: { enabled: true, maxTokens: 8000, effort: "medium" },
            high: { enabled: true, maxTokens: 16000, effort: "high" },
        };

        const concierge = {
            modelId: modelOverride ?? conciergeResult.modelId,
            temperature: temperatureOverride ?? conciergeResult.temperature,
            explanation: hasOverrides
                ? `User override applied${modelOverride ? ` (model: ${modelOverride})` : ""}${temperatureOverride !== undefined ? ` (temp: ${temperatureOverride})` : ""}${reasoningOverride ? ` (reasoning: ${reasoningOverride})` : ""}`
                : conciergeResult.explanation,
            reasoning: reasoningOverride
                ? reasoningPresetMap[reasoningOverride]
                : conciergeResult.reasoning,
        };

        // Check if the selected model supports tool calling
        // Default to false for unknown models to avoid runtime errors
        const modelConfig = getModel(concierge.modelId);
        const modelSupportsTools = modelConfig?.supportsTools ?? false;

        logger.info(
            {
                userEmail,
                messageCount: messages.length,
                model: concierge.modelId,
                temperature: concierge.temperature,
                explanation: concierge.explanation,
                reasoning: concierge.reasoning,
                toolsAvailable: modelSupportsTools ? Object.keys(tools) : [],
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
                reasoningEnabled: concierge.reasoning.enabled,
                messageCount: messages?.length ?? 0,
            },
        });

        // Capture connectionId for onFinish closure
        const currentConnectionId = connectionId;

        // Build provider options for reasoning when enabled.
        // OpenRouter reasoning config accepts either:
        //   - max_tokens: number (for Anthropic token-budget models)
        //   - effort: 'high' | 'medium' | 'low' (for effort-based models like Grok)
        // These are mutually exclusive - use only one per request.
        //
        // Note: We build this as a plain object and cast to satisfy the AI SDK's strict
        // SharedV2ProviderOptions type (Record<string, Record<string, JSONValue>>).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let providerOptions: any;

        if (concierge.reasoning.enabled) {
            // Validate reasoning config - must have either maxTokens or effort when enabled
            if (!concierge.reasoning.maxTokens && !concierge.reasoning.effort) {
                logger.warn(
                    { reasoning: concierge.reasoning },
                    "Reasoning enabled but no config provided, defaulting to medium effort"
                );
            }

            // Determine effort for OpenRouter - "none" means reasoning is disabled (shouldn't happen here)
            // but we handle it by defaulting to medium
            const effort: OpenRouterEffort =
                concierge.reasoning.effort && concierge.reasoning.effort !== "none"
                    ? concierge.reasoning.effort
                    : "medium";

            providerOptions = {
                openrouter: {
                    reasoning: concierge.reasoning.maxTokens
                        ? { max_tokens: concierge.reasoning.maxTokens }
                        : { effort },
                },
            };
        }

        // Strip reasoning parts before sending to API
        // Anthropic's thinking blocks ('thinking', 'redacted_thinking') cannot be modified
        // in multi-turn conversations. We also strip our custom 'reasoning' type.
        const messagesWithoutReasoning = messages.map((msg) => ({
            ...msg,
            parts: msg.parts.filter((part) => {
                const partType = part.type as string;
                return (
                    partType !== "reasoning" &&
                    partType !== "thinking" &&
                    partType !== "redacted_thinking"
                );
            }),
        }));

        const result = await streamText({
            model: openrouter.chat(concierge.modelId),
            system: SYSTEM_PROMPT,
            messages: convertToModelMessages(messagesWithoutReasoning),
            // Only pass tools if the model supports tool calling (e.g., Perplexity does not)
            ...(modelSupportsTools && { tools }),
            temperature: concierge.temperature,
            ...(modelSupportsTools && { stopWhen: stepCountIs(5) }), // Multi-step only with tools
            // Pass provider-specific reasoning configuration
            providerOptions,
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
                    reasoningEnabled: concierge.reasoning.enabled,
                    reasoningEffort: concierge.reasoning.effort ?? "none",
                },
            },
            // ================================================================
            // PERSISTENCE: Save assistant response when streaming completes
            // ================================================================
            onFinish: async ({ text, toolCalls, toolResults, response, reasoning }) => {
                try {
                    // Build UI message parts from the step result
                    const parts: UIMessageLike["parts"] = [];

                    // Add reasoning part if present
                    if (reasoning) {
                        parts.push({ type: "reasoning", text: reasoning });
                    }

                    // Add text part if present
                    if (text) {
                        parts.push({ type: "text", text });
                    }

                    // Add tool calls with their results
                    for (const tc of toolCalls) {
                        const toolResult = toolResults.find(
                            (tr) => tr.toolCallId === tc.toolCallId
                        );
                        parts.push({
                            type: `tool-${tc.toolName}`,
                            toolCallId: tc.toolCallId,
                            state: toolResult ? "output-available" : "input-available",
                            input: tc.input,
                            ...(toolResult && { output: toolResult.output }),
                        });
                    }

                    // Get message ID from response if available, fallback to nanoid
                    const assistantMessage = response.messages.find(
                        (m) => m.role === "assistant"
                    );
                    const existingId = assistantMessage
                        ? (assistantMessage as { id?: string }).id
                        : undefined;

                    if (!existingId) {
                        logger.debug(
                            { connectionId: currentConnectionId },
                            "AI SDK did not provide message ID, generating with nanoid"
                        );
                    }

                    const messageId = existingId ?? nanoid();

                    // Save assistant message
                    const uiMessage: UIMessageLike = {
                        id: messageId,
                        role: "assistant",
                        parts,
                    };
                    await upsertMessage(currentConnectionId!, uiMessage);

                    // Mark streaming complete
                    await updateStreamingStatus(currentConnectionId!, "completed");

                    // Note: Title is now generated by concierge at connection creation time
                    // No need for separate title generation call

                    logger.debug(
                        {
                            connectionId: currentConnectionId,
                            hasReasoning: !!reasoning,
                        },
                        "Connection persisted successfully"
                    );
                } catch (error) {
                    // Don't fail the response if persistence fails - log and mark as failed
                    logger.error(
                        { error, connectionId: currentConnectionId },
                        "Failed to persist connection"
                    );

                    Sentry.captureException(error, {
                        tags: {
                            component: "persistence",
                            action: "onFinish",
                        },
                        extra: {
                            connectionId: currentConnectionId,
                            userEmail,
                        },
                    });

                    await updateStreamingStatus(currentConnectionId!, "failed").catch(
                        () => {}
                    );
                }
            },
        });

        logger.debug(
            { messageCount: messages?.length ?? 0 },
            "Connect stream initiated"
        );

        // Get the stream response and add concierge headers
        // sendReasoning: true streams reasoning tokens to client when available
        const response = result.toUIMessageStreamResponse({
            originalMessages: messages,
            sendReasoning: concierge.reasoning.enabled,
        });

        // Clone headers and add concierge + conversation data
        const headers = new Headers(response.headers);
        headers.set("X-Concierge-Model-Id", concierge.modelId);
        headers.set("X-Concierge-Temperature", String(concierge.temperature));
        headers.set(
            "X-Concierge-Explanation",
            encodeURIComponent(concierge.explanation)
        );
        headers.set(
            "X-Concierge-Reasoning",
            encodeURIComponent(JSON.stringify(concierge.reasoning))
        );
        headers.set("X-Connection-Id", connectionPublicId!);

        // For new connections, include the slug and title so client can update UI immediately
        if (isNewConnection && connectionSlug) {
            headers.set("X-Connection-Slug", connectionSlug);
            headers.set("X-Connection-Is-New", "true");
            // Include title for immediate display in connection list
            if (conciergeResult.title) {
                headers.set(
                    "X-Connection-Title",
                    encodeURIComponent(conciergeResult.title)
                );
            }
        }

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

        // Mark conversation as failed if one was created
        if (connectionId) {
            await updateStreamingStatus(connectionId, "failed").catch(() => {});
        }

        // Log detailed error for debugging
        logger.error(
            {
                error: errorMessage,
                errorName,
                errorStack,
                userEmail,
                connectionId,
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
                connectionId,
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
