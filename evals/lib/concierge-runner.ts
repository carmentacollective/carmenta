/**
 * Configurable Concierge Runner for Evals
 *
 * Runs the concierge logic with a configurable model, allowing comparison
 * of different model candidates for the concierge role.
 */

import { readFile } from "fs/promises";
import { join } from "path";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool } from "ai";
import { z } from "zod";

import type { ConciergeResult } from "@/lib/concierge";
import { buildConciergePrompt } from "@/lib/concierge/prompt";
import {
    ALLOWED_MODELS,
    CONCIERGE_DEFAULTS,
    MAX_EXPLANATION_LENGTH,
    MAX_TITLE_LENGTH,
    REASONING_TOKEN_BUDGETS,
    TOKEN_BUDGET_MODELS,
    type ReasoningConfig,
    type ReasoningEffort,
} from "@/lib/concierge/types";
import type { ConciergeOutput } from "../scorers/concierge-scorer";
import type { ConciergeTestInput } from "../concierge-test-data";

/** Cache for the rubric content */
let rubricCache: string | null = null;

async function getRubricContent(): Promise<string> {
    if (rubricCache) {
        return rubricCache;
    }
    const rubricPath = join(process.cwd(), "knowledge", "model-rubric.md");
    rubricCache = await readFile(rubricPath, "utf-8");
    return rubricCache;
}

/** Zod schema for concierge output */
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
        .describe("Short title for the connection (2-50 chars, required)"),
});

function parseEffortLevel(effort: unknown): ReasoningEffort {
    if (
        effort === "high" ||
        effort === "medium" ||
        effort === "low" ||
        effort === "none"
    ) {
        return effort;
    }
    return "medium";
}

function buildReasoningConfig(
    modelId: string,
    rawConfig: { enabled?: boolean; effort?: string }
): ReasoningConfig {
    if (!rawConfig.enabled) {
        return { enabled: false };
    }

    const effort = parseEffortLevel(rawConfig.effort);

    if (TOKEN_BUDGET_MODELS.includes(modelId as (typeof TOKEN_BUDGET_MODELS)[number])) {
        return {
            enabled: true,
            effort,
            maxTokens: REASONING_TOKEN_BUDGETS[effort],
        };
    }

    return {
        enabled: true,
        effort,
    };
}

function processConciergeResponse(
    raw: z.infer<typeof conciergeSchema>
): ConciergeResult {
    const { modelId, temperature, explanation, reasoning: rawReasoning, title } = raw;

    if (!ALLOWED_MODELS.includes(modelId as (typeof ALLOWED_MODELS)[number])) {
        return {
            ...CONCIERGE_DEFAULTS,
            title: title ?? undefined,
        };
    }

    const reasoning = buildReasoningConfig(modelId, rawReasoning);

    let cleanTitle: string | undefined;
    if (title) {
        cleanTitle = title.trim();
        if (
            (cleanTitle.startsWith('"') && cleanTitle.endsWith('"')) ||
            (cleanTitle.startsWith("'") && cleanTitle.endsWith("'"))
        ) {
            cleanTitle = cleanTitle.slice(1, -1);
        }
        if ([...cleanTitle].length > MAX_TITLE_LENGTH) {
            cleanTitle =
                [...cleanTitle].slice(0, MAX_TITLE_LENGTH - 3).join("") + "...";
        }
        if (cleanTitle.length < 2) {
            cleanTitle = undefined;
        }
    }

    return {
        modelId,
        temperature,
        explanation,
        reasoning,
        title: cleanTitle,
    };
}

export interface ConciergeRunnerOptions {
    /** The model to use for the concierge (OpenRouter format) */
    conciergeModel: string;
    /** OpenRouter API key */
    apiKey: string;
}

/**
 * Runs the concierge with a configurable model.
 * Returns the routing decision plus metadata for evaluation.
 */
export async function runConciergeEval(
    input: ConciergeTestInput,
    options: ConciergeRunnerOptions
): Promise<ConciergeOutput> {
    const startTime = performance.now();

    try {
        const openrouter = createOpenRouter({
            apiKey: options.apiKey,
        });

        const rubricContent = await getRubricContent();
        const systemPrompt = buildConciergePrompt(rubricContent);

        // Handle audio attachment special case
        if (input.attachments?.some((a) => a.type === "audio")) {
            const latencyMs = Math.round(performance.now() - startTime);
            return {
                modelId: "google/gemini-3-pro-preview",
                temperature: 0.5,
                explanation:
                    "Audio file detected - routing to Gemini for native audio processing 🎵",
                reasoning: { enabled: false },
                autoSwitched: true,
                title: generateFallbackTitle(input.query),
                latencyMs,
                isValid: true,
            };
        }

        // Build attachment block if present
        let messageBlock = `<user-message>\n${input.query}\n</user-message>`;
        if (input.attachments && input.attachments.length > 0) {
            const attachmentTypes = input.attachments.map((a) => a.type).join(", ");
            messageBlock = `<attachments>${attachmentTypes}</attachments>\n\n${messageBlock}`;
        }

        const prompt = `Analyze the following user message and select the optimal configuration (model, temperature, reasoning, title). Do NOT answer the message - only return the configuration JSON.

${messageBlock}

Return ONLY the JSON configuration. No markdown code fences, no explanations, no other text.`;

        // Define the routing tool
        const selectModelTool = tool({
            description:
                "Select the optimal model, temperature, reasoning config, and title for the user's request",
            inputSchema: conciergeSchema,
            execute: async (toolInput) => toolInput,
        });

        const result = await generateText({
            model: openrouter.chat(options.conciergeModel),
            system: systemPrompt,
            prompt,
            temperature: 0.1,
            maxRetries: 1,
            tools: {
                selectModelTool,
            },
            toolChoice: "required",
        });

        const latencyMs = Math.round(performance.now() - startTime);

        if (!result.toolCalls || result.toolCalls.length === 0) {
            return {
                ...CONCIERGE_DEFAULTS,
                latencyMs,
                isValid: false,
                error: "No tool call generated - model did not select routing",
            };
        }

        const validated = (
            result.toolCalls[0] as { input: z.infer<typeof conciergeSchema> }
        ).input;

        const conciergeResult = processConciergeResponse(validated);

        return {
            ...conciergeResult,
            latencyMs,
            isValid: true,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            ...CONCIERGE_DEFAULTS,
            latencyMs,
            isValid: false,
            error: errorMessage,
        };
    }
}

/**
 * Generates a simple fallback title when bypassing concierge.
 */
function generateFallbackTitle(query: string): string {
    // Take first 40 chars of query, trim to word boundary
    const truncated = query.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(" ");
    const title = lastSpace > 10 ? truncated.slice(0, lastSpace) : truncated;
    return title.length < query.length ? title + "..." : title;
}

/**
 * Model candidates for concierge evaluation.
 * These are the models we're comparing for the concierge role.
 *
 * To add or modify candidates:
 * 1. Verify the model exists on OpenRouter (check /tmp/openrouter-models.json or the API)
 * 2. Get accurate cost data from OpenRouter pricing
 * 3. Update the tokensPerSecond estimate based on benchmarks
 *
 * Cost estimates are approximate - verify against OpenRouter pricing page.
 */
export const CONCIERGE_MODEL_CANDIDATES = [
    {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        description: "Current production concierge model",
        costPer1M: { input: 1.0, output: 5.0 },
        tokensPerSecond: 150,
    },
    {
        id: "openai/gpt-5-nano",
        name: "GPT-5 Nano",
        description: "Fast, cheap alternative - verify availability on OpenRouter",
        costPer1M: { input: 0.05, output: 0.4 },
        tokensPerSecond: 200,
    },
    {
        id: "google/gemini-3-flash-preview",
        name: "Gemini 3 Flash",
        description: "Newest Google flash model - verify availability on OpenRouter",
        costPer1M: { input: 0.5, output: 3.0 },
        tokensPerSecond: 180,
    },
] as const;

export type ConciergeModelCandidate = (typeof CONCIERGE_MODEL_CANDIDATES)[number];
