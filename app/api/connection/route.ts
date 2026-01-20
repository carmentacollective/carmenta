import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import {
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    JsonToSseTransformStream,
    stepCountIs,
    streamText,
    UI_MESSAGE_STREAM_HEADERS,
    type UIMessage,
    type UIMessageStreamWriter,
} from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";

import { filterReasoningFromMessages, filterLargeToolOutputs } from "@/lib/ai/messages";
import { getGatewayClient, translateModelId, translateOptions } from "@/lib/ai/gateway";

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
    upsertToolPart,
    updateStreamingStatus,
    updateConnection,
    type UIMessageLike,
} from "@/lib/db";
import {
    evaluateTitleEvolution,
    summarizeRecentMessages,
} from "@/lib/concierge/title-evolution";
import { env } from "@/lib/env";
import { decodeConnectionId, encodeConnectionId } from "@/lib/sqids";
import { logger } from "@/lib/logger";
import { getModel, getFallbackChain } from "@/lib/model-config";
import { buildSystemMessages } from "@/lib/prompts/system-messages";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { getConnectedServices } from "@/lib/integrations/connection-manager";
import { findSuggestableIntegrations } from "@/lib/integrations/services";
import { getMcpGatewayTools } from "@/lib/mcp/gateway";
import { initBraintrustLogger, logTraceData } from "@/lib/braintrust";
import { builtInTools, createSearchKnowledgeTool } from "@/lib/tools/built-in";
import { detectToolError } from "@/lib/tools/tool-errors";
import { createImageArtistTool } from "@/lib/ai-team/agents/image-artist-tool";
import { createLibrarianTool } from "@/lib/ai-team/agents/librarian-tool";
import { createMcpConfigTool } from "@/lib/ai-team/agents/mcp-config-tool";
import { createSmsUserTool } from "@/lib/ai-team/agents/sms-user-tool";
import { createPushNotificationTool } from "@/lib/ai-team/agents/push-notification-tool";
import { createGitHubTool } from "@/lib/github-app";
import { postResponseTools } from "@/lib/tools/post-response";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";
import { triggerLibrarian } from "@/lib/ai-team/librarian/trigger";
// Discovery is disabled - type import kept for pendingDiscoveries typing
import { type DiscoveryItem } from "@/lib/discovery";
import { detectDepthSelection, preExecuteResearch } from "@/lib/research/auto-trigger";
import { writeStatus, STATUS_MESSAGES } from "@/lib/streaming";
import {
    isBackgroundModeEnabled,
    startBackgroundResponse,
} from "@/lib/temporal/client";

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

// Discovery tools removed - discovery mode is disabled
// See comment at pendingDiscoveries initialization for details
// The createDiscoveryTools function can be restored from git history when needed

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
            return unauthorizedResponse();
        }

        // Use actual email if authenticated, fallback for development
        userEmail = user?.emailAddresses[0]?.emailAddress ?? "dev-user@local";

        const gateway = getGatewayClient();

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
            return validationErrorResponse(parseResult.error.flatten());
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

        // Get connected services and find potential integration suggestions
        const connectedServiceIds = await getConnectedServices(userEmail!);
        const connectedSet = new Set(connectedServiceIds);

        // Extract user query for keyword matching
        const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
        const userQuery =
            lastUserMessage?.parts
                ?.filter(
                    (part): part is { type: "text"; text: string } =>
                        part.type === "text"
                )
                .map((part) => part.text)
                .join(" ") ?? "";

        // Find integrations that might help with this query
        const suggestableIntegrations = findSuggestableIntegrations(
            userQuery,
            connectedSet
        );

        // Run the Concierge FIRST to get model selection AND title (for new connections)
        const conciergeResult = await runConcierge(messages, {
            integrationContext:
                suggestableIntegrations.length > 0
                    ? {
                          connectedServiceIds,
                          potentialSuggestions: suggestableIntegrations.map((s) => ({
                              serviceId: s.serviceId,
                              serviceName: s.serviceName,
                              description: s.description,
                              matchedKeywords: s.matchedKeywords,
                          })),
                      }
                    : undefined,
        });

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
            // Suggested integrations when query would benefit from unconnected services
            suggestedIntegrations: conciergeResult.suggestedIntegrations,
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

        // ================================================================
        // CLARIFYING QUESTIONS: Ask before deep research (first message only)
        // ================================================================
        // When concierge detects a research task, it may ask scoping questions
        // before starting. Only on FIRST message - never interrupt follow-ups.
        //
        // Guard: Only allow clarifying questions on truly new connections.
        // If user is continuing a conversation, just proceed with the work.
        const isFirstMessage = isNewConnection && messages.length <= 1;
        const clarifyingQuestions = conciergeResult.clarifyingQuestions ?? [];
        const hasClarifyingQuestions = clarifyingQuestions.length > 0;

        if (hasClarifyingQuestions && !isFirstMessage) {
            logger.info(
                { connectionId, messageCount: messages.length },
                "Skipping clarifying questions on follow-up message"
            );
        }

        if (hasClarifyingQuestions && isFirstMessage) {
            logger.info(
                {
                    connectionId,
                    questionCount: clarifyingQuestions.length,
                },
                "Returning clarifying questions before research"
            );

            // Build headers for the response
            const headers = new Headers();
            headers.set("X-Concierge-Model-Id", concierge.modelId);
            headers.set("X-Concierge-Temperature", String(concierge.temperature));
            headers.set(
                "X-Concierge-Explanation",
                encodeURIComponent(concierge.explanation)
            );
            headers.set("X-Connection-Id", connectionPublicId!);

            if (isNewConnection && connectionSlug) {
                headers.set("X-Connection-Slug", connectionSlug);
                headers.set("X-Connection-Is-New", "true");
                if (conciergeResult.title) {
                    headers.set(
                        "X-Connection-Title",
                        encodeURIComponent(conciergeResult.title)
                    );
                }
            }

            // Create a stream with clarifying questions
            // Uses AI SDK v6 streaming format: text-start/delta/end with id for text,
            // and data-* pattern for custom data parts
            const stream = createUIMessageStream({
                execute: ({ writer }) => {
                    // Write intro text using v6 format: text-start, text-delta, text-end
                    const textId = `text-${nanoid(8)}`;
                    writer.write({ type: "text-start", id: textId });
                    writer.write({
                        type: "text-delta",
                        id: textId,
                        delta: "", // Question renders inline, no intro needed
                    });
                    writer.write({ type: "text-end", id: textId });

                    // Write each question as a data-askUserInput part
                    // Clarifying questions are clickable options only - no freeform
                    for (const question of clarifyingQuestions) {
                        writer.write({
                            type: "data-askUserInput",
                            data: {
                                question: question.question,
                                options: question.options,
                            },
                        });
                    }
                },
            });

            // Persist the assistant message with clarifying questions
            // Without this, the question UI disappears on page reload
            const assistantMessageId = nanoid();
            const assistantMessage: UIMessageLike = {
                id: assistantMessageId,
                role: "assistant",
                parts: clarifyingQuestions.map((question) => ({
                    type: "data-askUserInput",
                    data: {
                        question: question.question,
                        options: question.options,
                    },
                })),
            };
            await upsertMessage(connectionId!, assistantMessage);

            // Mark as completed since we're just asking a question
            await updateStreamingStatus(connectionId!, "completed");

            return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
                headers: {
                    ...Object.fromEntries(headers.entries()),
                    ...UI_MESSAGE_STREAM_HEADERS,
                },
            });
        }

        // ================================================================
        // BACKGROUND MODE: Dispatch to Temporal for durable execution
        // ================================================================
        // When concierge detects a long-running task, dispatch to Temporal.
        // Work survives browser close, deploys, and connection drops.
        // Client polls for completion via useBackgroundMode hook.
        //
        // Gracefully disabled if Temporal isn't configured - runs inline instead.
        const temporalConfigured = isBackgroundModeEnabled();
        if (conciergeResult.backgroundMode?.enabled && !temporalConfigured) {
            logger.info(
                { connectionId, reason: conciergeResult.backgroundMode.reason },
                "Background mode requested but Temporal not configured, running inline"
            );
        }
        if (conciergeResult.backgroundMode?.enabled && temporalConfigured) {
            const streamId = nanoid();

            // Dispatch to Temporal - payloads contain only IDs for security
            // If Temporal is down, fall back to inline execution
            let temporalDispatchSucceeded = false;
            try {
                await startBackgroundResponse({
                    connectionId: connectionId!,
                    userId: dbUser.id,
                    streamId,
                    modelId: concierge.modelId,
                    temperature: concierge.temperature,
                    reasoning: concierge.reasoning,
                });

                temporalDispatchSucceeded = true;

                Sentry.addBreadcrumb({
                    category: "temporal.dispatch",
                    message: "Background mode enabled via Temporal",
                    level: "info",
                    data: { connectionId, streamId },
                });

                logger.info(
                    {
                        connectionId,
                        streamId,
                        userId: dbUser.id,
                        reason: conciergeResult.backgroundMode.reason,
                    },
                    "Dispatched to Temporal background mode"
                );
            } catch (temporalError) {
                // Temporal is configured but unavailable - fall back to inline
                const errorMessage =
                    temporalError instanceof Error
                        ? temporalError.message
                        : String(temporalError);

                Sentry.addBreadcrumb({
                    category: "temporal.fallback",
                    message: "Falling back to inline execution",
                    level: "warning",
                    data: {
                        connectionId,
                        reason: conciergeResult.backgroundMode?.reason,
                    },
                });

                logger.error(
                    { connectionId, error: errorMessage },
                    "Temporal dispatch failed, falling back to inline execution"
                );
                Sentry.captureException(temporalError, {
                    tags: { component: "connection", action: "temporal_dispatch" },
                    extra: {
                        connectionId,
                        streamId,
                        reason: conciergeResult.backgroundMode?.reason,
                    },
                });
            }

            // Only return early if Temporal dispatch succeeded
            if (!temporalDispatchSucceeded) {
                logger.info(
                    { connectionId, reason: conciergeResult.backgroundMode.reason },
                    "Temporal unavailable, continuing with inline execution"
                );
                // Fall through to inline execution below
            } else {
                // Build headers for background mode response
                const headers = new Headers();
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
                headers.set("X-Background-Mode", "true");
                headers.set("X-Stream-Id", streamId);

                if (isNewConnection && connectionSlug) {
                    headers.set("X-Connection-Slug", connectionSlug);
                    headers.set("X-Connection-Is-New", "true");
                    if (conciergeResult.title) {
                        headers.set(
                            "X-Connection-Title",
                            encodeURIComponent(conciergeResult.title)
                        );
                    }
                }

                // Return immediately with background status message
                // Client will poll for completion via useBackgroundMode hook
                const stream = createUIMessageStream({
                    execute: ({ writer }) => {
                        writeStatus(
                            writer,
                            "background-mode",
                            STATUS_MESSAGES.background.starting,
                            "🔄"
                        );
                    },
                });

                return new Response(
                    stream.pipeThrough(new JsonToSseTransformStream()),
                    {
                        headers: {
                            ...Object.fromEntries(headers.entries()),
                            ...UI_MESSAGE_STREAM_HEADERS,
                        },
                    }
                );
            } // end else (temporalDispatchSucceeded)
        }

        // Check if the selected model supports tool calling
        // Default to false for unknown models to avoid runtime errors
        const modelConfig = getModel(concierge.modelId);
        const modelSupportsTools = modelConfig?.supportsTools ?? false;

        // Load integration tools for connected services
        // These are merged with built-in tools for the request
        // CRITICAL: Pass userEmail, not dbUser.id (UUID) - connection-manager queries use email
        const integrationTools = modelSupportsTools
            ? await getIntegrationTools(userEmail!)
            : {};

        // Load MCP gateway tools for user-configured MCP servers
        // Each enabled server becomes a single tool with progressive disclosure
        // CRITICAL: Use dbUser.email (from database) not userEmail (from Clerk)
        // MCP servers are stored with dbUser.email, so queries must match
        const mcpTools = modelSupportsTools
            ? await getMcpGatewayTools(dbUser.email)
            : {};

        logger.debug(
            {
                connectionId,
                modelSupportsTools,
                mcpToolCount: Object.keys(mcpTools).length,
                mcpToolNames: Object.keys(mcpTools),
            },
            "MCP gateway tools loaded"
        );

        // Create searchKnowledge tool with user context
        // This allows the AI to explicitly query the knowledge base mid-conversation
        const searchKnowledgeTool = createSearchKnowledgeTool(dbUser.id);

        // Create Image Artist agent tool
        // Uses task-based model routing from 195-image eval results
        // Extended timeout (5 min) because image generation can be slow,
        // especially Imagen Ultra which can take 90+ seconds
        const imageArtistTool = createImageArtistTool({
            userId: dbUser.id,
            userEmail: userEmail!,
            timeoutMs: 300_000,
        });

        // Create SMS tool for Carmenta to text the user
        // This is system-level messaging (Carmenta → user), not the user's own Quo account
        const smsUserTool = createSmsUserTool({
            userId: dbUser.id,
            userEmail: userEmail!,
        });

        // Create push notification tool for PWA notifications to iOS
        // Used by AI agents to alert users about important items (e.g., email steward)
        const pushNotificationTool = createPushNotificationTool({
            userId: dbUser.id,
            userEmail: userEmail!,
        });

        // Create Librarian tool for explicit KB updates
        // Enables "remember this", "save that", etc. - explicit user requests to update KB
        // Post-hoc extraction still runs for implicit knowledge capture
        const librarianTool = createLibrarianTool({
            userId: dbUser.id,
            userEmail: userEmail!,
        });

        // Create MCP Config tool for managing MCP server configurations
        // Enables adding, listing, testing MCP servers directly in Carmenta
        const mcpConfigTool = createMcpConfigTool({
            userId: dbUser.id,
            userEmail: userEmail!,
        });

        // Create GitHub tool for filing issues in Carmenta's own repo
        // This is Carmenta's GitHub App (carmenta-bot[bot]), not a user integration
        // Used for bug reports, feature requests, and feedback about Carmenta itself
        const carmentaGitHub = createGitHubTool({
            userId: dbUser.id,
            isAdmin: user?.publicMetadata?.role === "admin",
        });

        // Discovery mode is disabled until we refine the experience
        // It was interrupting substantive responses and degrading quality
        // TODO: Re-enable when discovery is less intrusive
        const pendingDiscoveries: DiscoveryItem[] = [];
        const discoveryTools = {};

        // Merge built-in tools, integration tools, MCP tools, searchKnowledge, post-response, and discovery tools
        const allTools = {
            ...builtInTools,
            ...integrationTools,
            ...mcpTools,
            ...postResponseTools,
            searchKnowledge: searchKnowledgeTool,
            imageArtist: imageArtistTool,
            librarian: librarianTool,
            mcpConfig: mcpConfigTool,
            smsUser: smsUserTool,
            pushNotification: pushNotificationTool,
            carmentaGitHub,
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
                mcpTools: Object.keys(mcpTools),
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

            // Determine effort - "none" means reasoning is disabled (shouldn't happen here)
            // but we handle it by defaulting to medium
            const effort: OpenRouterEffort =
                concierge.reasoning.effort && concierge.reasoning.effort !== "none"
                    ? concierge.reasoning.effort
                    : "medium";

            // Use translateOptions to properly format reasoning for provider-specific APIs
            providerOptions = translateOptions(concierge.modelId, {
                fallbackModels: getFallbackChain(concierge.modelId),
                reasoning: {
                    enabled: true,
                    maxTokens: concierge.reasoning.maxTokens,
                    effort,
                },
            });
        } else {
            // Reasoning disabled, but still configure failover models
            providerOptions = translateOptions(concierge.modelId, {
                fallbackModels: getFallbackChain(concierge.modelId),
            });
        }

        // Filter messages for LLM consumption:
        // 1. Strip reasoning parts (Anthropic rejects modified thinking blocks in history)
        // 2. Strip large base64 image data (causes context_length_exceeded errors)
        //
        // IMPORTANT: We create two filtered versions:
        // - messagesForLLM: Filtered for LLM context (no reasoning, no large images)
        // - messagesForUI: Filtered for UI stream (no reasoning, but KEEP images)
        //
        // The UI stream needs the original image data so the frontend can display them.
        // Only the LLM context needs images stripped to avoid context overflow.
        const messagesWithReasoningFiltered = filterReasoningFromMessages(messages);
        const messagesForLLM = filterLargeToolOutputs(messagesWithReasoningFiltered);

        // Build system messages with Anthropic prompt caching on static content.
        // These are prepended to messages array (not via `system` param) so we can
        // use providerOptions for cache_control.
        // Includes profile context from Knowledge Base (Layer 2),
        // discovery context when items are pending (Layer 3),
        // retrieved context based on concierge query analysis (Layer 4),
        // and response depth guidance (Layer 6).
        const systemMessages = await buildSystemMessages({
            user,
            userEmail,
            userId: dbUser.id, // Internal UUID for Knowledge Base lookup
            timezone: undefined, // TODO: Get from client in future
            kbSearch: concierge.kbSearch, // Query-based knowledge retrieval
            pendingDiscoveries, // Discovery items to surface
            responseDepth: conciergeResult.responseDepth, // Response verbosity guidance
        });

        // Transient writer reference - set when the stream is consumed
        // This allows onChunk to emit status updates during streaming
        let transientWriter: UIMessageStreamWriter | null = null;

        // Map tool names to user-friendly status messages
        const getToolStatusMessage = (toolName: string): string => {
            switch (toolName) {
                case "webSearch":
                    return STATUS_MESSAGES.webSearch.starting;
                case "deepResearch":
                    return STATUS_MESSAGES.deepResearch.starting;
                case "fetchPage":
                    return "Reading page...";
                case "searchKnowledge":
                    return STATUS_MESSAGES.knowledgeBase.searching;
                case "imageArtist":
                    return "Creating image...";
                default:
                    // Integration tools (clickup, notion, etc.)
                    return STATUS_MESSAGES.integration.connecting(toolName);
            }
        };

        // ================================================================
        // AUTO-TRIGGER RESEARCH: Pre-execute when depth is selected
        // ================================================================
        // When user selects a research depth (like "Quick overview ~15s"),
        // pre-execute deepResearch before the AI runs. This ensures the
        // time promise is honored instead of the AI doing manual searches.
        const depthSelection = detectDepthSelection(messages, connectionId);
        let researchSystemContext: string | null = null;

        if (
            depthSelection.isDepthResponse &&
            depthSelection.depth &&
            depthSelection.originalQuery
        ) {
            logger.info(
                {
                    connectionId,
                    depth: depthSelection.depth,
                    queryPreview: depthSelection.originalQuery.slice(0, 100),
                },
                "Auto-triggering deepResearch for depth selection"
            );

            const preExecuted = await preExecuteResearch(
                depthSelection.originalQuery,
                depthSelection.depth,
                connectionId
            );

            if (preExecuted) {
                researchSystemContext = preExecuted.systemContext;
                logger.info(
                    {
                        connectionId,
                        findingsCount: preExecuted.result.findings.length,
                        sourcesCount: preExecuted.result.sources.length,
                    },
                    "Pre-executed research complete, adding to system context"
                );
            }
        }

        // Build final messages, including pre-executed research as system context
        const modelMessages = await convertToModelMessages(messagesForLLM);
        const finalSystemMessages = researchSystemContext
            ? [
                  ...systemMessages,
                  { role: "system" as const, content: researchSystemContext },
              ]
            : systemMessages;

        // Pre-generate message ID for progressive tool persistence
        // This allows onStepFinish to persist tool results before onFinish runs
        // IMPORTANT: onFinish must use this same ID for consistency
        const assistantMessageId = nanoid();
        // Track tool part order for proper reconstruction (needs let for increment)
        // biome-ignore lint: intentionally mutable for tracking state across async callbacks
        let toolPartOrder = 0;

        const result = await streamText({
            model: gateway(translateModelId(concierge.modelId)),
            // System messages include pre-executed research context if applicable
            messages: [...finalSystemMessages, ...modelMessages],
            // Only pass tools if the model supports tool calling (e.g., Perplexity does not)
            // allTools includes both built-in tools and integration tools for connected services
            ...(modelSupportsTools && { tools: allTools }),
            temperature: concierge.temperature,
            // Multi-step tool calling: allows substantive research workflows
            // 25 steps enables: search → read multiple sources → refine → integrate
            // Real safety net is maxDuration (120s), not step count
            ...(modelSupportsTools && { stopWhen: stepCountIs(25) }),
            // Pass provider-specific reasoning configuration
            providerOptions,
            // ================================================================
            // TRANSIENT STATUS: Emit status updates during tool execution
            // ================================================================
            onChunk: ({ chunk }) => {
                if (!transientWriter) return;

                // Emit status when a tool call starts
                if (chunk.type === "tool-call") {
                    const message = getToolStatusMessage(chunk.toolName);
                    writeStatus(
                        transientWriter,
                        `tool-${chunk.toolCallId}`,
                        message,
                        "🔧"
                    );
                }

                // Clear status when tool result arrives
                if (chunk.type === "tool-result") {
                    // Write empty text to clear the transient message
                    writeStatus(transientWriter, `tool-${chunk.toolCallId}`, "");
                }
            },
            // ================================================================
            // PROGRESSIVE PERSISTENCE: Save tool results as they complete
            // ================================================================
            // onStepFinish fires after each step (tool execution round) completes.
            // Persisting here prevents tool state from getting stuck in "Working"
            // if the stream fails before onFinish.
            // See: knowledge/components/streaming-tool-state.md
            onStepFinish: async ({ toolCalls, toolResults }) => {
                if (!currentConnectionId || toolResults.length === 0) return;

                // Claim order range upfront to prevent race conditions with concurrent steps
                // Each onStepFinish may run concurrently, so we atomically claim our range
                const baseOrder = toolPartOrder;
                toolPartOrder += toolResults.length;

                try {
                    for (let i = 0; i < toolResults.length; i++) {
                        const toolResult = toolResults[i];
                        // Find the matching tool call to get input
                        const toolCall = toolCalls.find(
                            (tc) => tc.toolCallId === toolResult.toolCallId
                        );
                        if (!toolCall) {
                            logger.warn(
                                {
                                    toolCallId: toolResult.toolCallId,
                                    connectionId: currentConnectionId,
                                },
                                "Tool result has no matching tool call - skipping persistence"
                            );
                            continue;
                        }

                        // Detect error state from tool output
                        const errorDetection = detectToolError(toolResult.output);

                        await upsertToolPart(
                            currentConnectionId,
                            assistantMessageId,
                            {
                                toolCallId: toolResult.toolCallId,
                                toolName: toolCall.toolName,
                                // AI SDK 5.0+: uses 'input' and 'output' (not 'args' and 'result')
                                // Defensive cast - SDK types these as 'unknown' but they're always objects
                                input: (toolCall.input ?? {}) as Record<
                                    string,
                                    unknown
                                >,
                                output: (toolResult.output ?? {}) as Record<
                                    string,
                                    unknown
                                >,
                                // Persist error state if tool returned failure pattern
                                state: errorDetection.isError
                                    ? "output_error"
                                    : "output_available",
                                errorText: errorDetection.errorText,
                            },
                            baseOrder + i
                        );
                    }
                } catch (error) {
                    // Log but don't fail - onFinish will persist the final state
                    logger.warn(
                        {
                            error,
                            connectionId: currentConnectionId,
                            messageId: assistantMessageId,
                        },
                        "Progressive tool persistence failed (will retry in onFinish)"
                    );
                }
            },
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

                    // Detect model failover (not just ID normalization)
                    // Provider returns canonical ID (e.g., "claude-haiku-4-5-20251001")
                    // while we request alias (e.g., "anthropic/claude-haiku-4.5")
                    const actualModelId = response.modelId;
                    if (actualModelId && actualModelId !== concierge.modelId) {
                        // Check if this is just ID normalization vs true failover
                        // True failover = different model family (e.g., sonnet → haiku)
                        const requestedBase = concierge.modelId
                            .replace(/^[^/]+\//, "") // Remove provider prefix
                            .replace(/[-.][\d.]+$/, "") // Remove version suffix
                            .toLowerCase();
                        const actualBase = actualModelId
                            .replace(/^[^/]+\//, "")
                            .replace(/[-_][\d]+$/, "") // Remove date suffix like -20251001
                            .replace(/[-.][\d.]+$/, "")
                            .toLowerCase();

                        // Only warn on true failover (different model family)
                        if (
                            !actualBase.includes(requestedBase) &&
                            !requestedBase.includes(actualBase)
                        ) {
                            logger.warn(
                                {
                                    requestedModel: concierge.modelId,
                                    actualModel: actualModelId,
                                    userEmail,
                                    connectionId: currentConnectionId,
                                },
                                "🔄 Model failover occurred"
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

                        // Detect error state from tool output
                        const errorDetection = toolResult
                            ? detectToolError(toolResult.output)
                            : { isError: false };

                        // Determine state: error > available > input-only
                        let state: string;
                        if (toolResult) {
                            state = errorDetection.isError
                                ? "output-error"
                                : "output-available";
                        } else {
                            state = "input-available";
                        }

                        parts.push({
                            type: `tool-${tc.toolName}`,
                            toolCallId: tc.toolCallId,
                            state,
                            input: tc.input,
                            ...(toolResult && { output: toolResult.output }),
                            // Include errorText for error state
                            ...(errorDetection.isError && errorDetection.errorText
                                ? { errorText: errorDetection.errorText }
                                : {}),
                        });
                    }

                    // Use pre-generated message ID for consistency with onStepFinish
                    // This ensures progressive tool persistence and final persistence
                    // reference the same message record
                    const messageId = assistantMessageId;

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
                                Sentry.captureException(error, {
                                    level: "warning",
                                    tags: {
                                        component: "connection",
                                        operation: "title_evolution",
                                    },
                                    extra: { connectionId: currentConnectionId },
                                });
                            }
                        })();
                    }

                    // Knowledge Ingestion: Extract learnings from conversation
                    // Fire-and-forget - handles async internally, won't block response
                    if (currentConnectionId) {
                        void (async () => {
                            try {
                                // Get conversation title for context
                                // New connections: use concierge-generated title
                                // Existing connections: fetch from database
                                let conversationTitle = isNewConnection
                                    ? conciergeResult.title
                                    : undefined;

                                if (!isNewConnection) {
                                    const connection =
                                        await getConnection(currentConnectionId);
                                    conversationTitle = connection?.title ?? undefined;
                                }

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

                                await triggerLibrarian(
                                    dbUser.id,
                                    currentConnectionId.toString(),
                                    userMessages,
                                    assistantMessages,
                                    { async: true, title: conversationTitle }
                                );
                            } catch (error) {
                                logger.error(
                                    { error, connectionId: currentConnectionId },
                                    "Knowledge Librarian failed (non-blocking)"
                                );
                                Sentry.captureException(error, {
                                    level: "warning",
                                    tags: {
                                        component: "connection",
                                        operation: "librarian",
                                    },
                                    extra: { connectionId: currentConnectionId },
                                });
                            }
                        })();
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

        // ================================================================
        // CONSUME STREAM: Ensure onFinish fires even if client disconnects
        // ================================================================
        // consumeStream() removes backpressure from the stream, allowing it to
        // run to completion server-side regardless of client connection status.
        // This prevents tool state from getting stuck in "Working" when the
        // client disconnects mid-stream.
        // See: knowledge/components/streaming-tool-state.md
        result.consumeStream();

        logger.debug(
            { messageCount: messages?.length ?? 0 },
            "Connect stream initiated"
        );

        // Build concierge + metadata headers
        const headers = new Headers();
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

        // Include suggested integrations when query would benefit from unconnected services
        if (
            concierge.suggestedIntegrations &&
            concierge.suggestedIntegrations.length > 0
        ) {
            headers.set(
                "X-Suggested-Integrations",
                encodeURIComponent(JSON.stringify(concierge.suggestedIntegrations))
            );
        }

        // ================================================================
        // RESUMABLE STREAM: Wrap stream for connection recovery
        // ================================================================

        // Create the UI message stream with transient status support
        // Transient messages are sent inline but not persisted to message history
        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                // Set the writer reference so onChunk can emit transient messages
                transientWriter = writer;

                // Merge the streamText result into our stream
                // sendReasoning: true streams reasoning tokens to client when available
                writer.merge(
                    result.toUIMessageStream({
                        // Use messagesWithReasoningFiltered (NOT messagesForLLM) so images display
                        originalMessages: messagesWithReasoningFiltered,
                        sendReasoning: concierge.reasoning.enabled,
                        // Use pre-generated message ID so stream and DB agree on the ID
                        // This prevents duplicate assistant messages after reload
                        generateMessageId: () => assistantMessageId,
                    })
                );
            },
        });

        // Return UI message stream response
        return createUIMessageStreamResponse({
            stream,
            headers,
        });
    } catch (error) {
        // Mark conversation as failed if one was created
        if (connectionId) {
            await updateStreamingStatus(connectionId, "failed").catch(() => {});
        }

        return serverErrorResponse(error, {
            userEmail,
            resourceId: connectionId,
            model: CONCIERGE_DEFAULTS.modelId,
            route: "connect",
        });
    }
}
