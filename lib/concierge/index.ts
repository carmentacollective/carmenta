/**
 * Concierge - Intelligent model routing for Carmenta.
 *
 * The Concierge analyzes incoming requests and selects the optimal model,
 * temperature, and reasoning configuration. It uses Haiku 4.5 for fast
 * inference, reading the model rubric to make informed decisions.
 */

import { readFile } from "fs/promises";
import { join } from "path";

import * as Sentry from "@sentry/nextjs";
import { generateText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { getOpenRouterClient } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";
import { AUDIO_CAPABLE_MODEL, CONCIERGE_FALLBACK_CHAIN } from "@/lib/model-config";

import { generateTitle } from "@/lib/db/title-generator";
import { buildConciergePrompt, formatQuerySignals } from "./prompt";
import { buildConciergeInput, type BuildConciergeInputOptions } from "./input-builder";
import {
    ALLOWED_MODELS,
    CONCIERGE_DEFAULTS,
    CONCIERGE_MODEL,
    MAX_EXPLANATION_LENGTH,
    MAX_TITLE_LENGTH,
    REASONING_TOKEN_BUDGETS,
    TOKEN_BUDGET_MODELS,
    type ConciergeResult,
    type KBSearchConfig,
    type ReasoningConfig,
    type ReasoningEffort,
} from "./types";

export type {
    ConciergeResult,
    ConciergeInput,
    KBSearchConfig,
    ReasoningConfig,
    ReasoningEffort,
    OpenRouterEffort,
    QueryComplexitySignals,
    SessionContext,
} from "./types";
export { CONCIERGE_DEFAULTS, REASONING_TOKEN_BUDGETS } from "./types";

// Export input builder functions
export {
    buildConciergeInput,
    getAttachmentTypesFromInput,
    type BuildConciergeInputOptions,
} from "./input-builder";

// Re-export internal functions for testing
export {
    extractMessageText,
    formatQueryForConcierge,
    detectAttachments,
    buildReasoningConfig,
    conciergeSchema,
};

/** Cache for the rubric content to avoid repeated file reads */
let rubricCache: string | null = null;

/**
 * Loads the model rubric content from the knowledge folder.
 * Caches the result for subsequent calls.
 */
async function getRubricContent(): Promise<string> {
    if (rubricCache) {
        return rubricCache;
    }

    const rubricPath = join(process.cwd(), "knowledge", "model-rubric.md");
    rubricCache = await readFile(rubricPath, "utf-8");
    return rubricCache;
}

/**
 * Clears the rubric cache. Useful for testing.
 */
export function clearRubricCache(): void {
    rubricCache = null;
}

/**
 * Extracts text content from a UIMessage.
 * UIMessage in AI SDK 5.x uses parts array with type-based content.
 */
function extractMessageText(msg: UIMessage): string {
    if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts
            .filter(
                (part): part is { type: "text"; text: string } => part.type === "text"
            )
            .map((part) => part.text)
            .join(" ");
    }
    return "";
}

/**
 * Detects attachment types in a message.
 * Returns an array of attachment type strings (e.g., ["image", "pdf"]).
 */
function detectAttachments(msg: UIMessage): string[] {
    const attachments: string[] = [];

    if (!msg.parts || !Array.isArray(msg.parts)) {
        return attachments;
    }

    for (const part of msg.parts) {
        // Check for file parts with mimeType
        if ("mimeType" in part && typeof part.mimeType === "string") {
            const mimeType = part.mimeType.toLowerCase();
            if (mimeType.startsWith("image/")) {
                if (!attachments.includes("image")) attachments.push("image");
            } else if (mimeType === "application/pdf") {
                if (!attachments.includes("pdf")) attachments.push("pdf");
            } else if (mimeType.startsWith("audio/")) {
                if (!attachments.includes("audio")) attachments.push("audio");
            } else if (mimeType.startsWith("video/")) {
                if (!attachments.includes("video")) attachments.push("video");
            }
        }
        // Check for file parts with specific mime types
        if (part.type === "file" && "mimeType" in part) {
            const mimeType = String(part.mimeType).toLowerCase();
            if (mimeType.startsWith("audio/")) {
                if (!attachments.includes("audio")) attachments.push("audio");
            } else if (mimeType.startsWith("video/")) {
                if (!attachments.includes("video")) attachments.push("video");
            }
        }
    }

    return attachments;
}

interface FormattedQuery {
    text: string;
    attachments: string[];
}

/**
 * Formats the user's query for the concierge prompt.
 * Takes the last user message as the primary input.
 * Also detects any attachments to inform model routing.
 */
function formatQueryForConcierge(messages: UIMessage[]): FormattedQuery {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUserMessage) {
        return { text: "", attachments: [] };
    }

    return {
        text: extractMessageText(lastUserMessage),
        attachments: detectAttachments(lastUserMessage),
    };
}

/**
 * Builds the final reasoning config based on model type.
 *
 * Token-budget models (Anthropic) get maxTokens.
 * Effort-based models (Grok) get effort level.
 */
function buildReasoningConfig(
    modelId: string,
    rawConfig: { enabled?: boolean; effort?: string }
): ReasoningConfig {
    // If not enabled or missing, return disabled config
    if (!rawConfig.enabled) {
        return { enabled: false };
    }

    // Parse and validate effort level
    const effort = parseEffortLevel(rawConfig.effort);

    // For token-budget models, convert effort to maxTokens
    if (TOKEN_BUDGET_MODELS.includes(modelId as (typeof TOKEN_BUDGET_MODELS)[number])) {
        return {
            enabled: true,
            effort,
            maxTokens: REASONING_TOKEN_BUDGETS[effort],
        };
    }

    // For effort-based models, just use effort
    return {
        enabled: true,
        effort,
    };
}

/**
 * Parses and validates effort level from LLM response.
 */
function parseEffortLevel(effort: unknown): ReasoningEffort {
    if (
        effort === "high" ||
        effort === "medium" ||
        effort === "low" ||
        effort === "none"
    ) {
        return effort;
    }
    // Default to medium for invalid values
    return "medium";
}

/**
 * Zod schema for KB search configuration.
 */
const kbSearchSchema = z.object({
    shouldSearch: z
        .boolean()
        .describe(
            "Whether to search the knowledge base. False for greetings, simple facts, or when no stored context would help."
        ),
    queries: z
        .array(z.string())
        .describe(
            "Search queries optimized for full-text search. Include synonyms and related terms. Empty when shouldSearch is false."
        ),
    entities: z
        .array(z.string())
        .describe(
            "Explicit entity names for direct lookup (people, projects, integrations). These get priority matching."
        ),
});

/**
 * Zod schema for the concierge LLM response.
 * Defines the expected structure for structured output generation.
 */
const conciergeSchema = z.object({
    modelId: z
        .string()
        .describe("The OpenRouter model ID (e.g., anthropic/claude-sonnet-4.5)"),
    temperature: z
        .number()
        .min(0)
        .max(1)
        .describe("Temperature for the LLM call (0.0 to 1.0)"),
    explanation: z
        .string()
        .max(MAX_EXPLANATION_LENGTH)
        .describe("One warm sentence explaining the model choice - shown to the user"),
    reasoning: z
        .object({
            enabled: z.boolean().describe("Whether to enable extended reasoning"),
            effort: z
                .enum(["high", "medium", "low", "none"])
                .optional()
                .describe("Reasoning effort level (only when enabled)"),
        })
        .describe("Extended reasoning configuration"),
    title: z
        .string()
        .min(2, "Title must be at least 2 characters")
        .max(MAX_TITLE_LENGTH)
        .describe("Short title for future reference (15-35 chars ideal)"),
    kbSearch: kbSearchSchema
        .optional()
        .describe(
            "Knowledge base search configuration for retrieving relevant context"
        ),
});

/**
 * Validates and processes the raw concierge response.
 * Checks model whitelist and builds reasoning config.
 */
function processConciergeResponse(
    raw: z.infer<typeof conciergeSchema>
): ConciergeResult {
    const {
        modelId,
        temperature,
        explanation,
        reasoning: rawReasoning,
        title,
        kbSearch: rawKbSearch,
    } = raw;

    // Validate model against whitelist
    if (!ALLOWED_MODELS.includes(modelId as (typeof ALLOWED_MODELS)[number])) {
        logger.warn({ modelId }, "Concierge selected disallowed model, using default");
        return CONCIERGE_DEFAULTS;
    }

    // Build proper reasoning config based on model type
    const reasoning = buildReasoningConfig(modelId, rawReasoning);

    // Clean up title if present
    let cleanTitle: string | undefined;
    if (title) {
        cleanTitle = title.trim();
        // Remove quotes if the model wrapped the title
        if (
            (cleanTitle.startsWith('"') && cleanTitle.endsWith('"')) ||
            (cleanTitle.startsWith("'") && cleanTitle.endsWith("'"))
        ) {
            cleanTitle = cleanTitle.slice(1, -1);
        }
        // Enforce max length with unicode-safe truncation
        if ([...cleanTitle].length > MAX_TITLE_LENGTH) {
            cleanTitle =
                [...cleanTitle].slice(0, MAX_TITLE_LENGTH - 3).join("") + "...";
        }
        // Ensure we have something useful
        if (cleanTitle.length < 2) {
            cleanTitle = undefined;
        }
    }

    // Process KB search config
    let kbSearch: KBSearchConfig | undefined;
    if (rawKbSearch?.shouldSearch) {
        kbSearch = {
            shouldSearch: true,
            queries: rawKbSearch.queries?.filter((q) => q.trim().length > 0) ?? [],
            entities: rawKbSearch.entities?.filter((e) => e.trim().length > 0) ?? [],
        };
        // If no queries or entities, disable search
        if (kbSearch.queries.length === 0 && kbSearch.entities.length === 0) {
            kbSearch = undefined;
        }
    }

    return {
        modelId,
        temperature,
        explanation,
        reasoning,
        title: cleanTitle,
        kbSearch,
    };
}

/**
 * Options for the runConcierge function.
 * Re-exports BuildConciergeInputOptions for API compatibility.
 */
export type RunConciergeOptions = BuildConciergeInputOptions;

/**
 * Runs the Concierge to select the optimal model, temperature, and reasoning config.
 *
 * Uses Gemini 3 Flash for fast inference with prompt caching. If the concierge fails,
 * returns sensible defaults (Sonnet 4.5 with temperature 0.5, no reasoning).
 *
 * Now accepts optional context signals (device type, time of day) that inform
 * reasoning level decisions.
 */
export async function runConcierge(
    messages: UIMessage[],
    options: RunConciergeOptions = {}
): Promise<ConciergeResult> {
    return Sentry.startSpan(
        { op: "concierge.route", name: "Concierge Model Selection" },
        async (span) => {
            try {
                const openrouter = getOpenRouterClient();

                // Load the rubric
                const rubricContent = await getRubricContent();

                // Build the prompt
                const systemPrompt = buildConciergePrompt(rubricContent);

                // Build structured input with query signals
                const conciergeInput = buildConciergeInput(messages, options);

                // Format the user's query and detect attachments
                const { text: userQuery, attachments } =
                    formatQueryForConcierge(messages);

                if (!userQuery) {
                    logger.warn({}, "No user query found, using defaults");
                    return CONCIERGE_DEFAULTS;
                }

                // Format query signals for the prompt
                const querySignalsBlock = formatQuerySignals(conciergeInput);

                // AUDIO ROUTING: Force Gemini if audio attachments present
                // Audio files can ONLY be processed by Gemini (native support)
                if (attachments.includes("audio")) {
                    logger.info(
                        { attachments },
                        "Audio attachment detected - forcing audio-capable model"
                    );
                    // Generate title since we're bypassing the normal concierge LLM call
                    const title = await generateTitle(userQuery);
                    return {
                        modelId: AUDIO_CAPABLE_MODEL,
                        temperature: 0.5,
                        explanation:
                            "Audio file detected - routing to audio-capable model for native audio processing 🎵",
                        reasoning: { enabled: false }, // Audio model doesn't support reasoning tokens
                        autoSwitched: true,
                        title,
                    };
                }

                // Build the prompt with clear framing to prevent the model from answering directly
                // Include query signals to inform reasoning level decision
                let messageBlock = `<user-message>\n${userQuery}\n</user-message>`;
                if (attachments.length > 0) {
                    messageBlock = `<attachments>${attachments.join(", ")}</attachments>\n\n${messageBlock}`;
                }
                if (querySignalsBlock) {
                    messageBlock = `${querySignalsBlock}\n\n${messageBlock}`;
                }

                const prompt = `Analyze the following user message and select the optimal configuration (model, temperature, reasoning, title). Do NOT answer the message - only return the configuration JSON.

${messageBlock}

Return ONLY the JSON configuration. No markdown code fences, no explanations, no other text.`;

                span.setAttribute("concierge_model", CONCIERGE_MODEL);
                if (attachments.length > 0) {
                    span.setAttribute("attachments", attachments.join(","));
                }

                logger.debug(
                    {
                        conciergeModel: CONCIERGE_MODEL,
                        queryLength: userQuery.length,
                        attachments: attachments.length > 0 ? attachments : undefined,
                        querySignals: conciergeInput.querySignals,
                        sessionContext: conciergeInput.sessionContext,
                    },
                    "Running concierge with query signals"
                );

                // Define the routing tool - forces structured output via tool calling
                // This is more reliable than generateObject for models that don't fully
                // support native structured outputs (see https://github.com/vercel/ai/issues/9002)
                const selectModelTool = tool({
                    description:
                        "Select the optimal model, temperature, reasoning config, and title for the user's request",
                    inputSchema: conciergeSchema,
                    execute: async (input) => input, // No-op execute, we just want the structured input
                });

                // Run the concierge LLM with tool calling for structured output
                // Use messages array (not system param) to enable Anthropic prompt caching on fallback.
                // Gemini (primary) has automatic caching for prompts > 1024 tokens.
                const result = await generateText({
                    model: openrouter.chat(CONCIERGE_MODEL),
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                            providerOptions: {
                                anthropic: {
                                    cacheControl: { type: "ephemeral" },
                                },
                            },
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature: 0.1, // Low temperature for consistent routing
                    maxRetries: 1, // Single retry on network/rate limit errors
                    providerOptions: {
                        openrouter: {
                            models: [...CONCIERGE_FALLBACK_CHAIN], // Gemini 3 Flash → Grok 4.1 Fast → Sonnet 4.5
                        },
                    },
                    tools: {
                        selectModelTool,
                    },
                    toolChoice: "required", // Force the model to call the tool
                    experimental_telemetry: {
                        isEnabled: true,
                        functionId: "concierge",
                    },
                });

                // Extract the structured data from the tool call
                // The AI SDK validates the input against our Zod schema automatically
                if (!result.toolCalls || result.toolCalls.length === 0) {
                    throw new Error(
                        "No tool call generated - model did not select routing"
                    );
                }

                const validated = (
                    result.toolCalls[0] as { input: z.infer<typeof conciergeSchema> }
                ).input;

                // Process and validate the structured response
                const conciergeResult = processConciergeResponse(validated);

                span.setAttribute("selected_model", conciergeResult.modelId);
                span.setAttribute("temperature", conciergeResult.temperature);
                span.setAttribute(
                    "reasoning_enabled",
                    conciergeResult.reasoning.enabled
                );
                if (conciergeResult.reasoning.effort) {
                    span.setAttribute(
                        "reasoning_effort",
                        conciergeResult.reasoning.effort
                    );
                }

                logger.info(
                    {
                        modelId: conciergeResult.modelId,
                        temperature: conciergeResult.temperature,
                        explanation: conciergeResult.explanation,
                        reasoning: conciergeResult.reasoning,
                        title: conciergeResult.title,
                    },
                    "Concierge selection complete"
                );

                return conciergeResult;
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                const errorName = error instanceof Error ? error.name : "UnknownError";

                logger.error(
                    {
                        error: errorMessage,
                        errorType: errorName,
                    },
                    "Concierge failed, using defaults"
                );

                Sentry.captureException(error, {
                    tags: {
                        component: "concierge",
                        error_type: errorName,
                    },
                    extra: {
                        conciergeModel: CONCIERGE_MODEL,
                        messageCount: messages.length,
                    },
                });

                return CONCIERGE_DEFAULTS;
            }
        }
    );
}
