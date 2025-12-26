/**
 * Competitive Benchmark Runner
 *
 * Executes benchmark queries against Carmenta and competitor models,
 * uses LLM-as-judge for pairwise comparison, and aggregates results.
 *
 * Usage:
 *   pnpm tsx evals/benchmark/competitive-runner.ts
 *
 * Options:
 *   --limit N      Only run first N queries (default: all)
 *   --category X   Only run queries in category X
 *   --output FILE  Output file (default: results/benchmark-YYYY-MM-DD.json)
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root
config({ path: resolve(process.cwd(), ".env.local") });
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import {
    benchmarkQueries,
    type BenchmarkQuery,
    type BenchmarkCategory,
} from "./queries";
import { BENCHMARK_JUDGE_MODEL } from "@/lib/model-config";

// ============================================================================
// Configuration
// ============================================================================

const CARMENTA_BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Models to compare against (OpenRouter model IDs - queried Dec 2025)
const COMPETITOR_MODELS = [
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
    { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5" },
    { id: "openai/gpt-5.2-pro", name: "GPT-5.2 Pro" },
    { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro" },
    { id: "x-ai/grok-4.1-fast", name: "Grok 4.1" },
] as const;

// ============================================================================
// Types
// ============================================================================

interface ModelResponse {
    model: string;
    text: string;
    latencyMs: number;
    error?: string;
}

interface PairwiseResult {
    competitor: string;
    winner: "carmenta" | "competitor" | "tie";
    confidence: number;
    reasoning: string;
}

interface QueryResult {
    query: BenchmarkQuery;
    carmentaResponse: ModelResponse;
    competitorResponses: ModelResponse[];
    pairwiseResults: PairwiseResult[];
}

interface CategoryScore {
    category: BenchmarkCategory;
    total: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
}

interface BenchmarkResults {
    timestamp: string;
    totalQueries: number;
    queriesRun: number;
    overall: {
        wins: number;
        losses: number;
        ties: number;
        winRate: number;
    };
    byCategory: CategoryScore[];
    byCompetitor: Array<{
        competitor: string;
        wins: number;
        losses: number;
        ties: number;
        winRate: number;
    }>;
    queryResults: QueryResult[];
}

// ============================================================================
// API Callers
// ============================================================================

/**
 * Call Carmenta API
 */
async function callCarmenta(query: string): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
        const response = await fetch(`${CARMENTA_BASE_URL}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [
                    {
                        id: `bench-${Date.now()}`,
                        role: "user",
                        content: query,
                        parts: [{ type: "text", text: query }],
                    },
                ],
            }),
        });

        const text = await consumeStream(response);
        const latencyMs = Date.now() - startTime;

        return {
            model: "carmenta",
            text,
            latencyMs,
        };
    } catch (error) {
        return {
            model: "carmenta",
            text: "",
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Consume SSE stream from Carmenta - handles multiple AI SDK formats
 */
async function consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";

    const decoder = new TextDecoder();
    let text = "";
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));

                    // Handle various AI SDK stream formats
                    // Only capture text content - tool outputs are processed by the model
                    // and should appear in subsequent text, not as raw JSON
                    if (data.type === "text-delta" && data.delta) {
                        text += data.delta;
                    } else if (data.type === "text-delta" && data.textDelta) {
                        text += data.textDelta;
                    } else if (data.type === "text" && data.text) {
                        text += data.text;
                    }
                } catch {
                    // Skip non-JSON lines
                }
            }
        }
    }

    return text;
}

/**
 * Call competitor model via OpenRouter
 */
async function callCompetitor(
    query: string,
    modelId: string,
    modelName: string
): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
        const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY! });

        const result = await generateText({
            model: openrouter.chat(modelId),
            prompt: query,
            maxOutputTokens: 4096,
        });

        return {
            model: modelName,
            text: result.text,
            latencyMs: Date.now() - startTime,
        };
    } catch (error) {
        return {
            model: modelName,
            text: "",
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================================
// LLM-as-Judge
// ============================================================================

const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator comparing AI assistant responses.

Your job is to determine which response is better for the given query.

Evaluation criteria (in order of importance):
1. **Accuracy**: Factually correct, no hallucinations or fabrications
2. **Completeness**: Addresses all aspects of the query
3. **Clarity**: Well-structured, easy to understand
4. **Actionability**: Provides concrete, useful guidance
5. **Recency**: Uses current information when relevant (for queries requiring recent data)

Output your judgment as JSON:
{
  "winner": "A" | "B" | "tie",
  "confidence": 0.5-1.0,
  "reasoning": "Brief explanation of your decision"
}

Be rigorous. Only declare a tie if responses are genuinely equivalent.
A response with errors loses. A response that's incomplete loses.
Focus on substance over style.`;

/**
 * Use LLM-as-judge for pairwise comparison
 */
async function judgeResponses(
    query: string,
    responseA: string,
    responseB: string,
    labelA: string,
    labelB: string
): Promise<{ winner: "A" | "B" | "tie"; confidence: number; reasoning: string }> {
    const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY! });

    // Randomize order to avoid position bias
    const flip = Math.random() > 0.5;
    const [first, second] = flip
        ? [
              { label: "B", text: responseB },
              { label: "A", text: responseA },
          ]
        : [
              { label: "A", text: responseA },
              { label: "B", text: responseB },
          ];

    const prompt = `## Query
${query}

## Response A
${first.text.slice(0, 4000)}${first.text.length > 4000 ? "\n[truncated...]" : ""}

## Response B
${second.text.slice(0, 4000)}${second.text.length > 4000 ? "\n[truncated...]" : ""}

Which response is better? Output only valid JSON.`;

    try {
        const result = await generateText({
            model: openrouter.chat(BENCHMARK_JUDGE_MODEL),
            system: JUDGE_SYSTEM_PROMPT,
            prompt,
            maxOutputTokens: 500,
        });

        // Parse JSON from response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in judge response");
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Unflip the result if we randomized
        let winner = parsed.winner as "A" | "B" | "tie";
        if (flip && winner !== "tie") {
            winner = winner === "A" ? "B" : "A";
        }

        return {
            winner,
            confidence: parsed.confidence ?? 0.7,
            reasoning: parsed.reasoning ?? "No reasoning provided",
        };
    } catch (error) {
        console.error("Judge error:", error);
        return {
            winner: "tie",
            confidence: 0.5,
            reasoning: `Judge error: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

// ============================================================================
// Main Runner
// ============================================================================

async function runBenchmark(options: {
    limit?: number;
    category?: BenchmarkCategory;
}): Promise<BenchmarkResults> {
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║     Carmenta Competitive Benchmark Runner      ║");
    console.log("╚════════════════════════════════════════════════╝\n");

    // Filter queries
    let queries = benchmarkQueries;
    if (options.category) {
        queries = queries.filter((q) => q.category === options.category);
        console.log(`📂 Category filter: ${options.category}`);
    }
    if (options.limit) {
        queries = queries.slice(0, options.limit);
        console.log(`🔢 Limit: ${options.limit} queries`);
    }

    console.log(
        `📊 Running ${queries.length} queries against ${COMPETITOR_MODELS.length} competitors\n`
    );

    const results: QueryResult[] = [];

    for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`\n[${i + 1}/${queries.length}] ${query.id}`);
        console.log(`   Category: ${query.category} | Difficulty: ${query.difficulty}`);

        // Call Carmenta
        process.stdout.write("   Carmenta... ");
        const carmentaResponse = await callCarmenta(query.query);
        if (carmentaResponse.error) {
            console.log(`❌ Error: ${carmentaResponse.error}`);
        } else {
            console.log(
                `✅ ${carmentaResponse.latencyMs}ms (${carmentaResponse.text.length} chars)`
            );
        }

        // Call competitors
        const competitorResponses: ModelResponse[] = [];
        for (const competitor of COMPETITOR_MODELS) {
            process.stdout.write(`   ${competitor.name}... `);
            const response = await callCompetitor(
                query.query,
                competitor.id,
                competitor.name
            );
            competitorResponses.push(response);
            if (response.error) {
                console.log(`❌ Error: ${response.error}`);
            } else {
                console.log(
                    `✅ ${response.latencyMs}ms (${response.text.length} chars)`
                );
            }
        }

        // Judge pairwise comparisons
        const pairwiseResults: PairwiseResult[] = [];
        for (const compResponse of competitorResponses) {
            if (carmentaResponse.error || compResponse.error) {
                // If both errored, it's a tie
                if (carmentaResponse.error && compResponse.error) {
                    pairwiseResults.push({
                        competitor: compResponse.model,
                        winner: "tie",
                        confidence: 1.0,
                        reasoning: `Both failed: Carmenta (${carmentaResponse.error}), Competitor (${compResponse.error})`,
                    });
                    continue;
                }
                // If only one errored, the non-errored one wins
                pairwiseResults.push({
                    competitor: compResponse.model,
                    winner: carmentaResponse.error ? "competitor" : "carmenta",
                    confidence: 1.0,
                    reasoning: carmentaResponse.error
                        ? `Carmenta error: ${carmentaResponse.error}`
                        : `Competitor error: ${compResponse.error}`,
                });
                continue;
            }

            process.stdout.write(`   Judging vs ${compResponse.model}... `);
            const judgment = await judgeResponses(
                query.query,
                carmentaResponse.text,
                compResponse.text,
                "Carmenta",
                compResponse.model
            );

            const winner =
                judgment.winner === "A"
                    ? "carmenta"
                    : judgment.winner === "B"
                      ? "competitor"
                      : "tie";

            pairwiseResults.push({
                competitor: compResponse.model,
                winner,
                confidence: judgment.confidence,
                reasoning: judgment.reasoning,
            });

            const emoji =
                winner === "carmenta" ? "🏆" : winner === "competitor" ? "❌" : "🤝";
            console.log(
                `${emoji} ${winner} (${Math.round(judgment.confidence * 100)}%)`
            );
        }

        results.push({
            query,
            carmentaResponse,
            competitorResponses,
            pairwiseResults,
        });
    }

    // Aggregate results
    return aggregateResults(results);
}

function aggregateResults(queryResults: QueryResult[]): BenchmarkResults {
    // Overall stats
    let totalWins = 0;
    let totalLosses = 0;
    let totalTies = 0;

    for (const result of queryResults) {
        for (const pairwise of result.pairwiseResults) {
            if (pairwise.winner === "carmenta") totalWins++;
            else if (pairwise.winner === "competitor") totalLosses++;
            else totalTies++;
        }
    }

    const totalComparisons = totalWins + totalLosses + totalTies;

    // By category
    const categories: BenchmarkCategory[] = [
        "reasoning",
        "web-search",
        "tool-integration",
        "edge-cases",
        "real-world",
    ];

    const byCategory: CategoryScore[] = categories.map((category) => {
        const categoryResults = queryResults.filter(
            (r) => r.query.category === category
        );

        let wins = 0,
            losses = 0,
            ties = 0;
        for (const result of categoryResults) {
            for (const pairwise of result.pairwiseResults) {
                if (pairwise.winner === "carmenta") wins++;
                else if (pairwise.winner === "competitor") losses++;
                else ties++;
            }
        }

        const total = wins + losses + ties;
        return {
            category,
            total,
            wins,
            losses,
            ties,
            winRate: total > 0 ? wins / total : 0,
        };
    });

    // By competitor
    const competitorNames = COMPETITOR_MODELS.map((m) => m.name);
    const byCompetitor = competitorNames.map((name) => {
        let wins = 0,
            losses = 0,
            ties = 0;

        for (const result of queryResults) {
            const pairwise = result.pairwiseResults.find((p) => p.competitor === name);
            if (pairwise) {
                if (pairwise.winner === "carmenta") wins++;
                else if (pairwise.winner === "competitor") losses++;
                else ties++;
            }
        }

        const total = wins + losses + ties;
        return {
            competitor: name,
            wins,
            losses,
            ties,
            winRate: total > 0 ? wins / total : 0,
        };
    });

    return {
        timestamp: new Date().toISOString(),
        totalQueries: benchmarkQueries.length,
        queriesRun: queryResults.length,
        overall: {
            wins: totalWins,
            losses: totalLosses,
            ties: totalTies,
            winRate: totalComparisons > 0 ? totalWins / totalComparisons : 0,
        },
        byCategory,
        byCompetitor,
        queryResults,
    };
}

function printResults(results: BenchmarkResults): void {
    console.log("\n");
    console.log("╔════════════════════════════════════════════════╗");
    console.log("║              BENCHMARK RESULTS                 ║");
    console.log("╚════════════════════════════════════════════════╝");

    console.log("\n📊 OVERALL:");
    console.log(`   Queries run: ${results.queriesRun}/${results.totalQueries}`);
    console.log(
        `   Comparisons: ${results.overall.wins + results.overall.losses + results.overall.ties}`
    );
    console.log(`   Win rate: ${(results.overall.winRate * 100).toFixed(1)}%`);
    console.log(
        `   Wins: ${results.overall.wins} | Losses: ${results.overall.losses} | Ties: ${results.overall.ties}`
    );

    console.log("\n📂 BY CATEGORY:");
    for (const cat of results.byCategory) {
        if (cat.total === 0) continue;
        const bar = "█".repeat(Math.round(cat.winRate * 20));
        const empty = "░".repeat(20 - Math.round(cat.winRate * 20));
        console.log(
            `   ${cat.category.padEnd(16)} ${bar}${empty} ${(cat.winRate * 100).toFixed(0).padStart(3)}% (${cat.wins}W/${cat.losses}L/${cat.ties}T)`
        );
    }

    console.log("\n🤖 BY COMPETITOR:");
    for (const comp of results.byCompetitor) {
        if (comp.wins + comp.losses + comp.ties === 0) continue;
        const bar = "█".repeat(Math.round(comp.winRate * 20));
        const empty = "░".repeat(20 - Math.round(comp.winRate * 20));
        console.log(
            `   ${comp.competitor.padEnd(20)} ${bar}${empty} ${(comp.winRate * 100).toFixed(0).padStart(3)}% (${comp.wins}W/${comp.losses}L/${comp.ties}T)`
        );
    }

    console.log("\n");
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
    // Validate environment
    if (!JWT_TOKEN) {
        console.error("❌ Missing TEST_USER_TOKEN environment variable");
        process.exit(1);
    }
    if (!OPENROUTER_API_KEY) {
        console.error("❌ Missing OPENROUTER_API_KEY environment variable");
        process.exit(1);
    }

    // Parse CLI args
    const args = process.argv.slice(2);
    const options: { limit?: number; category?: BenchmarkCategory } = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--limit" && args[i + 1]) {
            options.limit = parseInt(args[i + 1], 10);
            i++;
        }
        if (args[i] === "--category" && args[i + 1]) {
            options.category = args[i + 1] as BenchmarkCategory;
            i++;
        }
    }

    // Run benchmark
    const results = await runBenchmark(options);

    // Print results
    printResults(results);

    // Save results
    const resultsDir = join(process.cwd(), "evals", "benchmark", "results");
    mkdirSync(resultsDir, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const filename = `benchmark-${date}.json`;
    const filepath = join(resultsDir, filename);

    writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

main().catch(console.error);
