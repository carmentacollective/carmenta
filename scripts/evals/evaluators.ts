/**
 * LLM-as-Judge Evaluators for Carmenta
 *
 * Uses Claude as a judge to evaluate response quality across three dimensions:
 * - Correctness: Is the information accurate?
 * - Helpfulness: Would a user find this useful?
 * - Relevance: Does it answer what was asked?
 *
 * Vendor-agnostic: uses Vercel AI SDK with OpenRouter.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

/**
 * Judge model - using GPT-5.1 for high-quality evaluations
 * Different from models being evaluated to avoid self-grading bias
 */
const JUDGE_MODEL = "openai/gpt-5.1";

/**
 * Evaluation result from a single evaluator
 */
export interface EvaluationResult {
    label: string;
    score: number;
    /** What's wrong with the response */
    issue: string;
    /** How to improve (actionable for coding agent) */
    fix: string;
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
 * Parse a structured evaluation response from the judge
 * Expected format:
 * RATING: <label>
 * ISSUE: <what's wrong>
 * FIX: <how to improve>
 */
function parseEvaluation(
    response: string,
    choices: Record<string, number>
): { label: string; score: number; issue: string; fix: string } {
    const lowerResponse = response.toLowerCase();

    // Extract label from RATING line or find it anywhere
    let label = "";
    let score = 0;

    // Sort by length (longest first) to avoid substring false matches
    const sortedChoices = Object.entries(choices).sort(
        ([a], [b]) => b.length - a.length
    );

    for (const [choiceLabel, choiceScore] of sortedChoices) {
        if (lowerResponse.includes(choiceLabel.toLowerCase())) {
            label = choiceLabel;
            score = choiceScore;
            break;
        }
    }

    // Default to worst score if no match
    if (!label) {
        const worstChoice = Object.entries(choices).reduce((worst, [l, s]) =>
            s < worst[1] ? [l, s] : worst
        );
        label = worstChoice[0];
        score = worstChoice[1];
    }

    // Extract ISSUE and FIX sections
    const issueMatch = response.match(/ISSUE:\s*(.+?)(?=FIX:|$)/is);
    const fixMatch = response.match(/FIX:\s*(.+?)$/is);

    const issue = issueMatch ? issueMatch[1].trim() : "";
    const fix = fixMatch ? fixMatch[1].trim() : "";

    return { label, score, issue, fix };
}

/**
 * Run a classification evaluation with actionable feedback
 */
async function classify(
    input: string,
    output: string,
    prompt: string,
    choices: Record<string, number>
): Promise<EvaluationResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY not set");
    }

    const openrouter = createOpenRouter({ apiKey });
    const filledPrompt = prompt
        .replace("{{input}}", input)
        .replace("{{output}}", output);

    const { text } = await generateText({
        model: openrouter.chat(JUDGE_MODEL),
        prompt: filledPrompt,
        maxOutputTokens: 2000,
    });

    const { label, score, issue, fix } = parseEvaluation(text, choices);

    return {
        label,
        score,
        issue,
        fix,
    };
}

/**
 * Correctness Evaluator
 *
 * Evaluates whether the response contains accurate, factual information.
 * Scores: correct (1), partially_correct (0.5), incorrect (0)
 */
async function evaluateCorrectness(
    input: string,
    output: string
): Promise<EvaluationResult> {
    const prompt = `You are evaluating the factual correctness of an AI assistant called "Carmenta". Your feedback will be used by a coding agent to improve the system prompt, tools, or response generation.

User Question:
{{input}}

AI Response:
{{output}}

Evaluate the response for factual accuracy. Consider:
1. Are the stated facts accurate?
2. Are there any factual errors or hallucinations?
3. Is the information verifiable?

If no specific facts are claimed (e.g., creative writing, opinions), evaluate whether the response is logically consistent and doesn't make false claims.

Respond in this exact format:

RATING: <one of: correct, partially_correct, incorrect>
ISSUE: <If not "correct", explain specifically what facts are wrong or missing. Be concrete.>
FIX: <If not "correct", suggest how to fix it. Reference specific changes to: system prompt instructions, tool usage, response formatting, or information sourcing. Be actionable.>

Example for a good response:
RATING: correct
ISSUE: None
FIX: None

Example for a problematic response:
RATING: partially_correct
ISSUE: The response states WW2 ended in 1944, but it actually ended in 1945 (VE Day May 8, VJ Day Sept 2).
FIX: For simple factual questions, ensure the model provides the correct date without hedging. Consider adding a fact-checking step or using web search for date verification.

Now evaluate:`;

    return classify(input, output, prompt, {
        correct: 1,
        partially_correct: 0.5,
        incorrect: 0,
    });
}

/**
 * Helpfulness Evaluator
 *
 * Evaluates whether the response would be useful to the user.
 * Scores: very_helpful (1), somewhat_helpful (0.5), not_helpful (0)
 */
async function evaluateHelpfulness(
    input: string,
    output: string
): Promise<EvaluationResult> {
    const prompt = `You are evaluating how helpful an AI assistant called "Carmenta" is. Your feedback will be used by a coding agent to improve the system prompt, tools, or response generation.

Carmenta has access to tools: webSearch (search the web), deepResearch (multi-step research), compareOptions (structured comparisons), fetchPage (fetch a URL). The response may show tool usage.

User Question:
{{input}}

AI Response:
{{output}}

Evaluate the response for helpfulness. Consider:
1. Does it address what the user actually needs?
2. Is it actionable and practical?
3. Is it appropriately detailed (not too sparse, not overwhelming)?
4. If tools were available, were they used effectively?
5. Does it provide value beyond a simple answer?

Respond in this exact format:

RATING: <one of: very_helpful, somewhat_helpful, not_helpful>
ISSUE: <If not "very_helpful", explain specifically what's missing or could be better. Be concrete about what the user needed but didn't get.>
FIX: <If not "very_helpful", suggest how to fix it. Reference specific changes to: system prompt instructions, tool selection/usage, response length/depth, or formatting. Be actionable.>

Example for a good response:
RATING: very_helpful
ISSUE: None
FIX: None

Example for a problematic response:
RATING: somewhat_helpful
ISSUE: The response explains the concept but doesn't provide the code example the user asked for. User wanted actionable code, got theory.
FIX: Update system prompt to prioritize code examples when users ask "how to" questions. For programming questions, lead with working code, then explain.

Now evaluate:`;

    return classify(input, output, prompt, {
        very_helpful: 1,
        somewhat_helpful: 0.5,
        not_helpful: 0,
    });
}

/**
 * Relevance Evaluator
 *
 * Evaluates whether the response directly answers what was asked.
 * Scores: relevant (1), partially_relevant (0.5), irrelevant (0)
 */
async function evaluateRelevance(
    input: string,
    output: string
): Promise<EvaluationResult> {
    const prompt = `You are evaluating whether an AI assistant called "Carmenta" gives relevant responses. Your feedback will be used by a coding agent to improve the system prompt, tools, or response generation.

User Question:
{{input}}

AI Response:
{{output}}

Evaluate the response for relevance. Consider:
1. Does it directly address the question asked?
2. Does it stay on topic without unnecessary tangents?
3. Is the information provided pertinent to what was requested?
4. Does it answer what was asked vs. what might have been interesting to add?

Respond in this exact format:

RATING: <one of: relevant, partially_relevant, irrelevant>
ISSUE: <If not "relevant", explain specifically what's off-topic or missing. What did the user ask for that wasn't addressed?>
FIX: <If not "relevant", suggest how to fix it. Reference specific changes to: system prompt focus instructions, response scoping, or query interpretation. Be actionable.>

Example for a good response:
RATING: relevant
ISSUE: None
FIX: None

Example for a problematic response:
RATING: partially_relevant
ISSUE: User asked for the capital of France. Response correctly says Paris but then goes into a long history of French politics that wasn't requested.
FIX: Add system prompt instruction: "Match response depth to question complexity. Simple factual questions get concise answers. Only elaborate when the question warrants it."

Now evaluate:`;

    return classify(input, output, prompt, {
        relevant: 1,
        partially_relevant: 0.5,
        irrelevant: 0,
    });
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
    // Run all evaluations in parallel
    const [correctness, helpfulness, relevance] = await Promise.all([
        evaluateCorrectness(input, output),
        evaluateHelpfulness(input, output),
        evaluateRelevance(input, output),
    ]);

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

/**
 * Check if scoring is available (OpenRouter API key is configured)
 */
export function isScoringAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Format a single score line for compact display
 */
export function formatScoreCompact(scores: QualityScores): string {
    const emoji = (s: number) => (s >= 0.75 ? "✓" : s >= 0.25 ? "~" : "✗");
    return `${emoji(scores.correctness.score)}C ${emoji(scores.helpfulness.score)}H ${emoji(scores.relevance.score)}R = ${(scores.overall * 100).toFixed(0)}%`;
}
