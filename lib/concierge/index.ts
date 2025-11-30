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
import { CONCIERGE_DEFAULTS, CONCIERGE_MODEL, type ConciergeResult } from "./types";

export type { ConciergeResult } from "./types";
export { CONCIERGE_DEFAULTS } from "./types";

// Re-export internal functions for testing
export { parseConciergeResponse, extractMessageText, formatQueryForConcierge };

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
 * Formats the user's query for the concierge prompt.
 * Takes the last user message as the primary input.
 */
function formatQueryForConcierge(messages: UIMessage[]): string {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUserMessage) {
        return "";
    }

    return extractMessageText(lastUserMessage);
}

/**
 * Parses the JSON response from the concierge LLM.
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

    const parsed = JSON.parse(cleanedText);

    // Validate required fields
    if (!parsed.modelId || parsed.temperature === undefined || !parsed.reasoning) {
        throw new Error("Missing required fields in concierge response");
    }

    // Clamp temperature to valid range
    const temperature = Math.max(0, Math.min(1, Number(parsed.temperature)));

    return {
        modelId: String(parsed.modelId),
        temperature,
        reasoning: String(parsed.reasoning),
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

                // Format the user's query
                const userQuery = formatQueryForConcierge(messages);

                if (!userQuery) {
                    logger.warn({}, "No user query found, using defaults");
                    return CONCIERGE_DEFAULTS;
                }

                span.setAttribute("concierge_model", CONCIERGE_MODEL);

                logger.debug(
                    {
                        conciergeModel: CONCIERGE_MODEL,
                        queryLength: userQuery.length,
                    },
                    "Running concierge"
                );

                // Run the concierge LLM
                const result = await generateText({
                    model: openrouter.chat(CONCIERGE_MODEL),
                    system: systemPrompt,
                    prompt: userQuery,
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
