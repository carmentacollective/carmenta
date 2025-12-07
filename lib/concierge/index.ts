/**
 * Concierge - Intelligent model routing for Carmenta.
 *
 * The Concierge analyzes incoming requests and selects the optimal model,
 * temperature, and reasoning configuration. It uses Haiku 4.5 for fast
 * inference, reading the model rubric to make informed decisions.
 */

import { readFile } from "fs/promises";
import { join } from "path";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import * as Sentry from "@sentry/nextjs";
import { generateText, type UIMessage } from "ai";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { generateTitle } from "@/lib/db/title-generator";
import { buildConciergePrompt } from "./prompt";
import {
    ALLOWED_MODELS,
    CONCIERGE_DEFAULTS,
    CONCIERGE_MAX_OUTPUT_TOKENS,
    CONCIERGE_MODEL,
    MAX_EXPLANATION_LENGTH,
    MAX_TITLE_LENGTH,
    REASONING_TOKEN_BUDGETS,
    TOKEN_BUDGET_MODELS,
    type ConciergeResult,
    type ReasoningConfig,
    type ReasoningEffort,
} from "./types";

export type {
    ConciergeResult,
    ReasoningConfig,
    ReasoningEffort,
    OpenRouterEffort,
} from "./types";
export {
    CONCIERGE_DEFAULTS,
    REASONING_TOKEN_BUDGETS,
    CONCIERGE_MAX_OUTPUT_TOKENS,
} from "./types";

// Re-export internal functions for testing
export {
    parseConciergeResponse,
    extractMessageText,
    formatQueryForConcierge,
    detectAttachments,
    buildReasoningConfig,
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
 * Parses the JSON response from the concierge LLM.
 * Validates model against whitelist and builds reasoning config.
 */
function parseConciergeResponse(responseText: string): ConciergeResult {
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(cleanedText);
    } catch (error) {
        throw new Error(
            `Failed to parse concierge JSON: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // Validate required fields
    if (!parsed.modelId || parsed.temperature == null || !parsed.explanation) {
        throw new Error("Missing required fields in concierge response");
    }

    const modelId = String(parsed.modelId);

    // Validate model against whitelist
    if (!ALLOWED_MODELS.includes(modelId as (typeof ALLOWED_MODELS)[number])) {
        logger.warn({ modelId }, "Concierge selected disallowed model, using default");
        return CONCIERGE_DEFAULTS;
    }

    // Clamp temperature to valid range, default to 0.5 if NaN
    const rawTemp = Number(parsed.temperature);
    const temperature = Number.isNaN(rawTemp) ? 0.5 : Math.max(0, Math.min(1, rawTemp));

    // Limit explanation length for security
    const explanation = String(parsed.explanation).slice(0, MAX_EXPLANATION_LENGTH);

    // Parse reasoning config
    const rawReasoning = (parsed.reasoning ?? {}) as {
        enabled?: boolean;
        effort?: string;
    };
    const reasoning = buildReasoningConfig(modelId, rawReasoning);

    // Parse and validate title (optional but expected)
    let title: string | undefined;
    if (parsed.title && typeof parsed.title === "string") {
        title = parsed.title.trim();
        // Remove quotes if the model wrapped the title
        if (
            (title.startsWith('"') && title.endsWith('"')) ||
            (title.startsWith("'") && title.endsWith("'"))
        ) {
            title = title.slice(1, -1);
        }
        // Enforce max length with unicode-safe truncation
        // Using Array.from() to properly handle multi-byte characters (emoji, CJK)
        if ([...title].length > MAX_TITLE_LENGTH) {
            title = [...title].slice(0, MAX_TITLE_LENGTH - 3).join("") + "...";
        }
        // Ensure we have something useful
        if (title.length < 2) {
            title = undefined;
        }
    }

    return {
        modelId,
        temperature,
        explanation,
        reasoning,
        title,
    };
}

/**
 * Runs the Concierge to select the optimal model, temperature, and reasoning config.
 *
 * Uses Haiku 4.5 for fast inference (~200ms). If the concierge fails,
 * returns sensible defaults (Sonnet 4.5 with temperature 0.5, no reasoning).
 */
export async function runConcierge(messages: UIMessage[]): Promise<ConciergeResult> {
    return Sentry.startSpan(
        { op: "concierge.route", name: "Concierge Model Selection" },
        async (span) => {
            try {
                assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

                const openrouter = createOpenRouter({
                    apiKey: env.OPENROUTER_API_KEY,
                });

                // Load the rubric
                const rubricContent = await getRubricContent();

                // Build the prompt
                const systemPrompt = buildConciergePrompt(rubricContent);

                // Format the user's query and detect attachments
                const { text: userQuery, attachments } =
                    formatQueryForConcierge(messages);

                if (!userQuery) {
                    logger.warn({}, "No user query found, using defaults");
                    return CONCIERGE_DEFAULTS;
                }

                // AUDIO ROUTING: Force Gemini if audio attachments present
                // Audio files can ONLY be processed by Gemini (native support)
                if (attachments.includes("audio")) {
                    logger.info(
                        { attachments },
                        "Audio attachment detected - forcing Gemini"
                    );
                    // Generate title since we're bypassing the normal concierge LLM call
                    const title = await generateTitle(userQuery);
                    return {
                        modelId: "google/gemini-3-pro-preview",
                        temperature: 0.5,
                        explanation:
                            "Audio file detected - routing to Gemini for native audio processing 🎵",
                        reasoning: { enabled: false }, // Gemini doesn't support reasoning tokens
                        autoSwitched: true,
                        title,
                    };
                }

                // Build the prompt with attachment context
                let prompt = userQuery;
                if (attachments.length > 0) {
                    prompt = `[Attachments: ${attachments.join(", ")}]\n\n${userQuery}`;
                }

                span.setAttribute("concierge_model", CONCIERGE_MODEL);
                if (attachments.length > 0) {
                    span.setAttribute("attachments", attachments.join(","));
                }

                logger.debug(
                    {
                        conciergeModel: CONCIERGE_MODEL,
                        queryLength: userQuery.length,
                        attachments: attachments.length > 0 ? attachments : undefined,
                    },
                    "Running concierge"
                );

                // Run the concierge LLM
                const result = await generateText({
                    model: openrouter.chat(CONCIERGE_MODEL),
                    system: systemPrompt,
                    prompt,
                    temperature: 0.1, // Low temperature for consistent routing
                    maxOutputTokens: CONCIERGE_MAX_OUTPUT_TOKENS,
                    experimental_telemetry: {
                        isEnabled: true,
                        functionId: "concierge",
                    },
                });

                // Parse the response
                const conciergeResult = parseConciergeResponse(result.text);

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

                logger.error(
                    { error: errorMessage },
                    "Concierge failed, using defaults"
                );

                Sentry.captureException(error, {
                    tags: { component: "concierge" },
                });

                return CONCIERGE_DEFAULTS;
            }
        }
    );
}
