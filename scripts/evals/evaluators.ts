/**
 * LLM-as-Judge Evaluators for Carmenta
 *
 * Uses Claude as a judge to evaluate response quality across three dimensions:
 * - Correctness: Is the information accurate?
 * - Helpfulness: Would a user find this useful?
 * - Relevance: Does it answer what was asked?
 *
 * These evaluators use the Phoenix evals library with Anthropic Claude as the judge.
 */

import { createClassifierFn } from "@arizeai/phoenix-evals";
import { anthropic } from "@ai-sdk/anthropic";

/**
 * Judge model - using Claude Haiku for fast, cost-effective evaluations
 * Can be upgraded to Sonnet for more nuanced judgments
 */
const judgeModel = anthropic("claude-3-5-haiku-latest");

/** Input shape for our evaluators */
interface EvalInput extends Record<string, unknown> {
    input: string;
    output: string;
}

/**
 * Correctness Evaluator
 *
 * Evaluates whether the response contains accurate, factual information.
 * Scores: correct (1), partially_correct (0.5), incorrect (0)
 */
export function createCorrectnessEvaluator() {
    return createClassifierFn<EvalInput>({
        model: judgeModel,
        choices: {
            correct: 1,
            partially_correct: 0.5,
            incorrect: 0,
        },
        promptTemplate: `You are evaluating the factual correctness of an AI assistant's response.

User Question:
{{input}}

AI Response:
{{output}}

Evaluate the response for factual accuracy. Consider:
1. Are the stated facts accurate?
2. Are there any factual errors or hallucinations?
3. Is the information verifiable?

If no specific facts are claimed (e.g., creative writing, opinions), evaluate whether the response is logically consistent and doesn't make false claims.

Respond with exactly one of these labels:
- "correct" - The response is factually accurate with no errors
- "partially_correct" - The response has some accurate information but also contains minor errors or imprecisions
- "incorrect" - The response contains significant factual errors or hallucinations

Label:`,
    });
}

/**
 * Helpfulness Evaluator
 *
 * Evaluates whether the response would be useful to the user.
 * Scores: very_helpful (1), somewhat_helpful (0.5), not_helpful (0)
 */
export function createHelpfulnessEvaluator() {
    return createClassifierFn<EvalInput>({
        model: judgeModel,
        choices: {
            very_helpful: 1,
            somewhat_helpful: 0.5,
            not_helpful: 0,
        },
        promptTemplate: `You are evaluating how helpful an AI assistant's response is to the user.

User Question:
{{input}}

AI Response:
{{output}}

Evaluate the response for helpfulness. Consider:
1. Does it address what the user actually needs?
2. Is it actionable and practical?
3. Is it appropriately detailed (not too sparse, not overwhelming)?
4. Does it provide value beyond a simple answer?

Respond with exactly one of these labels:
- "very_helpful" - The response fully addresses the user's needs and provides real value
- "somewhat_helpful" - The response partially addresses the needs but could be better
- "not_helpful" - The response fails to address the user's needs or provides no value

Label:`,
    });
}

/**
 * Relevance Evaluator
 *
 * Evaluates whether the response directly answers what was asked.
 * Scores: relevant (1), partially_relevant (0.5), irrelevant (0)
 */
export function createRelevanceEvaluator() {
    return createClassifierFn<EvalInput>({
        model: judgeModel,
        choices: {
            relevant: 1,
            partially_relevant: 0.5,
            irrelevant: 0,
        },
        promptTemplate: `You are evaluating whether an AI assistant's response is relevant to the user's question.

User Question:
{{input}}

AI Response:
{{output}}

Evaluate the response for relevance. Consider:
1. Does it directly address the question asked?
2. Does it stay on topic?
3. Is the information provided pertinent to what was requested?

Respond with exactly one of these labels:
- "relevant" - The response directly and fully addresses the question
- "partially_relevant" - The response addresses the question but also includes irrelevant content or misses key aspects
- "irrelevant" - The response does not address the question or is off-topic

Label:`,
    });
}

/**
 * Evaluation result from a single evaluator
 */
export interface EvaluationResult {
    label: string;
    score: number;
    explanation?: string;
}

/**
 * Combined evaluation results for a response
 */
export interface QualityScores {
    correctness: EvaluationResult;
    helpfulness: EvaluationResult;
    relevance: EvaluationResult;
    /** Overall score (average of all three) */
    overall: number;
}

/**
 * Evaluate a response across all quality dimensions
 *
 * @param input - The user's original question/prompt
 * @param output - The AI's response to evaluate
 * @returns Quality scores across all dimensions
 */
export async function evaluateResponse(
    input: string,
    output: string
): Promise<QualityScores> {
    // Create evaluators (synchronous)
    const correctnessEval = createCorrectnessEvaluator();
    const helpfulnessEval = createHelpfulnessEvaluator();
    const relevanceEval = createRelevanceEvaluator();

    // Run all evaluations in parallel
    const [correctnessResult, helpfulnessResult, relevanceResult] = await Promise.all([
        correctnessEval({ input, output }),
        helpfulnessEval({ input, output }),
        relevanceEval({ input, output }),
    ]);

    // Map results to our format (handle undefined scores)
    const correctness: EvaluationResult = {
        label: correctnessResult.label ?? "unknown",
        score: correctnessResult.score ?? 0,
        explanation: correctnessResult.explanation,
    };
    const helpfulness: EvaluationResult = {
        label: helpfulnessResult.label ?? "unknown",
        score: helpfulnessResult.score ?? 0,
        explanation: helpfulnessResult.explanation,
    };
    const relevance: EvaluationResult = {
        label: relevanceResult.label ?? "unknown",
        score: relevanceResult.score ?? 0,
        explanation: relevanceResult.explanation,
    };

    // Calculate overall score
    const overall = (correctness.score + helpfulness.score + relevance.score) / 3;

    return {
        correctness,
        helpfulness,
        relevance,
        overall,
    };
}

/**
 * Format quality scores for display
 */
export function formatQualityScores(scores: QualityScores): string {
    const formatScore = (result: EvaluationResult) =>
        `${result.label} (${(result.score * 100).toFixed(0)}%)`;

    return [
        `Correctness: ${formatScore(scores.correctness)}`,
        `Helpfulness: ${formatScore(scores.helpfulness)}`,
        `Relevance: ${formatScore(scores.relevance)}`,
        `Overall: ${(scores.overall * 100).toFixed(0)}%`,
    ].join("\n");
}
