/**
 * Autoevals Integration for Title Generation
 *
 * Uses Braintrust's autoevals library for additional scoring dimensions:
 * - Semantic similarity between title and message
 * - LLM-based title quality assessment
 *
 * Uses OpenRouter for LLM calls (OPENROUTER_API_KEY).
 * Falls back to OpenAI (OPENAI_API_KEY) if OpenRouter is not configured.
 */

import OpenAI from "openai";
import {
    init as initAutoevals,
    EmbeddingSimilarity,
    LLMClassifierFromTemplate,
    Levenshtein,
} from "autoevals";

import type { TitleTestInput, TitleExpectations } from "./cases";
import type { TitleOutput } from "./runner";

// Initialize autoevals with OpenRouter-compatible client
const openRouterKey = process.env.OPENROUTER_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;

if (openRouterKey) {
    // Use OpenRouter as OpenAI-compatible endpoint
    const client = new OpenAI({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "https://carmenta.ai",
            "X-Title": "Carmenta Evals",
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initAutoevals({ client: client as any });
} else if (openAiKey) {
    // Fall back to OpenAI directly
    const client = new OpenAI({ apiKey: openAiKey });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initAutoevals({ client: client as any });
}

interface AutoevalScorerArgs {
    input: TitleTestInput;
    output: TitleOutput;
    expected?: TitleExpectations;
}

interface Score {
    name: string;
    score: number | null;
    metadata?: Record<string, unknown>;
}

/**
 * Semantic similarity scorer.
 * Measures how well the title captures the semantic meaning of the input message.
 *
 * Uses embeddings to compare the title against the user message.
 * Higher score = title semantically relates to the message content.
 */
export async function SemanticTitleScorer({
    input,
    output,
}: AutoevalScorerArgs): Promise<Score> {
    if (!output.success) {
        return {
            name: "Semantic Similarity",
            score: null,
            metadata: { error: "Title generation failed" },
        };
    }

    try {
        // Compare title to the user message (truncated for efficiency)
        const messagePreview = input.userMessage.slice(0, 200);
        const result = await EmbeddingSimilarity({
            output: output.title,
            expected: messagePreview,
        });

        return {
            name: "Semantic Similarity",
            score: result.score,
            metadata: {
                title: output.title,
                messagePreview,
            },
        };
    } catch (error) {
        return {
            name: "Semantic Similarity",
            score: null,
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

/**
 * Title quality scorer using LLM-as-judge.
 * Evaluates whether the title is:
 * - Concise and scannable
 * - Topic-focused (not question-focused)
 * - Specific enough to be useful
 * - Free of generic phrases
 */
const TitleQualityLLM = LLMClassifierFromTemplate({
    name: "TitleQuality",
    promptTemplate: `You are evaluating the quality of a conversation title.

The user's message was:
{{input}}

The generated title is:
{{output}}

Evaluate the title on these criteria:
1. CONCISE: Is it short and scannable (ideally 3-6 words)?
2. TOPIC-FOCUSED: Does it describe the topic, not repeat the question format?
3. SPECIFIC: Is it specific enough to distinguish from other conversations?
4. NOT GENERIC: Does it avoid generic phrases like "Help with...", "Question about..."?

Rate the title quality:`,
    choiceScores: {
        // Excellent: concise, topic-focused, specific, avoids generic phrases
        Excellent: 1.0,
        // Good: meets most criteria, minor room for improvement
        Good: 0.75,
        // Acceptable: functional but generic or could be more specific
        Acceptable: 0.5,
        // Poor: too generic, too long, question-formatted, or misses topic
        Poor: 0.25,
    },
    model: "gpt-4o-mini",
    useCoT: false,
    temperature: 0,
});

/**
 * LLM-based title quality scorer.
 * Uses GPT-4o-mini to evaluate title quality holistically.
 */
export async function LLMTitleQualityScorer({
    input,
    output,
}: AutoevalScorerArgs): Promise<Score> {
    if (!output.success) {
        return {
            name: "LLM Title Quality",
            score: null,
            metadata: { error: "Title generation failed" },
        };
    }

    try {
        // Type assertion needed due to autoevals type definitions
        const result = await TitleQualityLLM({
            input: input.userMessage.slice(0, 500),
            output: output.title,
        } as Parameters<typeof TitleQualityLLM>[0]);

        return {
            name: "LLM Title Quality",
            score: result.score,
            metadata: {
                title: output.title,
                ...result.metadata,
            },
        };
    } catch (error) {
        return {
            name: "LLM Title Quality",
            score: null,
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

/**
 * Edit distance scorer for code titles.
 * Compares generated title against expected gitmoji patterns.
 *
 * Only applies to code context where we expect specific formats.
 */
export async function GitmojFormatScorer({
    input,
    output,
}: AutoevalScorerArgs): Promise<Score | null> {
    // Only score code context
    if (input.context !== "code" || !output.success) {
        return null;
    }

    // Expected gitmoji format patterns
    const expectedPatterns = [
        "🐛 Fix",
        "✨ Add",
        "♻️ Refactor",
        "📝 Update",
        "🔧 Configure",
        "🚀 Deploy",
        "🎨 Style",
        "✅ Test",
    ];

    // Find best matching pattern
    let bestScore = 0;
    let bestPattern = "";

    for (const pattern of expectedPatterns) {
        const prefix = output.title.slice(0, pattern.length + 5);
        const result = await Levenshtein({
            output: prefix.toLowerCase(),
            expected: pattern.toLowerCase(),
        });
        if (result.score !== null && result.score > bestScore) {
            bestScore = result.score;
            bestPattern = pattern;
        }
    }

    return {
        name: "Gitmoji Format",
        score: bestScore,
        metadata: {
            title: output.title,
            bestMatchPattern: bestPattern,
        },
    };
}

/**
 * Combined autoevals scorer that runs all applicable scorers.
 * Returns an array of scores.
 */
export async function AutoevalsScorer(args: AutoevalScorerArgs): Promise<Score[]> {
    const scores: Score[] = [];

    // Run scorers in parallel for efficiency
    const [semantic, llmQuality, gitmoji] = await Promise.all([
        SemanticTitleScorer(args),
        LLMTitleQualityScorer(args),
        GitmojFormatScorer(args),
    ]);

    scores.push(semantic);
    scores.push(llmQuality);

    // Only add gitmoji score for code context
    if (gitmoji) {
        scores.push(gitmoji);
    }

    return scores;
}
