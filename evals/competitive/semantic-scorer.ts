/**
 * LLM-as-Judge Scorer for Semantic Correctness
 *
 * Uses Opus via OpenRouter to evaluate whether AI responses actually answer
 * the user's question correctly. Measures dimensions that matter for quality:
 *
 * - answersQuestion: Does the response address what was asked?
 * - factualAccuracy: Are claims correct or at least not demonstrably wrong?
 * - completeness: Are all relevant aspects covered given query complexity?
 * - relevance: Is content on-topic without unnecessary padding?
 * - overallQuality: Holistic assessment considering all factors
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { CompetitiveQuery } from "./queries";

const JUDGE_MODEL = "anthropic/claude-opus-4.5";

/** Failure classification to distinguish infra issues from quality issues */
type FailureType =
    | "none"
    | "http_error"
    | "stream_error"
    | "stream_crash"
    | "truncated"
    | "body_error";

/** Detected error event from the SSE stream */
interface StreamError {
    type: "error" | "tool-error";
    message?: string;
    code?: string;
    raw: unknown;
}

interface CompetitiveOutput {
    text: string;
    model?: string;
    reasoningEnabled: boolean;
    toolsCalled: string[];
    latencyMs: number;
    status: number;
    streamErrors: StreamError[];
    failureType: FailureType;
    failureReason?: string;
    wasTruncated: boolean;
    tokens?: {
        input?: number;
        output?: number;
    };
}

// Note: Anthropic's structured output doesn't support min/max on numbers,
// so we rely on the prompt to constrain scores to 0-1 range
const semanticCorrectnessSchema = z.object({
    answersQuestion: z
        .number()
        .describe(
            "Score 0.0-1.0: Does the response directly address the user's query? 0 = completely misses the point, 1 = directly and fully answers what was asked"
        ),
    factualAccuracy: z
        .number()
        .describe(
            "Score 0.0-1.0: Are factual claims correct? 0 = demonstrably wrong, 0.5 = uncertain/unverifiable but plausible, 1 = verifiably correct"
        ),
    completeness: z
        .number()
        .describe(
            "Score 0.0-1.0: Are all relevant aspects covered given query complexity? 0 = major gaps, 1 = appropriately thorough"
        ),
    relevance: z
        .number()
        .describe(
            "Score 0.0-1.0: Is content on-topic without unnecessary padding? 0 = mostly filler, 1 = every part serves the answer"
        ),
    overallQuality: z
        .number()
        .describe(
            "Score 0.0-1.0: Holistic assessment of response quality. 0 = poor, 1 = excellent"
        ),
    reasoning: z
        .string()
        .describe(
            "Brief explanation of the scores, noting specific strengths or issues"
        ),
});

export type SemanticCorrectnessScores = z.infer<typeof semanticCorrectnessSchema>;

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * Build the evaluation prompt for Opus.
 * Includes query context and any expected elements to guide scoring.
 */
function buildEvaluationPrompt(query: CompetitiveQuery, response: string): string {
    const expectedSection = query.expectedElements?.length
        ? `\n<expected-elements>
Key elements a good response should include:
${query.expectedElements.map((e) => `- ${e}`).join("\n")}
</expected-elements>`
        : "";

    const approachSection = query.expectedApproach
        ? `\n<expected-approach>
${query.expectedApproach}
</expected-approach>`
        : "";

    return `You are evaluating an AI assistant's response quality. Given a user query and the assistant's response, score the response on multiple dimensions.

<query-context>
Category: ${query.category}
Difficulty: ${query.difficulty}
Primary dimensions to evaluate: ${query.primaryDimensions.join(", ")}
</query-context>

<user-query>
${query.query}
</user-query>

<assistant-response>
${response}
</assistant-response>
${expectedSection}${approachSection}

Score each dimension 0.0-1.0:

**answersQuestion**: Does the response directly address what was asked? Consider whether the core question is answered, not just adjacent topics discussed.

**factualAccuracy**: Are factual claims correct? Score 0 for demonstrably wrong claims, 1.0 for verifiably correct OR well-sourced current information. For queries requiring current information (web search, recent events, pricing), evaluate whether the response cites specific sources, dates, or details rather than making vague claims. Well-sourced current information should score high even if you cannot personally verify it—the presence of specificity and source attribution indicates quality. If no factual claims are made, score based on whether the reasoning is sound.

**completeness**: Given the query's complexity, are all relevant aspects covered? A simple question needs a simple answer. A complex question needs appropriate depth. Missing major aspects scores low.

**relevance**: Is the content on-topic? Does every part serve the answer, or is there unnecessary padding, tangents, or filler? Concise, focused responses score higher.

**overallQuality**: Holistic assessment. A great response is accurate, complete, relevant, and clearly written. Be calibrated - most responses should score 0.5-0.8. Reserve 0.9+ for truly excellent responses.

Be honest and critical. Consider the query's difficulty level - an "expert" query should be judged against higher standards.`;
}

/**
 * LLM-as-Judge scorer for semantic correctness.
 * Returns multiple dimension scores plus an overall quality score.
 */
export async function SemanticCorrectnessScorer({
    input,
    output,
}: {
    input: CompetitiveQuery;
    output: CompetitiveOutput;
}): Promise<Score[]> {
    // If infrastructure failed, skip semantic scoring
    if (output.failureType !== "none") {
        return [
            {
                name: "Semantic Correctness",
                score: 0,
                metadata: {
                    skipped: true,
                    skipReason: `Infrastructure failure: ${output.failureType}`,
                },
            },
        ];
    }

    // If no response text, return zero scores
    if (!output.text || output.text.trim().length === 0) {
        return [
            {
                name: "Answers Question",
                score: 0,
                metadata: { reason: "no response text" },
            },
            {
                name: "Factual Accuracy",
                score: 0,
                metadata: { reason: "no response text" },
            },
            {
                name: "Completeness",
                score: 0,
                metadata: { reason: "no response text" },
            },
            {
                name: "Relevance",
                score: 0,
                metadata: { reason: "no response text" },
            },
            {
                name: "Semantic Correctness",
                score: 0,
                metadata: { reason: "no response text" },
            },
        ];
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return [
            {
                name: "Semantic Correctness",
                score: 0,
                metadata: { reason: "missing OPENROUTER_API_KEY" },
            },
        ];
    }

    try {
        const openrouter = createOpenRouter({ apiKey });

        const { output: scores } = await generateText({
            model: openrouter.chat(JUDGE_MODEL),
            output: Output.object({ schema: semanticCorrectnessSchema }),
            prompt: buildEvaluationPrompt(input, output.text),
            temperature: 0.1,
        });

        return [
            {
                name: "Answers Question",
                score: scores.answersQuestion,
                metadata: {
                    queryId: input.id,
                    category: input.category,
                    responsePreview: output.text.slice(0, 200),
                },
            },
            {
                name: "Factual Accuracy",
                score: scores.factualAccuracy,
                metadata: { queryId: input.id, category: input.category },
            },
            {
                name: "Completeness",
                score: scores.completeness,
                metadata: {
                    queryId: input.id,
                    difficulty: input.difficulty,
                    expectedElements: input.expectedElements,
                },
            },
            {
                name: "Relevance",
                score: scores.relevance,
                metadata: { queryId: input.id, responseLength: output.text.length },
            },
            {
                name: "Semantic Correctness",
                score: scores.overallQuality,
                metadata: {
                    queryId: input.id,
                    category: input.category,
                    difficulty: input.difficulty,
                    reasoning: scores.reasoning,
                    model: output.model,
                    responsePreview: output.text.slice(0, 300),
                },
            },
        ];
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Return all dimension scores for consistency with empty response handling
        return [
            {
                name: "Answers Question",
                score: 0,
                metadata: { error: errorMessage },
            },
            {
                name: "Factual Accuracy",
                score: 0,
                metadata: { error: errorMessage },
            },
            {
                name: "Completeness",
                score: 0,
                metadata: { error: errorMessage },
            },
            {
                name: "Relevance",
                score: 0,
                metadata: { error: errorMessage },
            },
            {
                name: "Semantic Correctness",
                score: 0,
                metadata: {
                    error: errorMessage,
                    queryId: input.id,
                    responsePreview: output.text.slice(0, 200),
                },
            },
        ];
    }
}
