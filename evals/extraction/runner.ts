/**
 * Extraction Runner
 *
 * Runs the extraction LLM call for evaluation.
 * Uses the same prompt and schema as production.
 */

import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

import { extractionSystemPrompt } from "../../lib/import/extraction/prompt";
import type { ExtractionTestCase } from "./cases";
import type { ExtractionOutput } from "./scorer";

/**
 * Model candidates for extraction
 */
export const EXTRACTION_MODEL_CANDIDATES = [
    {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        costPer1M: 3.0,
    },
    {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        costPer1M: 0.25,
    },
    {
        id: "google/gemini-2.5-flash-preview",
        name: "Gemini 2.5 Flash",
        costPer1M: 0.15,
    },
    {
        id: "openai/gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        costPer1M: 0.4,
    },
] as const;

export type ExtractionModelCandidate = (typeof EXTRACTION_MODEL_CANDIDATES)[number];

/**
 * Schema for extraction output (matches production)
 */
const extractionSchema = z.object({
    facts: z.array(
        z.object({
            category: z.enum([
                "identity",
                "preference",
                "person",
                "project",
                "decision",
                "expertise",
            ]),
            content: z.string(),
            summary: z.string(),
            confidence: z.number(),
            sourceTimestamp: z.string().optional(),
        })
    ),
});

interface RunOptions {
    extractionModel: string;
    apiKey: string;
}

/**
 * Run extraction on test case messages
 */
export async function runExtractionEval(
    input: ExtractionTestCase["input"],
    options: RunOptions
): Promise<ExtractionOutput> {
    const { extractionModel, apiKey } = options;
    const startTime = Date.now();

    try {
        const openrouter = createOpenRouter({ apiKey });

        // Format messages like production
        const conversationText = input.messages
            .map((m) => {
                const timestamp = m.createdAt || new Date().toISOString();
                return `[${timestamp}]\n${m.content}`;
            })
            .join("\n\n---\n\n");

        const result = await generateObject({
            model: openrouter(extractionModel),
            schema: extractionSchema,
            prompt: `${extractionSystemPrompt}\n\n<conversation>\n${conversationText}\n</conversation>`,
        });

        const latencyMs = Date.now() - startTime;

        return {
            facts: result.object.facts,
            isValid: true,
            latencyMs,
        };
    } catch (error) {
        const latencyMs = Date.now() - startTime;
        // Extract detailed error info
        let errorMessage = "Unknown error";
        if (error instanceof Error) {
            errorMessage = error.message;
            // Check for nested error details
            if ("cause" in error && error.cause) {
                errorMessage += ` (cause: ${error.cause})`;
            }
            // Check for response body in API errors
            if ("responseBody" in error) {
                errorMessage += ` (body: ${JSON.stringify((error as unknown as { responseBody: unknown }).responseBody)})`;
            }
        }
        return {
            facts: [],
            isValid: false,
            error: errorMessage,
            latencyMs,
        };
    }
}
