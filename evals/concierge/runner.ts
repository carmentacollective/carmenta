/**
 * Configurable Concierge Runner for Evals
 *
 * Runs the concierge logic with a configurable model, allowing comparison
 * of different model candidates for the concierge role.
 *
 * Uses Vercel AI Gateway for consistent provider access across all models.
 */

import { readFile } from "fs/promises";
import { join } from "path";

import { createGateway } from "@ai-sdk/gateway";
import { generateText, tool } from "ai";
import { z } from "zod";

import type { ConciergeResult } from "@/lib/concierge";
import { buildConciergePrompt } from "@/lib/concierge/prompt";
import { analyzeQueryComplexity } from "@/lib/concierge/input-builder";
import {
    ALLOWED_MODELS,
    CONCIERGE_DEFAULTS,
    MAX_EXPLANATION_LENGTH,
    MAX_TITLE_LENGTH,
    REASONING_TOKEN_BUDGETS,
    TOKEN_BUDGET_MODELS,
    type ReasoningConfig,
    type ReasoningEffort,
    type QueryComplexitySignals,
} from "@/lib/concierge/types";
import type { ConciergeOutput } from "./scorer";
import type { ConciergeTestInput } from "./cases";

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
    /** The model to use for the concierge (Vercel AI Gateway format) */
    conciergeModel: string;
    /** Vercel AI Gateway API key */
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
        const gateway = createGateway({
            apiKey: options.apiKey,
        });

        const rubricContent = await getRubricContent();
        const systemPrompt = buildConciergePrompt(rubricContent);

        // Handle audio/video attachment special case - only Gemini supports native audio/video
        // Both audio and video use Gemini 3 Pro (AUDIO_CAPABLE_MODEL and VIDEO_CAPABLE_MODEL
        // are the same in model-config.ts)
        if (input.attachments?.some((a) => a.type === "audio" || a.type === "video")) {
            const latencyMs = Math.round(performance.now() - startTime);
            const isVideo = input.attachments.some((a) => a.type === "video");
            return {
                modelId: "google/gemini-3-pro-preview",
                temperature: 0.5,
                explanation: isVideo
                    ? "Video file detected - routing to Gemini for native video processing 🎬"
                    : "Audio file detected - routing to Gemini for native audio processing 🎵",
                reasoning: { enabled: false },
                autoSwitched: true,
                title: generateFallbackTitle(input.query),
                latencyMs,
                isValid: true,
            };
        }

        // Extract query complexity signals (same as production)
        const querySignals = analyzeQueryComplexity(input.query);

        // Build query signals block (matches production format)
        const querySignalsBlock = `<query-signals>
characterCount: ${querySignals.characterCount}
questionCount: ${querySignals.questionCount}
hasStructuredFormatting: ${querySignals.hasStructuredFormatting}
hasDepthIndicators: ${querySignals.hasDepthIndicators}
hasConditionalLogic: ${querySignals.hasConditionalLogic}
referencesPreviousContext: ${querySignals.referencesPreviousContext}
hasSpeedSignals: ${querySignals.hasSpeedSignals}
hasExplicitDepthSignals: ${querySignals.hasExplicitDepthSignals}
</query-signals>`;

        // Build session context block
        const sessionBlock = input.sessionContext
            ? `<session-context>
turnCount: ${input.sessionContext.turnCount ?? 1}
isFirstMessage: ${input.sessionContext.isFirstMessage ?? true}
deviceType: ${input.sessionContext.deviceType ?? "desktop"}
</session-context>`
            : `<session-context>
turnCount: 1
isFirstMessage: true
deviceType: desktop
</session-context>`;

        // Build attachment block if present
        let attachmentBlock = "";
        if (input.attachments && input.attachments.length > 0) {
            const attachmentTypes = input.attachments.map((a) => a.type).join(", ");
            attachmentBlock = `<attachments>${attachmentTypes}</attachments>\n\n`;
        }

        // Build recent context block if present
        let recentContextBlock = "";
        if (input.recentContext) {
            recentContextBlock = `<recent-context>
lastAssistantMessage: ${input.recentContext.lastAssistantMessage ?? "none"}
conversationDepth: ${input.recentContext.conversationDepth ?? 1}
</recent-context>\n\n`;
        }

        const prompt = `Analyze the following user message and select the optimal configuration (model, temperature, reasoning, title). Do NOT answer the message - only return the configuration JSON.

${querySignalsBlock}

${sessionBlock}

${recentContextBlock}${attachmentBlock}<user-message>
${input.query}
</user-message>

Return ONLY the JSON configuration. No markdown code fences, no explanations, no other text.`;

        // Define the routing tool
        const selectModelTool = tool({
            description:
                "Select the optimal model, temperature, reasoning config, and title for the user's request",
            inputSchema: conciergeSchema,
            execute: async (toolInput) => toolInput,
        });

        const result = await generateText({
            model: gateway(options.conciergeModel),
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
 * 1. Verify the model exists on Vercel AI Gateway
 *    curl https://ai-gateway.vercel.sh/v1/models -H "Authorization: Bearer $AI_GATEWAY_API_KEY" | jq '.data[].id'
 * 2. Get speed estimates from provider docs
 *
 * Speed estimates from Groq docs (groq.com/docs/models).
 */
export const CONCIERGE_MODEL_CANDIDATES = [
    // Current production model
    {
        id: "google/gemini-3-flash",
        name: "Gemini 3 Flash",
        description: "Current production concierge - auto prompt caching",
        costPer1M: { input: 0.15, output: 0.6 },
        tokensPerSecond: 218,
    },
    // SPEED CONTENDERS - Groq-hosted models
    {
        id: "openai/gpt-oss-20b",
        name: "GPT-OSS 20B (Groq)",
        description: "Fastest available - 1000 T/s via Groq LPU",
        costPer1M: { input: 0.06, output: 0.06 },
        tokensPerSecond: 1000,
    },
    {
        id: "meta/llama-3.1-8b",
        name: "Llama 3.1 8B (Groq)",
        description: "Fast small model - 560 T/s via Groq LPU",
        costPer1M: { input: 0.05, output: 0.08 },
        tokensPerSecond: 560,
    },
    {
        id: "meta/llama-3.3-70b",
        name: "Llama 3.3 70B (Groq)",
        description: "Best Llama model - 280 T/s via Groq LPU",
        costPer1M: { input: 0.59, output: 0.79 },
        tokensPerSecond: 280,
    },
    {
        id: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B (Groq)",
        description: "Large fast model - 500 T/s via Groq LPU",
        costPer1M: { input: 0.25, output: 0.25 },
        tokensPerSecond: 500,
    },
    // Baseline comparison models
    {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        description: "Anthropic's fast model - reliable tool calling",
        costPer1M: { input: 1.0, output: 5.0 },
        tokensPerSecond: 100,
    },
    {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5",
        description: "Anthropic's capable model - best quality baseline",
        costPer1M: { input: 3.0, output: 15.0 },
        tokensPerSecond: 60,
    },
    {
        id: "xai/grok-4.1-fast-non-reasoning",
        name: "Grok 4.1 Fast",
        description: "xAI's fast model - 2M context",
        costPer1M: { input: 0.2, output: 0.5 },
        tokensPerSecond: 151,
    },
] as const;

export type ConciergeModelCandidate = (typeof CONCIERGE_MODEL_CANDIDATES)[number];
