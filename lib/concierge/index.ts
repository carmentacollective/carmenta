/**
 * Concierge - Intelligent model routing for Carmenta.
 *
 * The Concierge analyzes incoming requests and selects the optimal model
 * and temperature settings. It uses Haiku 4.5 for fast inference, reading
 * the model rubric to make informed decisions.
 */

import { readFile } from "fs/promises";
import { join } from "path";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import * as Sentry from "@sentry/nextjs";
import { generateText, type UIMessage } from "ai";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { buildConciergePrompt } from "./prompt";
import {
    ALLOWED_MODELS,
    CONCIERGE_DEFAULTS,
    CONCIERGE_MODEL,
    MAX_REASONING_LENGTH,
    type ConciergeResult,
} from "./types";

export type { ConciergeResult } from "./types";
export { CONCIERGE_DEFAULTS } from "./types";

// Re-export internal functions for testing
export {
    parseConciergeResponse,
    extractMessageText,
    formatQueryForConcierge,
    detectAttachments,
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
        // Check for file parts with non-string mimeType (defensive fallback)
        if (part.type === "file" && "mimeType" in part) {
            const mimeType = String(part.mimeType).toLowerCase();
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
 * Parses the JSON response from the concierge LLM.
 * Validates model against whitelist and limits reasoning length.
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

    // Validate required fields - use == null to catch both undefined and null
    if (!parsed.modelId || parsed.temperature == null || !parsed.reasoning) {
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

    // Limit reasoning length for security
    const reasoning = String(parsed.reasoning).slice(0, MAX_REASONING_LENGTH);

    return {
        modelId,
        temperature,
        reasoning,
    };
}

/**
 * Runs the Concierge to select the optimal model and temperature.
 *
 * Uses Haiku 4.5 for fast inference (~200ms). If the concierge fails,
 * returns sensible defaults (Sonnet 4.5 with temperature 0.5).
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
                    maxOutputTokens: 200, // Short responses only
                    experimental_telemetry: {
                        isEnabled: true,
                        functionId: "concierge",
                    },
                });

                // Parse the response
                const conciergeResult = parseConciergeResponse(result.text);

                span.setAttribute("selected_model", conciergeResult.modelId);
                span.setAttribute("temperature", conciergeResult.temperature);

                logger.info(
                    {
                        modelId: conciergeResult.modelId,
                        temperature: conciergeResult.temperature,
                        reasoning: conciergeResult.reasoning,
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
