/**
 * Model Comparison Script
 *
 * A/B test two models using competitive queries and LLM-as-judge evaluation.
 * Results are stored in Braintrust for analysis.
 *
 * Usage:
 *   pnpm tsx scripts/compare-models.ts <model-a> <model-b> [--full]
 *
 * Examples:
 *   pnpm tsx scripts/compare-models.ts anthropic/claude-3.5-sonnet anthropic/claude-opus-4.5
 *   pnpm tsx scripts/compare-models.ts openai/gpt-4o anthropic/claude-3.5-sonnet --full
 *
 * Arguments:
 *   <model-a>     First model to test (OpenRouter format)
 *   <model-b>     Second model to test (OpenRouter format)
 *   --full        Run full benchmark (750 questions) - not implemented yet
 *
 * Requirements:
 *   - OPENROUTER_API_KEY in .env.local
 *   - BRAINTRUST_API_KEY in .env.local
 *
 * Output:
 *   - Comparison report showing win rates by category
 *   - Results stored in Braintrust experiment for detailed analysis
 */

import "dotenv/config";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { Eval } from "braintrust";
import { logger } from "@/lib/logger";
import { competitiveQueries, type CompetitiveQuery } from "@/evals/competitive/queries";

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("❌ Missing required arguments\n");
    console.error(
        "Usage: pnpm tsx scripts/compare-models.ts <model-a> <model-b> [--full]\n"
    );
    console.error("Examples:");
    console.error(
        "  pnpm tsx scripts/compare-models.ts anthropic/claude-3.5-sonnet anthropic/claude-opus-4.5"
    );
    console.error(
        "  pnpm tsx scripts/compare-models.ts openai/gpt-4o anthropic/claude-3.5-sonnet --full"
    );
    process.exit(1);
}

const MODEL_A = args[0];
const MODEL_B = args[1];
const FULL_MODE = args.includes("--full");

// Validate environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
    console.error("❌ Missing OPENROUTER_API_KEY environment variable");
    console.error("\n📋 Setup required:");
    console.error("   1. Get an API key from https://openrouter.ai");
    console.error("   2. Add to .env.local: OPENROUTER_API_KEY=<your_key>");
    process.exit(1);
}

if (FULL_MODE) {
    console.error("❌ Full mode (--full) not implemented yet");
    console.error("   Currently only quick mode (25 questions) is supported");
    process.exit(1);
}

// Configuration
const JUDGE_MODEL = "anthropic/claude-3.5-sonnet"; // LLM-as-judge model
const TIMEOUT_MS = 120000; // 2 minutes per query

interface ModelResponse {
    text: string;
    latencyMs: number;
    error?: string;
}

interface ComparisonInput extends CompetitiveQuery {
    queryId: string;
}

interface ComparisonOutput {
    modelA: ModelResponse;
    modelB: ModelResponse;
    winner: "A" | "B" | "tie";
    reasoning: string;
    confidence: "high" | "medium" | "low";
}

/**
 * Query a model via OpenRouter
 */
async function queryModel(
    modelId: string,
    query: string,
    apiKey: string
): Promise<ModelResponse> {
    const startTime = performance.now();

    try {
        const openrouter = createOpenRouter({ apiKey });

        const result = await generateText({
            model: openrouter.chat(modelId),
            prompt: query,
            maxRetries: 1,
            abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const latencyMs = Math.round(performance.now() - startTime);

        return {
            text: result.text,
            latencyMs,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(
            { error, modelId, query: query.slice(0, 100) },
            "Model query failed"
        );

        return {
            text: "",
            latencyMs,
            error: errorMessage,
        };
    }
}

/**
 * Use LLM-as-judge to compare two responses
 */
async function judgeResponses(
    query: CompetitiveQuery,
    responseA: ModelResponse,
    responseB: ModelResponse,
    apiKey: string
): Promise<Pick<ComparisonOutput, "winner" | "reasoning" | "confidence">> {
    const openrouter = createOpenRouter({ apiKey });

    const judgePrompt = `You are evaluating two AI responses to the same query. Your task is to determine which response is better.

Query:
${query.query}

Primary evaluation dimensions for this query: ${query.primaryDimensions.join(", ")}
Category: ${query.category}
Rationale: ${query.rationale}

Response A:
${responseA.error ? `[ERROR: ${responseA.error}]` : responseA.text}

Response B:
${responseB.error ? `[ERROR: ${responseB.error}]` : responseB.text}

Evaluate which response better addresses the query. Consider:
- ${query.primaryDimensions.join("\n- ")}
- Overall quality and helpfulness
- If one response errored, the other wins unless both errored

Respond with:
WINNER: [A, B, or TIE]
CONFIDENCE: [high, medium, or low]
REASONING: [2-3 sentences explaining your decision]`;

    try {
        const result = await generateText({
            model: openrouter.chat(JUDGE_MODEL),
            prompt: judgePrompt,
            temperature: 0.3,
            maxRetries: 1,
            abortSignal: AbortSignal.timeout(60000),
        });

        const text = result.text;

        // Parse winner
        const winnerMatch = text.match(/WINNER:\s*([ABT])/i);
        let winner: "A" | "B" | "tie" = "tie";
        if (winnerMatch) {
            const w = winnerMatch[1].toUpperCase();
            if (w === "A") winner = "A";
            else if (w === "B") winner = "B";
            else if (w === "T") winner = "tie";
        }

        // Parse confidence
        const confidenceMatch = text.match(/CONFIDENCE:\s*(high|medium|low)/i);
        const confidence =
            (confidenceMatch?.[1].toLowerCase() as "high" | "medium" | "low") ??
            "medium";

        // Extract reasoning
        const reasoningMatch = text.match(/REASONING:\s*(.+)/is);
        const reasoning = reasoningMatch?.[1].trim() ?? text;

        return { winner, reasoning, confidence };
    } catch (error) {
        logger.error({ error, query: query.id }, "Judge evaluation failed");

        // If judge fails, mark as tie
        return {
            winner: "tie",
            reasoning: `Judge evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            confidence: "low",
        };
    }
}

/**
 * Compare two models on a single query
 */
async function compareModels(
    input: ComparisonInput,
    modelA: string,
    modelB: string,
    apiKey: string
): Promise<ComparisonOutput> {
    logger.info(
        { queryId: input.queryId, modelA, modelB },
        "Comparing models on query"
    );

    // Query both models in parallel
    const [responseA, responseB] = await Promise.all([
        queryModel(modelA, input.query, apiKey),
        queryModel(modelB, input.query, apiKey),
    ]);

    // Use LLM-as-judge to compare responses
    const judgment = await judgeResponses(input, responseA, responseB, apiKey);

    return {
        modelA: responseA,
        modelB: responseB,
        ...judgment,
    };
}

/**
 * Calculate win rate statistics by category
 */
function calculateStats(
    results: Array<{ input: ComparisonInput; output: ComparisonOutput }>
) {
    const categories = new Map<
        string,
        { aWins: number; bWins: number; ties: number }
    >();

    for (const { input, output } of results) {
        const category = input.category;
        const stats = categories.get(category) ?? { aWins: 0, bWins: 0, ties: 0 };

        if (output.winner === "A") stats.aWins++;
        else if (output.winner === "B") stats.bWins++;
        else stats.ties++;

        categories.set(category, stats);
    }

    return categories;
}

/**
 * Generate comparison report
 */
function generateReport(
    modelA: string,
    modelB: string,
    results: Array<{ input: ComparisonInput; output: ComparisonOutput }>
) {
    const categoryStats = calculateStats(results);

    // Calculate overall stats
    let totalAWins = 0;
    let totalBWins = 0;
    let totalTies = 0;

    for (const stats of categoryStats.values()) {
        totalAWins += stats.aWins;
        totalBWins += stats.bWins;
        totalTies += stats.ties;
    }

    const total = totalAWins + totalBWins + totalTies;
    const bWinRate = total > 0 ? (totalBWins / (totalAWins + totalBWins)) * 100 : 0;
    const bAdvantage = total > 0 ? ((totalBWins - totalAWins) / total) * 100 : 0;

    // Generate progress bar
    const barLength = 20;
    const bFilled = Math.round((bWinRate / 100) * barLength);
    const progressBar = "█".repeat(bFilled) + "░".repeat(barLength - bFilled);

    console.log("\n");
    console.log(`Model Comparison: ${modelA} vs ${modelB}`);
    console.log("━".repeat(70));
    console.log("");

    // Overall stats
    const overallLabel =
        bAdvantage > 0
            ? `Model B ${bAdvantage > 0 ? "+" : ""}${bAdvantage.toFixed(1)}%`
            : bAdvantage < 0
              ? `Model A +${Math.abs(bAdvantage).toFixed(1)}%`
              : "Tie";
    console.log(
        `Overall:    ${overallLabel.padEnd(20)} [${progressBar}] ${bWinRate.toFixed(0)}% win rate`
    );
    console.log("");

    // Category breakdown
    console.log("By Category:");
    for (const [category, stats] of categoryStats.entries()) {
        const catTotal = stats.aWins + stats.bWins + stats.ties;
        const catBWinRate =
            catTotal > 0 ? (stats.bWins / (stats.aWins + stats.bWins)) * 100 : 0;
        const catBAdvantage =
            catTotal > 0 ? ((stats.bWins - stats.aWins) / catTotal) * 100 : 0;
        const catBFilled = Math.round((catBWinRate / 100) * barLength);
        const catProgressBar =
            "█".repeat(catBFilled) + "░".repeat(barLength - catBFilled);

        const catLabel =
            catBAdvantage > 0
                ? `Model B +${catBAdvantage.toFixed(0)}%`
                : catBAdvantage < 0
                  ? `Model A +${Math.abs(catBAdvantage).toFixed(0)}%`
                  : "Tie";

        console.log(
            `  ${category.padEnd(12)}  ${catLabel.padEnd(16)} [${catProgressBar}] ${catBWinRate.toFixed(0)}% win`
        );
    }

    console.log("");
    console.log(`Total queries: ${total}`);
    console.log(
        `Model A wins: ${totalAWins}, Model B wins: ${totalBWins}, Ties: ${totalTies}`
    );
    console.log("");
}

/**
 * Main evaluation
 */
console.log(`\n🔬 Model Comparison: ${MODEL_A} vs ${MODEL_B}\n`);
console.log(`   Judge model: ${JUDGE_MODEL}`);
console.log(`   Questions: ${competitiveQueries.length}`);
console.log("");

// Capture results for report generation
const capturedResults: Array<{ input: ComparisonInput; output: ComparisonOutput }> = [];

Eval(`Model Comparison: ${MODEL_A} vs ${MODEL_B}`, {
    data: () =>
        competitiveQueries.map((q) => ({
            input: {
                ...q,
                queryId: q.id,
            } as ComparisonInput,
            tags: [q.category, q.difficulty, ...q.tags],
            metadata: {
                modelA: MODEL_A,
                modelB: MODEL_B,
                judgeModel: JUDGE_MODEL,
                category: q.category,
                difficulty: q.difficulty,
            },
        })),

    task: async (input: ComparisonInput): Promise<ComparisonOutput> => {
        const output = await compareModels(input, MODEL_A, MODEL_B, OPENROUTER_API_KEY);

        // Capture results for final report
        capturedResults.push({ input, output });

        return output;
    },

    scores: [
        ({ output }) => ({
            name: "Model A Win",
            score: output.winner === "A" ? 1 : 0,
        }),
        ({ output }) => ({
            name: "Model B Win",
            score: output.winner === "B" ? 1 : 0,
        }),
        ({ output }) => ({
            name: "Tie",
            score: output.winner === "tie" ? 1 : 0,
        }),
        ({ output }) => ({
            name: "High Confidence",
            score: output.confidence === "high" ? 1 : 0,
        }),
        ({ output }) => ({
            name: "Model A Latency (ms)",
            score: output.modelA.latencyMs,
        }),
        ({ output }) => ({
            name: "Model B Latency (ms)",
            score: output.modelB.latencyMs,
        }),
        ({ output }) => ({
            name: "Model A Error",
            score: output.modelA.error ? 1 : 0,
        }),
        ({ output }) => ({
            name: "Model B Error",
            score: output.modelB.error ? 1 : 0,
        }),
    ],

    metadata: {
        modelA: MODEL_A,
        modelB: MODEL_B,
        judgeModel: JUDGE_MODEL,
        queryCount: competitiveQueries.length,
        mode: FULL_MODE ? "full" : "quick",
        commit: process.env.COMMIT_SHA ?? "local",
        environment: process.env.NODE_ENV ?? "development",
    },
});

// Use process exit handler to generate report after eval completes
process.on("beforeExit", () => {
    if (capturedResults.length > 0) {
        generateReport(MODEL_A, MODEL_B, capturedResults);
    }
});
