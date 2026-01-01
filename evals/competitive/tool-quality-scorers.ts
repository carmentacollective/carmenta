/**
 * Tool Quality Scorers
 *
 * LLM-based scorers for evaluating tool usage QUALITY, not just whether tools were used.
 * These scorers assess:
 * - Web Search Relevance: Did search match intent? Were results synthesized well?
 * - Research Depth: Multiple perspectives? Source diversity? Acknowledged limitations?
 * - Comparison Completeness: All items compared? Fair treatment? Clear recommendation?
 *
 * Uses AI SDK with OpenRouter for LLM evaluation.
 */

import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

import type { CompetitiveQuery } from "./queries";

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EVAL_MODEL = process.env.EVAL_MODEL ?? "openai/gpt-4o-mini";
const RESPONSE_TEXT_LIMIT = 5000; // chars - balance context vs token cost

// Initialize OpenRouter provider (null if key missing)
const openrouter = OPENROUTER_API_KEY
    ? createOpenRouter({ apiKey: OPENROUTER_API_KEY })
    : null;

// Warn if API key is missing
if (!OPENROUTER_API_KEY) {
    console.warn(
        "⚠️  OPENROUTER_API_KEY not set - tool quality scorers will be skipped"
    );
}

/** Input for tool quality scorers */
export interface ToolQualityScorerInput {
    query: CompetitiveQuery;
    responseText: string;
    toolsCalled: string[];
}

/** Standard score output */
export interface Score {
    name: string;
    score: number | null;
    metadata?: Record<string, unknown>;
}

// Quality rating levels
type QualityRating = "Excellent" | "Good" | "Acceptable" | "Poor";

// Schema for LLM quality judgment
const QualityJudgmentSchema = z.object({
    rating: z.enum(["Excellent", "Good", "Acceptable", "Poor"]),
    rationale: z.string().describe("Brief explanation of the rating"),
});

// Map ratings to numeric scores
const RATING_SCORES: Record<QualityRating, number> = {
    Excellent: 1.0,
    Good: 0.75,
    Acceptable: 0.5,
    Poor: 0.25,
};

// Patterns to detect research-oriented queries
const RESEARCH_INDICATORS = [
    /\bresearch\b/i,
    /\bcompare\b/i,
    /\banalyze\b/i,
    /\binvestigate\b/i,
    /\boptions?\b/i,
    /\bpros?\s+(and|&)\s+cons?\b/i,
    /\btradeoffs?\b/i,
    /\badvantages?\b/i,
    /\bdisadvantages?\b/i,
    /\balternatives?\b/i,
    /\bdeep\s+research\b/i,
    /\bdo\s+research\b/i,
];

// Patterns to detect comparison queries
const COMPARISON_PATTERNS = [
    /\bcompare\s+(.+?)\s+(?:vs\.?|versus|and|to|with)\s+(.+)/i,
    /(.+?)\s+(?:vs\.?|versus)\s+(.+)/i,
    /\bdifference\s+between\s+(.+?)\s+and\s+(.+)/i,
    /\bwhich\s+(?:should|is\s+better|would)\b.*\bor\b/i,
    /\bchoosing\s+between\b/i,
];

/**
 * Web Search Relevance Scorer
 *
 * Evaluates the quality of web search usage when search tools are invoked.
 * Only applies when webSearch tool was called.
 */
export async function webSearchRelevanceScorer(
    input: ToolQualityScorerInput
): Promise<Score | null> {
    // Only score if webSearch was actually called
    if (!input.toolsCalled.includes("webSearch")) {
        return null;
    }

    // Skip if OpenRouter not configured
    if (!openrouter) {
        return null;
    }

    try {
        const { object } = await generateObject({
            model: openrouter(EVAL_MODEL),
            schema: QualityJudgmentSchema,
            prompt: `You are evaluating how well web search was used to answer a user query.

User Query:
${input.query.query}

Response (which used web search):
${input.responseText.slice(0, RESPONSE_TEXT_LIMIT)}

Evaluate the web search quality on these criteria:
1. QUERY FORMULATION: Did the search appear to capture the user's actual intent?
2. RESULT RELEVANCE: Does the response contain current/relevant information that web search would provide?
3. SYNTHESIS QUALITY: Did the response synthesize search results into a coherent answer (vs just listing results)?
4. SOURCE ATTRIBUTION: Are claims backed by specific sources when appropriate?

Rate as Excellent, Good, Acceptable, or Poor.`,
        });

        return {
            name: "Web Search Relevance",
            score: RATING_SCORES[object.rating],
            metadata: {
                rating: object.rating,
                rationale: object.rationale,
                toolsCalled: input.toolsCalled,
                category: input.query.category,
            },
        };
    } catch (error) {
        return {
            name: "Web Search Relevance",
            score: null,
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

/**
 * Research Depth Scorer
 *
 * Evaluates thoroughness of research for queries requiring investigation.
 * Applies to queries containing research indicators.
 */
export async function researchDepthScorer(
    input: ToolQualityScorerInput
): Promise<Score | null> {
    // Check if query is research-oriented
    const isResearchQuery = RESEARCH_INDICATORS.some((pattern) =>
        pattern.test(input.query.query)
    );

    // Also apply to "tools" category which expects deep research
    const isToolsCategory = input.query.category === "tools";

    if (!isResearchQuery && !isToolsCategory) {
        return null;
    }

    // Skip if OpenRouter not configured
    if (!openrouter) {
        return null;
    }

    try {
        const { object } = await generateObject({
            model: openrouter(EVAL_MODEL),
            schema: QualityJudgmentSchema,
            prompt: `You are evaluating the depth and quality of research in a response.

User Query (requesting research/analysis):
${input.query.query}

Response:
${input.responseText.slice(0, RESPONSE_TEXT_LIMIT)}

Evaluate research depth on these criteria:
1. MULTIPLE PERSPECTIVES: Were different viewpoints or approaches explored?
2. SOURCE DIVERSITY: Does it appear to draw from multiple sources (not just one viewpoint)?
3. LIMITATIONS ACKNOWLEDGED: Does it mention caveats, uncertainties, or when things don't apply?
4. ACTIONABLE CONCLUSIONS: Does it provide clear takeaways (not just an information dump)?

Rate as Excellent, Good, Acceptable, or Poor.`,
        });

        return {
            name: "Research Depth",
            score: RATING_SCORES[object.rating],
            metadata: {
                rating: object.rating,
                rationale: object.rationale,
                isResearchQuery,
                isToolsCategory,
                category: input.query.category,
            },
        };
    } catch (error) {
        return {
            name: "Research Depth",
            score: null,
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

/**
 * Comparison Completeness Scorer
 *
 * Evaluates quality of comparison responses for X vs Y queries.
 * Applies to queries with comparison patterns.
 */
export async function comparisonCompletenessScorer(
    input: ToolQualityScorerInput
): Promise<Score | null> {
    // Check if query is a comparison
    const isComparisonQuery = COMPARISON_PATTERNS.some((pattern) =>
        pattern.test(input.query.query)
    );

    if (!isComparisonQuery) {
        return null;
    }

    // Skip if OpenRouter not configured
    if (!openrouter) {
        return null;
    }

    try {
        const { object } = await generateObject({
            model: openrouter(EVAL_MODEL),
            schema: QualityJudgmentSchema,
            prompt: `You are evaluating the quality of a comparison response.

User Query (requesting comparison):
${input.query.query}

Response:
${input.responseText.slice(0, RESPONSE_TEXT_LIMIT)}

Evaluate comparison quality on these criteria:
1. COVERAGE: Were ALL items mentioned in the query actually compared?
2. APPROPRIATE CRITERIA: Were the comparison dimensions relevant to the user's context?
3. BALANCE: Was each option treated fairly (not clearly biased toward one)?
4. CLEAR RECOMMENDATION: Does it provide guidance on when to choose each option?

Rate as Excellent, Good, Acceptable, or Poor.`,
        });

        return {
            name: "Comparison Completeness",
            score: RATING_SCORES[object.rating],
            metadata: {
                rating: object.rating,
                rationale: object.rationale,
                category: input.query.category,
            },
        };
    } catch (error) {
        return {
            name: "Comparison Completeness",
            score: null,
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

/**
 * Run all applicable tool quality scorers
 *
 * Returns array of scores for applicable scorers (null scorers are filtered out).
 */
export async function runToolQualityScorers(
    input: ToolQualityScorerInput
): Promise<Score[]> {
    const results = await Promise.allSettled([
        webSearchRelevanceScorer(input),
        researchDepthScorer(input),
        comparisonCompletenessScorer(input),
    ]);

    // Extract fulfilled results and filter out null scores
    return results
        .filter(
            (r): r is PromiseFulfilledResult<Score | null> => r.status === "fulfilled"
        )
        .map((r) => r.value)
        .filter((score): score is Score => score !== null);
}
