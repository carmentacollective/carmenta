/**
 * LLM-as-Judge Scorer for Title Quality
 *
 * Uses an LLM to assess the quality of generated titles on multiple dimensions:
 * - Relevance: Does the title capture the essence of the query?
 * - Conciseness: Is the title appropriately brief?
 * - Clarity: Is the title easy to understand?
 * - Distinctiveness: Would this title help identify this conversation later?
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { ConciergeTestInput } from "./cases";
import type { ConciergeOutput } from "./scorer";

const JUDGE_MODEL = "anthropic/claude-haiku-4.5";

const titleQualitySchema = z.object({
    relevance: z
        .number()
        .min(0)
        .max(1)
        .describe(
            "How well does the title capture the core intent of the query? 0 = irrelevant, 1 = perfectly captures the essence"
        ),
    conciseness: z
        .number()
        .min(0)
        .max(1)
        .describe(
            "Is the title appropriately brief without losing meaning? 0 = too long/verbose, 1 = optimal length"
        ),
    clarity: z
        .number()
        .min(0)
        .max(1)
        .describe(
            "How easy is it to understand what this conversation is about? 0 = confusing, 1 = immediately clear"
        ),
    distinctiveness: z
        .number()
        .min(0)
        .max(1)
        .describe(
            "Would this title help find this specific conversation later? 0 = generic/unmemorable, 1 = uniquely identifying"
        ),
    emojiAppropriate: z
        .number()
        .min(0)
        .max(1)
        .describe(
            "If emoji present, does it add value? If no emoji, was that the right choice? 0 = poor emoji usage, 1 = perfect emoji choice"
        ),
    overallQuality: z
        .number()
        .min(0)
        .max(1)
        .describe(
            "Overall title quality considering all factors. 0 = poor, 1 = excellent"
        ),
    reasoning: z.string().describe("Brief explanation of the scores"),
});

export type TitleQualityScores = z.infer<typeof titleQualitySchema>;

interface TitleQualityScorerArgs {
    input: ConciergeTestInput;
    output: ConciergeOutput;
}

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * LLM-as-Judge scorer for title quality.
 * Returns multiple dimension scores plus an overall quality score.
 */
export async function TitleQualityScorer({
    input,
    output,
}: TitleQualityScorerArgs): Promise<Score[]> {
    // If no title generated, return zero scores
    if (!output.title || output.title.trim().length === 0) {
        return [
            {
                name: "Title Relevance",
                score: 0,
                metadata: { reason: "no title generated" },
            },
            {
                name: "Title Conciseness",
                score: 0,
                metadata: { reason: "no title generated" },
            },
            {
                name: "Title Clarity",
                score: 0,
                metadata: { reason: "no title generated" },
            },
            {
                name: "Title Distinctiveness",
                score: 0,
                metadata: { reason: "no title generated" },
            },
            {
                name: "Title Emoji Usage",
                score: 0,
                metadata: { reason: "no title generated" },
            },
            {
                name: "Title Overall Quality",
                score: 0,
                metadata: { reason: "no title generated" },
            },
        ];
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return [
            {
                name: "Title Overall Quality",
                score: 0,
                metadata: { reason: "missing OPENROUTER_API_KEY" },
            },
        ];
    }

    try {
        const openrouter = createOpenRouter({ apiKey });

        const { output: scores } = await generateText({
            model: openrouter.chat(JUDGE_MODEL),
            output: Output.object({ schema: titleQualitySchema }),
            prompt: `You are evaluating the quality of a title generated for a conversation.

<user-query>
${input.query}
</user-query>

<generated-title>
${output.title}
</generated-title>

Rate this title on each dimension from 0.0 to 1.0. Consider:

**Relevance**: Does the title accurately represent what the user is asking about? A title about "Python debugging" for a question about JavaScript would score low.

**Conciseness**: Is it appropriately brief? Titles should be 2-50 characters. Under 30 is ideal. Over 40 may be too long.

**Clarity**: Would someone understand what this conversation is about just from the title? Avoid jargon or ambiguity.

**Distinctiveness**: Would this title help find this conversation among many others? "Help with code" is generic. "Fix React useEffect infinite loop" is distinctive.

**Emoji Usage**: If there's an emoji, does it add value and match the topic? If there's no emoji, was that the right choice for a simple/informational query?

**Overall Quality**: Considering all factors, how good is this title? A great title is relevant, concise, clear, distinctive, and has appropriate emoji usage.

Be honest and critical. Most titles should score between 0.5 and 0.9. Reserve 1.0 for truly excellent titles.`,
            temperature: 0.1,
        });

        return [
            {
                name: "Title Relevance",
                score: scores.relevance,
                metadata: { title: output.title, query: input.query.slice(0, 100) },
            },
            {
                name: "Title Conciseness",
                score: scores.conciseness,
                metadata: { title: output.title, length: output.title.length },
            },
            {
                name: "Title Clarity",
                score: scores.clarity,
                metadata: { title: output.title },
            },
            {
                name: "Title Distinctiveness",
                score: scores.distinctiveness,
                metadata: { title: output.title },
            },
            {
                name: "Title Emoji Usage",
                score: scores.emojiAppropriate,
                metadata: {
                    title: output.title,
                    hasEmoji: /\p{Emoji}/u.test(output.title),
                },
            },
            {
                name: "Title Overall Quality",
                score: scores.overallQuality,
                metadata: {
                    title: output.title,
                    reasoning: scores.reasoning,
                    query: input.query.slice(0, 100),
                },
            },
        ];
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return [
            {
                name: "Title Overall Quality",
                score: 0,
                metadata: { error: errorMessage, title: output.title },
            },
        ];
    }
}

/**
 * Wrapper to use the async scorer with Braintrust.
 * Braintrust scorers can be async functions.
 */
export function createTitleQualityScorer() {
    return TitleQualityScorer;
}
