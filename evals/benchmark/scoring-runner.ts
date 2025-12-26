/**
 * Carmenta Scoring Benchmark Runner
 *
 * Evaluates Carmenta responses with 0-100 scores across multiple dimensions.
 * Designed for tracking improvement over time and identifying weaknesses.
 *
 * Usage:
 *   pnpm tsx evals/benchmark/scoring-runner.ts
 *
 * Options:
 *   --limit N      Only run first N queries (default: all)
 *   --category X   Only run queries in category X
 *   --output FILE  Output file (default: results/scores-YYYY-MM-DD.json)
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root
config({ path: resolve(process.cwd(), ".env.local") });
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

import {
    benchmarkQueries,
    type BenchmarkQuery,
    type BenchmarkCategory,
    type ScoringDimension,
} from "./queries";

// ============================================================================
// Configuration
// ============================================================================

const CARMENTA_BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Judge model for scoring
const JUDGE_MODEL = "openai/o3-mini";

// ============================================================================
// Types
// ============================================================================

interface DimensionScore {
    dimension: ScoringDimension;
    score: number; // 0-100
    reasoning: string;
}

interface QueryScore {
    queryId: string;
    query: BenchmarkQuery;
    response: string;
    latencyMs: number;
    error?: string;
    dimensions: DimensionScore[];
    overallScore: number; // Weighted average of dimensions
    timestamp: string;
}

interface CategorySummary {
    category: BenchmarkCategory;
    avgScore: number;
    queryCount: number;
    lowestScoring: { queryId: string; score: number }[];
}

interface BenchmarkResults {
    timestamp: string;
    version: string;
    overallScore: number;
    queryCount: number;
    byCategory: CategorySummary[];
    byDimension: { dimension: ScoringDimension; avgScore: number }[];
    lowestScoring: { queryId: string; score: number; category: string }[];
    queryResults: QueryScore[];
}

// ============================================================================
// Scoring Rubric
// ============================================================================

const DIMENSION_RUBRICS: Record<ScoringDimension, string> = {
    accuracy: `
ACCURACY (0-100): Is the response factually correct?
- 90-100: Completely accurate, no errors
- 70-89: Mostly accurate, minor errors that don't affect usefulness
- 50-69: Partially accurate, some significant errors
- 30-49: More wrong than right
- 0-29: Fundamentally incorrect or misleading`,

    completeness: `
COMPLETENESS (0-100): Does the response fully address the query?
- 90-100: Comprehensive, covers all aspects thoroughly
- 70-89: Covers main points, minor gaps
- 50-69: Addresses core question but missing important aspects
- 30-49: Incomplete, misses key elements
- 0-29: Barely addresses the question`,

    clarity: `
CLARITY (0-100): Is the response well-organized and easy to understand?
- 90-100: Crystal clear, excellent structure, easy to follow
- 70-89: Clear with good organization
- 50-69: Understandable but could be better organized
- 30-49: Confusing or poorly structured
- 0-29: Incomprehensible or incoherent`,

    recency: `
RECENCY (0-100): Does the response use current/up-to-date information?
- 90-100: Uses latest information, acknowledges currency appropriately
- 70-89: Reasonably current, minor outdated elements
- 50-69: Mix of current and outdated information
- 30-49: Mostly outdated
- 0-29: Severely outdated or uses deprecated approaches`,

    actionability: `
ACTIONABILITY (0-100): Can the user take action based on this response?
- 90-100: Immediately actionable with clear next steps
- 70-89: Actionable with minor clarification needed
- 50-69: Provides direction but requires significant additional work
- 30-49: Vague, hard to act on
- 0-29: Not actionable`,

    tool_usage: `
TOOL USAGE (0-100): Did the response appropriately use available tools?
- 90-100: Perfect tool selection and execution
- 70-89: Good tool usage with minor improvements possible
- 50-69: Used tools but not optimally
- 30-49: Missed obvious tool opportunities or misused tools
- 0-29: Failed to use tools when clearly needed`,
};

// ============================================================================
// Carmenta API
// ============================================================================

async function callCarmenta(
    query: string
): Promise<{ text: string; latencyMs: number; error?: string }> {
    const startTime = Date.now();

    try {
        const response = await fetch(`${CARMENTA_BASE_URL}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(JWT_TOKEN && { Authorization: `Bearer ${JWT_TOKEN}` }),
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

        if (!response.ok) {
            return {
                text: "",
                latencyMs: Date.now() - startTime,
                error: `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const text = await consumeStream(response);
        return {
            text,
            latencyMs: Date.now() - startTime,
        };
    } catch (error) {
        return {
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
    const eventTypes = new Set<string>();
    let lineCount = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            lineCount++;
            if (line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type) eventTypes.add(data.type);

                    // Handle various AI SDK stream formats
                    if (data.type === "text-delta" && data.delta) {
                        text += data.delta;
                    } else if (data.type === "text-delta" && data.textDelta) {
                        text += data.textDelta;
                    } else if (data.type === "text" && data.text) {
                        text += data.text;
                    } else if (data.type === "tool-output-available" && data.output) {
                        // Capture tool outputs as part of response
                        const output =
                            typeof data.output === "string"
                                ? data.output
                                : JSON.stringify(data.output, null, 2);
                        text += output + "\n\n";
                    }
                } catch {
                    // Skip non-JSON lines
                }
            }
        }
    }

    // Debug: log stream info if no text captured
    if (text.length === 0 && lineCount > 0) {
        console.log(
            `    [DEBUG] ${lineCount} lines, events: ${[...eventTypes].join(", ")}`
        );
    }

    return text;
}

// ============================================================================
// Scoring Judge
// ============================================================================

async function scoreResponse(
    query: BenchmarkQuery,
    response: string
): Promise<{ dimensions: DimensionScore[]; overallScore: number }> {
    if (!response || response.trim() === "") {
        // Empty response gets 0 on all dimensions
        return {
            dimensions: query.primaryDimensions.map((dim) => ({
                dimension: dim,
                score: 0,
                reasoning: "No response provided",
            })),
            overallScore: 0,
        };
    }

    const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY! });

    // Build rubric for this query's dimensions
    const rubrics = query.primaryDimensions
        .map((dim) => DIMENSION_RUBRICS[dim])
        .join("\n\n");

    const prompt = `You are evaluating an AI assistant's response. Score each dimension 0-100.

QUERY:
${query.query}

RESPONSE TO EVALUATE:
${response}

SCORING RUBRICS:
${rubrics}

IMPORTANT:
- Be strict but fair
- Consider the query's specific requirements
- A score of 70+ means genuinely good
- A score of 90+ is exceptional
- Don't inflate scores

Respond with ONLY valid JSON in this exact format:
{
  "scores": [
    ${query.primaryDimensions.map((dim) => `{"dimension": "${dim}", "score": <0-100>, "reasoning": "<brief explanation>"}`).join(",\n    ")}
  ]
}`;

    try {
        const result = await generateText({
            model: openrouter.chat(JUDGE_MODEL),
            prompt,
            maxOutputTokens: 1024,
        });

        // Parse JSON from response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in judge response");
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const dimensions: DimensionScore[] = parsed.scores.map(
            (s: { dimension: ScoringDimension; score: number; reasoning: string }) => ({
                dimension: s.dimension,
                score: Math.min(100, Math.max(0, s.score)), // Clamp to 0-100
                reasoning: s.reasoning,
            })
        );

        // Calculate overall as average of dimension scores
        const overallScore = Math.round(
            dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
        );

        return { dimensions, overallScore };
    } catch (error) {
        console.error(`    Scoring error: ${error}`);
        // Return middle-ground scores on error
        return {
            dimensions: query.primaryDimensions.map((dim) => ({
                dimension: dim,
                score: 50,
                reasoning: `Scoring error: ${error}`,
            })),
            overallScore: 50,
        };
    }
}

// ============================================================================
// Main Runner
// ============================================================================

async function runBenchmark(
    queries: BenchmarkQuery[],
    categoryFilter?: BenchmarkCategory
): Promise<BenchmarkResults> {
    const filteredQueries = categoryFilter
        ? queries.filter((q) => q.category === categoryFilter)
        : queries;

    console.log(`\n📊 Running ${filteredQueries.length} queries\n`);

    const queryResults: QueryScore[] = [];

    for (let i = 0; i < filteredQueries.length; i++) {
        const query = filteredQueries[i];
        console.log(`[${i + 1}/${filteredQueries.length}] ${query.id}`);
        console.log(`   Category: ${query.category} | Difficulty: ${query.difficulty}`);

        // Call Carmenta
        process.stdout.write("   Carmenta... ");
        const { text, latencyMs, error } = await callCarmenta(query.query);

        if (error) {
            console.log(`❌ ${error}`);
        } else {
            console.log(`✅ ${latencyMs}ms (${text.length} chars)`);
        }

        // Score the response
        process.stdout.write("   Scoring... ");
        const { dimensions, overallScore } = await scoreResponse(query, text);
        console.log(`${overallScore}/100`);

        // Show dimension breakdown
        for (const dim of dimensions) {
            const bar =
                "█".repeat(Math.floor(dim.score / 10)) +
                "░".repeat(10 - Math.floor(dim.score / 10));
            console.log(`      ${dim.dimension.padEnd(14)} ${bar} ${dim.score}`);
        }

        queryResults.push({
            queryId: query.id,
            query,
            response: text,
            latencyMs,
            error,
            dimensions,
            overallScore,
            timestamp: new Date().toISOString(),
        });

        console.log();
    }

    // Calculate summaries
    const overallScore = Math.round(
        queryResults.reduce((sum, q) => sum + q.overallScore, 0) / queryResults.length
    );

    // By category
    const categories = [...new Set(queryResults.map((q) => q.query.category))];
    const byCategory: CategorySummary[] = categories.map((cat) => {
        const catResults = queryResults.filter((q) => q.query.category === cat);
        const avgScore = Math.round(
            catResults.reduce((sum, q) => sum + q.overallScore, 0) / catResults.length
        );
        const sorted = [...catResults].sort((a, b) => a.overallScore - b.overallScore);
        return {
            category: cat,
            avgScore,
            queryCount: catResults.length,
            lowestScoring: sorted.slice(0, 3).map((q) => ({
                queryId: q.queryId,
                score: q.overallScore,
            })),
        };
    });

    // By dimension
    const allDimensions = [
        ...new Set(queryResults.flatMap((q) => q.dimensions.map((d) => d.dimension))),
    ];
    const byDimension = allDimensions.map((dim) => {
        const scores = queryResults
            .flatMap((q) => q.dimensions)
            .filter((d) => d.dimension === dim);
        return {
            dimension: dim,
            avgScore: Math.round(
                scores.reduce((sum, d) => sum + d.score, 0) / scores.length
            ),
        };
    });

    // Overall lowest scoring
    const lowestScoring = [...queryResults]
        .sort((a, b) => a.overallScore - b.overallScore)
        .slice(0, 10)
        .map((q) => ({
            queryId: q.queryId,
            score: q.overallScore,
            category: q.query.category,
        }));

    return {
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        overallScore,
        queryCount: queryResults.length,
        byCategory,
        byDimension,
        lowestScoring,
        queryResults,
    };
}

function printResults(results: BenchmarkResults): void {
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║            BENCHMARK RESULTS                   ║");
    console.log("╚════════════════════════════════════════════════╝\n");

    // Overall score with visual bar
    const overallBar =
        "█".repeat(Math.floor(results.overallScore / 5)) +
        "░".repeat(20 - Math.floor(results.overallScore / 5));
    console.log(`📊 OVERALL SCORE: ${overallBar} ${results.overallScore}/100`);
    console.log(`   Queries evaluated: ${results.queryCount}\n`);

    // By category
    console.log("📂 BY CATEGORY:");
    for (const cat of results.byCategory.sort((a, b) => b.avgScore - a.avgScore)) {
        const bar =
            "█".repeat(Math.floor(cat.avgScore / 5)) +
            "░".repeat(20 - Math.floor(cat.avgScore / 5));
        console.log(
            `   ${cat.category.padEnd(18)} ${bar} ${cat.avgScore}/100 (${cat.queryCount} queries)`
        );
    }

    // By dimension
    console.log("\n📏 BY DIMENSION:");
    for (const dim of results.byDimension.sort((a, b) => b.avgScore - a.avgScore)) {
        const bar =
            "█".repeat(Math.floor(dim.avgScore / 5)) +
            "░".repeat(20 - Math.floor(dim.avgScore / 5));
        console.log(`   ${dim.dimension.padEnd(18)} ${bar} ${dim.avgScore}/100`);
    }

    // Lowest scoring (improvement opportunities)
    console.log("\n⚠️  LOWEST SCORING (improvement opportunities):");
    for (const low of results.lowestScoring) {
        console.log(
            `   ${low.score.toString().padStart(3)}/100  ${low.queryId} (${low.category})`
        );
    }
}

async function main(): Promise<void> {
    // Parse args
    const args = process.argv.slice(2);
    let limit: number | undefined;
    let category: BenchmarkCategory | undefined;
    let outputFile: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--limit" && args[i + 1]) {
            limit = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === "--category" && args[i + 1]) {
            category = args[i + 1] as BenchmarkCategory;
            i++;
        } else if (args[i] === "--output" && args[i + 1]) {
            outputFile = args[i + 1];
            i++;
        }
    }

    // Validate config
    if (!JWT_TOKEN) {
        console.error("❌ TEST_USER_TOKEN not set in .env.local");
        process.exit(1);
    }
    if (!OPENROUTER_API_KEY) {
        console.error("❌ OPENROUTER_API_KEY not set in .env.local");
        process.exit(1);
    }

    // Load queries
    let queries = [...benchmarkQueries];

    // Log dataset info
    const categoryCounts = queries.reduce(
        (acc, q) => {
            acc[q.category] = (acc[q.category] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );
    console.log("Benchmark dataset loaded:", {
        ...categoryCounts,
        total: queries.length,
    });

    // Apply limit
    if (limit) {
        queries = queries.slice(0, limit);
    }

    // Print header
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║       Carmenta Scoring Benchmark Runner        ║");
    console.log("╚════════════════════════════════════════════════╝\n");

    if (category) {
        console.log(`📂 Category filter: ${category}`);
    }
    if (limit) {
        console.log(`🔢 Limit: ${limit} queries`);
    }

    // Run benchmark
    const results = await runBenchmark(queries, category);

    // Print results
    printResults(results);

    // Save results
    const resultsDir = join(process.cwd(), "evals/benchmark/results");
    mkdirSync(resultsDir, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const filename = outputFile || `scores-${date}.json`;
    const filepath = join(resultsDir, filename);

    writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${filepath}`);

    // Show trend if previous results exist
    const previousFile = join(resultsDir, `scores-${getPreviousDate(date)}.json`);
    if (existsSync(previousFile)) {
        try {
            const previous = JSON.parse(
                readFileSync(previousFile, "utf-8")
            ) as BenchmarkResults;
            const delta = results.overallScore - previous.overallScore;
            const arrow = delta > 0 ? "📈" : delta < 0 ? "📉" : "➡️";
            console.log(
                `\n${arrow} Trend: ${delta > 0 ? "+" : ""}${delta} from previous (${previous.overallScore} → ${results.overallScore})`
            );
        } catch {
            // Ignore parse errors
        }
    }
}

function getPreviousDate(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
}

// Run
main().catch(console.error);
