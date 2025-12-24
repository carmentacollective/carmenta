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
    buildConciergeInput,
    getAttachmentTypesFromInput,
    type OpenRouterEffort,
} from "@/lib/concierge";
import { applyRoutingRules, type RoutingRulesResult } from "@/lib/context";
import {
    getOrCreateUser,
    createConnection,
    getConnection,
    upsertMessage,
    updateStreamingStatus,
    updateConnection,
    type UIMessageLike,
    db,
} from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
    evaluateTitleEvolution,
    summarizeRecentMessages,
} from "@/lib/concierge/title-evolution";
import { assertEnv, env } from "@/lib/env";
import { decodeConnectionId, encodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { getModel, getFallbackChain } from "@/lib/model-config";
import { buildSystemMessages } from "@/lib/prompts/system-messages";
import { getWebIntelligenceProvider } from "@/lib/web-intelligence";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { initBraintrustLogger, logTraceData } from "@/lib/braintrust";
import { searchKnowledge } from "@/lib/kb/search";
import { triggerFollowUpIngestion } from "@/lib/ingestion/triggers/follow-up";
import {
    getPendingDiscoveries,
    completeDiscovery,
    skipDiscovery,
    getItemByKey,
    DISCOVERY_ITEMS,
    type DiscoveryItem,
} from "@/lib/discovery";
import { updateProfileSection } from "@/lib/kb/profile";

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
                    message: "Search came up empty. The robots are on it. 🤖",
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
                        "That page isn't loading. It might be down or blocking access.",
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
                        "Research didn't find much. The robots are investigating. 🤖",
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

/**
 * Create the searchKnowledge tool with user context.
 * This tool allows the AI to explicitly query the knowledge base mid-conversation.
 */
function createSearchKnowledgeTool(userId: string) {
    return tool({
        description:
            "Search our knowledge base for relevant information about preferences, projects, decisions, or anything we've stored together. Use when context wasn't provided upfront or when the conversation evolves.",
        inputSchema: z.object({
            query: z.string().describe("What to search for in natural language"),
            entities: z
                .array(z.string())
                .optional()
                .describe(
                    "Specific names to match with high precision (people, projects, integrations)"
                ),
        }),
        execute: async ({ query, entities }) => {
            const { results } = await searchKnowledge(userId, query, {
                entities,
                maxResults: 5,
                tokenBudget: 2000,
            });

            if (results.length === 0) {
                return {
                    found: false,
                    message: "Nothing in our knowledge base matches that query.",
                };
            }

            return {
                found: true,
                count: results.length,
                documents: results.map((r) => ({
                    path: r.path,
                    name: r.name,
                    content: r.content,
                    relevance: r.relevance,
                    reason: r.reason,
                })),
            };
        },
    });
}

/**
 * Create discovery tools for gathering profile information and surfacing features.
 * These tools are only available when the user has pending discovery items.
 */
function createDiscoveryTools(userId: string, pendingDiscoveries: DiscoveryItem[]) {
    return {
        updateDiscovery: tool({
            description:
                "Save information gathered during discovery. Use when you learn something about the user (name, role, preferences) or they make a choice (theme, settings).",
            inputSchema: z.object({
                itemKey: z
                    .string()
                    .describe("The discovery item key (e.g., 'profile_identity')"),
                content: z
                    .string()
                    .max(10000, "Content exceeds maximum length (10KB)")
                    .describe("The information to save - extracted from conversation"),
            }),
            execute: async ({ itemKey, content }) => {
                try {
                    // Validate itemKey is in known config FIRST (prevents prototype pollution)
                    if (!DISCOVERY_ITEMS.some((i) => i.key === itemKey)) {
                        logger.warn(
                            { itemKey, userId },
                            "Invalid discovery item key attempted"
                        );
                        return { saved: false, error: "Invalid discovery item key" };
                    }

                    const item = getItemByKey(itemKey);
                    if (!item) {
                        return { saved: false, error: "Unknown discovery item" };
                    }

                    // Save to appropriate location based on item config
                    if (item.storesTo) {
                        if (item.storesTo.type === "kb") {
                            // Map KB path to profile section
                            const pathParts = item.storesTo.path.split(".");
                            const validSections = [
                                "identity",
                                "preferences",
                                "character",
                            ] as const;
                            const section = pathParts[1];

                            if (
                                pathParts[0] === "profile" &&
                                section &&
                                validSections.includes(
                                    section as (typeof validSections)[number]
                                )
                            ) {
                                await updateProfileSection(
                                    userId,
                                    section as "identity" | "preferences" | "character",
                                    content
                                );
                            } else {
                                logger.error(
                                    { path: item.storesTo.path, itemKey },
                                    "Invalid KB path for discovery item"
                                );
                                return {
                                    saved: false,
                                    error: `Unsupported KB path: ${item.storesTo.path}`,
                                };
                            }
                        } else if (item.storesTo.type === "preferences") {
                            // Implement preferences storage
                            const user = await db.query.users.findFirst({
                                where: eq(users.id, userId),
                                columns: { preferences: true },
                            });

                            const currentPreferences = (user?.preferences ??
                                {}) as Record<string, unknown>;

                            await db
                                .update(users)
                                .set({
                                    preferences: {
                                        ...currentPreferences,
                                        [item.storesTo.key]: content,
                                    },
                                    updatedAt: new Date(),
                                })
                                .where(eq(users.id, userId));

                            logger.info(
                                { userId, itemKey, key: item.storesTo.key },
                                "Discovery preferences saved"
                            );
                        }
                    }

                    logger.info(
                        { userId, itemKey, contentLength: content.length },
                        "Discovery item saved"
                    );
                    return { saved: true, itemKey };
                } catch (error) {
                    logger.error(
                        { error, itemKey, userId },
                        "Failed to save discovery item"
                    );
                    Sentry.captureException(error, {
                        tags: { component: "discovery", action: "update", itemKey },
                        extra: { userId, contentLength: content.length },
                    });
                    return { saved: false, error: "Failed to save" };
                }
            },
        }),

        completeDiscovery: tool({
            description:
                "Mark a discovery item as complete. Call this when you have gathered the information needed for an item.",
            inputSchema: z.object({
                itemKey: z.string().describe("The discovery item key to mark complete"),
            }),
            execute: async ({ itemKey }) => {
                try {
                    // Validate itemKey is in known config FIRST (prevents prototype pollution)
                    if (!DISCOVERY_ITEMS.some((i) => i.key === itemKey)) {
                        logger.warn(
                            { itemKey, userId },
                            "Invalid discovery item key attempted"
                        );
                        return {
                            completed: false,
                            error: "Invalid discovery item key",
                        };
                    }

                    const item = getItemByKey(itemKey);
                    if (!item) {
                        return { completed: false, error: "Unknown discovery item" };
                    }

                    await completeDiscovery(userId, itemKey);

                    // Check for more pending items
                    const remainingRequired = pendingDiscoveries.filter(
                        (d) => d.key !== itemKey && d.required
                    );

                    logger.info({ userId, itemKey }, "Discovery item completed");

                    return {
                        completed: true,
                        itemKey,
                        hasMoreRequired: remainingRequired.length > 0,
                        nextItem: remainingRequired[0]?.key ?? null,
                    };
                } catch (error) {
                    logger.error(
                        { error, itemKey, userId },
                        "Failed to complete discovery item"
                    );
                    Sentry.captureException(error, {
                        tags: { component: "discovery", action: "complete", itemKey },
                        extra: { userId },
                    });
                    return { completed: false, error: "Failed to mark complete" };
                }
            },
        }),

        skipDiscovery: tool({
            description:
                "Skip an optional discovery item. Only use for items that are not required.",
            inputSchema: z.object({
                itemKey: z.string().describe("The discovery item key to skip"),
            }),
            execute: async ({ itemKey }) => {
                try {
                    // Validate itemKey is in known config FIRST (prevents prototype pollution)
                    if (!DISCOVERY_ITEMS.some((i) => i.key === itemKey)) {
                        logger.warn(
                            { itemKey, userId },
                            "Invalid discovery item key attempted"
                        );
                        return { skipped: false, error: "Invalid discovery item key" };
                    }

                    const item = getItemByKey(itemKey);
                    if (!item) {
                        return { skipped: false, error: "Unknown discovery item" };
                    }

                    if (item.required) {
                        return { skipped: false, error: "Cannot skip required items" };
                    }

                    await skipDiscovery(userId, itemKey);

                    logger.info({ userId, itemKey }, "Discovery item skipped");

                    return { skipped: true, itemKey };
                } catch (error) {
                    logger.error(
                        { error, itemKey, userId },
                        "Failed to skip discovery item"
                    );
                    Sentry.captureException(error, {
                        tags: { component: "discovery", action: "skip", itemKey },
                        extra: { userId },
                    });
                    return { skipped: false, error: "Failed to skip" };
                }
            },
        }),
    };
}

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
            return new Response(JSON.stringify({ error: "Sign in to continue" }), {
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

        // Initialize Braintrust logger for production tracing (gracefully degrades if not configured)
        await initBraintrustLogger();

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
                    error: "That request didn't quite make sense. The robots are looking into it. 🤖",
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

        // Build lightweight input for routing rules
        const conciergeInput = buildConciergeInput(messages, {
            currentModel: conciergeResult.modelId,
            userSignals: {
                requestedModel: modelOverride,
                requestedTemperature: temperatureOverride,
                requestedReasoning: reasoningOverride,
            },
        });

        // Apply hard-coded routing rules (context overflow, attachment requirements, etc.)
        // These rules override Concierge decisions when technical requirements demand it
        const routingResult: RoutingRulesResult = applyRoutingRules({
            selectedModelId: conciergeResult.modelId as Parameters<
                typeof applyRoutingRules
            >[0]["selectedModelId"],
            userOverride: modelOverride as Parameters<
                typeof applyRoutingRules
            >[0]["userOverride"],
            attachmentTypes: getAttachmentTypesFromInput(conciergeInput),
            reasoningEnabled: conciergeResult.reasoning.enabled,
            toolsEnabled: true, // Tools are always available
            messages,
        });

        // Track if this is a new connection (for header response)
        let isNewConnection = false;
        let connectionSlug: string | null = null;

        // Get or create connection
        if (existingConnectionId) {
            // Decode Sqid string to internal integer ID
            connectionId = decodeConnectionId(existingConnectionId);
            if (connectionId === null) {
                return new Response(
                    JSON.stringify({ error: "That connection doesn't exist" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }
            connectionPublicId = existingConnectionId;
        } else {
            // New connection - will be created after computing final concierge data
            isNewConnection = true;
        }

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

        // Determine final model ID - routing rules take precedence over concierge
        // User overrides are already handled within applyRoutingRules
        const finalModelId = routingResult.modelId;

        // Build explanation based on what happened
        let finalExplanation: string;
        if (hasOverrides) {
            finalExplanation = `User override applied${modelOverride ? ` (model: ${modelOverride})` : ""}${temperatureOverride !== undefined ? ` (temp: ${temperatureOverride})` : ""}${reasoningOverride ? ` (reasoning: ${reasoningOverride})` : ""}`;
        } else if (routingResult.wasChanged && routingResult.reason) {
            // Routing rules changed the model - show why
            finalExplanation = routingResult.reason;
        } else {
            finalExplanation = conciergeResult.explanation;
        }

        const concierge = {
            modelId: finalModelId,
            temperature: temperatureOverride ?? conciergeResult.temperature,
            explanation: finalExplanation,
            reasoning: reasoningOverride
                ? reasoningPresetMap[reasoningOverride]
                : conciergeResult.reasoning,
            // Track if model was auto-switched by routing rules
            autoSwitched: routingResult.wasChanged,
            autoSwitchReason: routingResult.reason,
            contextUtilization: routingResult.contextUtilization,
            // Knowledge base search configuration from concierge
            kbSearch: conciergeResult.kbSearch,
        };

        // Create new connection now that we have final concierge data
        // We persist what the user actually sees (after overrides/routing), not just
        // what the concierge initially suggested.
        if (isNewConnection) {
            try {
                const connection = await createConnection(
                    dbUser.id,
                    conciergeResult.title, // Title from concierge
                    routingResult.modelId, // Use final routed model
                    // Persist FINAL concierge data (after overrides/routing)
                    {
                        modelId: concierge.modelId,
                        temperature: concierge.temperature,
                        explanation: concierge.explanation,
                        reasoning: concierge.reasoning,
                    }
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
                    "Created new connection with title and concierge data"
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
            await upsertMessage(connectionId!, lastMessage as UIMessageLike);
        }

        // Mark connection as streaming
        await updateStreamingStatus(connectionId!, "streaming");

        // Check if the selected model supports tool calling
        // Default to false for unknown models to avoid runtime errors
        const modelConfig = getModel(concierge.modelId);
        const modelSupportsTools = modelConfig?.supportsTools ?? false;

        // Anthropic models with reasoning cannot use multi-step tool calling
        // because thinking blocks in step 1 responses cause API rejection on step 2+
        // See: https://github.com/vercel/ai/issues/9631
        const isAnthropicModel = modelConfig?.provider === "anthropic";
        const disableMultiStepForReasoning =
            isAnthropicModel && concierge.reasoning.enabled;

        // Load integration tools for connected services
        // These are merged with built-in tools for the request
        // CRITICAL: Pass userEmail, not dbUser.id (UUID) - connection-manager queries use email
        const integrationTools = modelSupportsTools
            ? await getIntegrationTools(userEmail!)
            : {};

        // Create searchKnowledge tool with user context
        // This allows the AI to explicitly query the knowledge base mid-conversation
        const searchKnowledgeTool = createSearchKnowledgeTool(dbUser.id);

        // Get pending discoveries for the user
        // Discovery tools are only included when there are items to surface
        const pendingDiscoveries = await getPendingDiscoveries(dbUser.id);
        const discoveryTools =
            pendingDiscoveries.length > 0
                ? createDiscoveryTools(dbUser.id, pendingDiscoveries)
                : {};

        // Merge built-in tools, integration tools, searchKnowledge, and discovery tools
        const allTools = {
            ...tools,
            ...integrationTools,
            searchKnowledge: searchKnowledgeTool,
            ...discoveryTools,
        };

        logger.info(
            {
                userEmail,
                messageCount: messages.length,
                model: concierge.modelId,
                temperature: concierge.temperature,
                explanation: concierge.explanation,
                reasoning: concierge.reasoning,
                toolsAvailable: modelSupportsTools ? Object.keys(allTools) : [],
                integrationTools: Object.keys(integrationTools),
                discoveryMode: pendingDiscoveries.length > 0,
                pendingDiscoveryCount: pendingDiscoveries.length,
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
                    models: getFallbackChain(concierge.modelId),
                    reasoning: concierge.reasoning.maxTokens
                        ? { max_tokens: concierge.reasoning.maxTokens }
                        : { effort },
                },
            };
        } else {
            // Reasoning disabled, but still configure failover models
            providerOptions = {
                openrouter: {
                    models: getFallbackChain(concierge.modelId),
                },
            };
        }

        // Strip reasoning parts before sending to API
        // Anthropic's thinking blocks ('thinking', 'redacted_thinking') cannot be modified
        // in multi-turn conversations. We also strip our custom 'reasoning' type.
        //
        // The AI SDK's UIMessage type can have content as either a string or an array of parts.
        // We need to filter thinking blocks from both the 'parts' array (our format) and
        // the 'content' array (when it's an array) to ensure compatibility.
        const messagesWithoutReasoning = messages.map((msg) => {
            const filtered: any = { ...msg };

            // Filter parts array if it exists
            if (msg.parts) {
                filtered.parts = msg.parts.filter((part) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            // Filter content array if it exists and is an array
            if (Array.isArray((msg as any).content)) {
                filtered.content = (msg as any).content.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            return filtered;
        });

        // Build system messages with Anthropic prompt caching on static content.
        // These are prepended to messages array (not via `system` param) so we can
        // use providerOptions for cache_control.
        // Includes profile context from Knowledge Base (Layer 2),
        // discovery context when items are pending (Layer 3), and
        // retrieved context based on concierge query analysis (Layer 4).
        const systemMessages = await buildSystemMessages({
            user,
            userEmail,
            userId: dbUser.id, // Internal UUID for Knowledge Base lookup
            timezone: undefined, // TODO: Get from client in future
            kbSearch: concierge.kbSearch, // Query-based knowledge retrieval
            pendingDiscoveries, // Discovery items to surface
        });

        const result = await streamText({
            model: openrouter.chat(concierge.modelId),
            // System messages are in the messages array with providerOptions for caching
            messages: [
                ...systemMessages,
                ...(await convertToModelMessages(messagesWithoutReasoning)),
            ],
            // Only pass tools if the model supports tool calling (e.g., Perplexity does not)
            // allTools includes both built-in tools and integration tools for connected services
            ...(modelSupportsTools && { tools: allTools }),
            temperature: concierge.temperature,
            // Multi-step: enabled for tools, but disabled for Anthropic + reasoning (safety net)
            ...(modelSupportsTools &&
                !disableMultiStepForReasoning && { stopWhen: stepCountIs(5) }),
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
            onFinish: async ({
                text,
                toolCalls,
                toolResults,
                response,
                reasoningText,
                usage,
                providerMetadata,
            }) => {
                try {
                    // Log cache performance metrics (only when caching is active)
                    const cachedTokens = usage?.cachedInputTokens ?? 0;
                    if (cachedTokens > 0 || env.NODE_ENV === "development") {
                        logger.debug(
                            {
                                inputTokens: usage?.inputTokens,
                                cachedInputTokens: cachedTokens,
                                outputTokens: usage?.outputTokens,
                                cacheHitRate: usage?.inputTokens
                                    ? `${Math.round((cachedTokens / usage.inputTokens) * 100)}%`
                                    : "N/A",
                                model: concierge.modelId,
                            },
                            cachedTokens > 0
                                ? "Prompt cache hit - cost savings active"
                                : "No cache hit (expected on first request or cache expiry)"
                        );
                    }

                    // Detect and log model failover
                    const actualModelId = response.modelId;
                    if (actualModelId && actualModelId !== concierge.modelId) {
                        logger.warn(
                            {
                                requestedModel: concierge.modelId,
                                actualModel: actualModelId,
                                userEmail,
                                connectionId: currentConnectionId,
                            },
                            "🔄 Model failover occurred - OpenRouter used fallback"
                        );

                        Sentry.addBreadcrumb({
                            category: "model.failover",
                            message: `Failover: ${concierge.modelId} → ${actualModelId}`,
                            level: "warning",
                            data: {
                                requestedModel: concierge.modelId,
                                actualModel: actualModelId,
                                connectionId: currentConnectionId,
                            },
                        });
                    }

                    // Build UI message parts from the step result
                    const parts: UIMessageLike["parts"] = [];

                    // Add reasoning part if present (with provider metadata for token counts)
                    // Note: AI SDK provides `reasoningText` (string) vs `reasoning` (Array<ReasoningOutput>)
                    if (reasoningText) {
                        parts.push({
                            type: "reasoning",
                            text: reasoningText,
                            // Include provider metadata for reasoning tokens, cache info
                            ...(providerMetadata && { providerMetadata }),
                        });
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

                    // Title Evolution: For existing connections, evaluate if title should update
                    // New connections get their title from concierge at creation time
                    if (!isNewConnection && currentConnectionId) {
                        void (async () => {
                            try {
                                const connection =
                                    await getConnection(currentConnectionId);
                                // Skip evolution if user has manually edited the title
                                if (connection?.titleEdited) {
                                    return;
                                }
                                if (connection?.title) {
                                    // Build summary from recent messages for evaluation
                                    const recentMsgs = messages.slice(-10).map((m) => ({
                                        role: m.role,
                                        content:
                                            m.parts
                                                ?.filter(
                                                    (
                                                        p
                                                    ): p is {
                                                        type: "text";
                                                        text: string;
                                                    } => p.type === "text"
                                                )
                                                .map((p) => p.text)
                                                .join(" ") ?? "",
                                    }));
                                    const summary = summarizeRecentMessages(recentMsgs);

                                    const evolution = await evaluateTitleEvolution(
                                        connection.title,
                                        summary
                                    );

                                    if (
                                        evolution.action === "update" &&
                                        evolution.title
                                    ) {
                                        await updateConnection(currentConnectionId, {
                                            title: evolution.title,
                                        });
                                        logger.info(
                                            {
                                                connectionId: currentConnectionId,
                                                oldTitle: connection.title,
                                                newTitle: evolution.title,
                                                reasoning: evolution.reasoning,
                                            },
                                            "Title evolved"
                                        );
                                    }
                                }
                            } catch (error) {
                                // Non-blocking - don't fail the response for title evolution
                                logger.error(
                                    { error, connectionId: currentConnectionId },
                                    "Title evolution failed (non-blocking)"
                                );
                            }
                        })();
                    }

                    // Knowledge Ingestion: Extract learnings from conversation
                    // Fire-and-forget - handles async internally, won't block response
                    if (currentConnectionId) {
                        // Extract text content from messages
                        const extractText = (msg: UIMessage): string =>
                            msg.parts
                                ?.filter(
                                    (p): p is { type: "text"; text: string } =>
                                        p.type === "text"
                                )
                                .map((p) => p.text)
                                .join(" ") ?? "";

                        const userMessages = messages
                            .filter((m) => m.role === "user")
                            .map(extractText);

                        // Include the just-generated assistant response
                        const assistantMessages = [
                            ...messages
                                .filter((m) => m.role === "assistant")
                                .map(extractText),
                            text, // Current response
                        ];

                        void triggerFollowUpIngestion(
                            dbUser.id,
                            currentConnectionId.toString(),
                            userMessages,
                            assistantMessages
                        ).catch((error) => {
                            logger.error(
                                { error, connectionId: currentConnectionId },
                                "Knowledge ingestion failed (non-blocking)"
                            );
                        });
                    }

                    // Log production trace to Braintrust
                    // Collect last user message for preview (truncate to 100 chars for brevity)
                    const lastUserMessage = messages
                        .slice()
                        .reverse()
                        .find((m) => m.role === "user") as any;
                    const lastMessagePreview =
                        typeof lastUserMessage?.content === "string"
                            ? lastUserMessage.content.substring(0, 100)
                            : typeof lastUserMessage?.text === "string"
                              ? lastUserMessage.text.substring(0, 100)
                              : "message";

                    // Extract tools called from the response
                    const toolsCalled = toolCalls.map((tc) => tc.toolName);

                    // Log trace to Braintrust (gracefully handles missing logger)
                    // Fire and forget - don't block on trace logging
                    void logTraceData({
                        input: {
                            messageCount: messages.length,
                            lastMessagePreview,
                        },
                        metadata: {
                            model: concierge.modelId,
                            temperature: concierge.temperature,
                            reasoningEnabled: concierge.reasoning.enabled,
                            reasoningEffort: concierge.reasoning.effort ?? "none",
                            explanation: concierge.explanation,
                            userEmail: userEmail ?? "unknown",
                        },
                        output: {
                            text: text.substring(0, 500), // Truncate for brevity
                            toolsCalled,
                        },
                        metrics: {
                            inputTokens: usage?.inputTokens,
                            outputTokens: usage?.outputTokens,
                            cachedInputTokens: usage?.cachedInputTokens,
                        },
                    }).catch((error) => {
                        logger.error(
                            { error },
                            "Failed to log Braintrust trace (non-blocking)"
                        );
                    });

                    logger.debug(
                        {
                            connectionId: currentConnectionId,
                            hasReasoning: !!reasoningText,
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
            originalMessages: messagesWithoutReasoning,
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

        // Add context window management headers
        if (concierge.autoSwitched) {
            headers.set("X-Concierge-Auto-Switched", "true");
            if (concierge.autoSwitchReason) {
                headers.set(
                    "X-Concierge-Auto-Switch-Reason",
                    encodeURIComponent(concierge.autoSwitchReason)
                );
            }
        }

        // Include context utilization metrics for UI indicators
        if (concierge.contextUtilization) {
            headers.set(
                "X-Context-Utilization",
                encodeURIComponent(
                    JSON.stringify({
                        estimatedTokens: concierge.contextUtilization.estimatedTokens,
                        contextLimit: concierge.contextUtilization.contextLimit,
                        utilizationPercent: Math.round(
                            concierge.contextUtilization.utilizationPercent * 100
                        ),
                        isWarning: concierge.contextUtilization.isWarning,
                        isCritical: concierge.contextUtilization.isCritical,
                    })
                )
            );
        }

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
                error: "Something went sideways. The robots are on it. 🤖",
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
