#!/usr/bin/env bun
/**
 * Carmenta Quality Evaluation Runner
 *
 * Runs a subset of test queries through Carmenta and evaluates response quality
 * using LLM-as-judge (Claude Haiku). Each response is scored on:
 * - Correctness: Is it factually accurate?
 * - Helpfulness: Would a user find it useful?
 * - Relevance: Does it answer the question?
 *
 * Usage:
 *   bun scripts/evals/run-quality-evals.ts [options]
 *
 * Options:
 *   --limit=N      Run only N tests (default: 5)
 *   --verbose      Show full response content
 *   --base-url=X   Override API base URL (default: http://localhost:3000)
 */

import { TEST_QUERIES, type TestQuery } from "./test-queries";
import {
    evaluateResponse,
    formatQualityScores,
    type QualityScores,
} from "./evaluators";

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
    verbose: args.includes("--verbose"),
    limit: parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "5"),
    baseUrl:
        args.find((a) => a.startsWith("--base-url="))?.split("=")[1] ??
        "http://localhost:3000",
};

// Load JWT from environment
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set in environment");
    process.exit(1);
}

// Load Anthropic API key for judge
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    console.error(
        "ERROR: ANTHROPIC_API_KEY not set in environment (needed for LLM judge)"
    );
    process.exit(1);
}

interface EvalResult {
    query: TestQuery;
    response: string;
    duration: number;
    scores: QualityScores;
    error?: string;
}

/**
 * Build UIMessage format required by the API
 */
function buildMessage(content: string) {
    return {
        id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

/**
 * Consume streaming response and extract text content
 */
async function consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";

    const decoder = new TextDecoder();
    let fullText = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
        }
    } catch {
        // Stream read error
    }

    // Extract actual text content from stream (format: 0:"text content"\n)
    let extractedText = "";
    const textMatches = fullText.matchAll(/0:"([^"]*)"/g);
    for (const match of textMatches) {
        try {
            extractedText += JSON.parse(`"${match[1]}"`);
        } catch {
            extractedText += match[1];
        }
    }

    return extractedText || fullText.slice(0, 2000);
}

/**
 * Run a query and get the response
 */
async function runQuery(
    query: TestQuery
): Promise<{ response: string; duration: number; error?: string }> {
    const startTime = Date.now();

    try {
        const response = await fetch(`${flags.baseUrl}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [buildMessage(query.content)],
                ...(query.overrides || {}),
            }),
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                response: "",
                duration,
                error: `HTTP ${response.status}: ${errorText}`,
            };
        }

        const text = await consumeStream(response);
        return { response: text, duration };
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            response: "",
            duration,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Main entry point
 */
async function main() {
    console.log("=".repeat(60));
    console.log("CARMENTA QUALITY EVALUATIONS");
    console.log("=".repeat(60));
    console.log(`Base URL: ${flags.baseUrl}`);
    console.log(`Running ${flags.limit} evaluations with LLM-as-judge\n`);

    // Select a diverse subset of tests for quality evaluation
    // Skip slow tests (deep research) and edge cases
    const qualityTests = TEST_QUERIES.filter(
        (t) => !t.skip && !t.slow && t.category !== "edge-cases"
    ).slice(0, flags.limit);

    const results: EvalResult[] = [];

    for (let i = 0; i < qualityTests.length; i++) {
        const query = qualityTests[i];
        console.log(`\n[${i + 1}/${qualityTests.length}] Running: ${query.id}`);
        console.log(
            `   Query: "${query.content.slice(0, 60)}${query.content.length > 60 ? "..." : ""}"`
        );

        // Get response from Carmenta
        const { response, duration, error } = await runQuery(query);

        if (error) {
            console.log(`   \x1b[31mError: ${error}\x1b[0m`);
            results.push({
                query,
                response: "",
                duration,
                scores: {
                    correctness: { label: "error", score: 0 },
                    helpfulness: { label: "error", score: 0 },
                    relevance: { label: "error", score: 0 },
                    overall: 0,
                },
                error,
            });
            continue;
        }

        console.log(`   Response received (${formatDuration(duration)})`);

        if (flags.verbose) {
            const preview = response.slice(0, 200);
            console.log(`   Response: ${preview}${response.length > 200 ? "..." : ""}`);
        }

        // Evaluate response quality
        console.log(`   Evaluating with LLM judge...`);
        try {
            const scores = await evaluateResponse(query.content, response);
            results.push({ query, response, duration, scores });

            // Display scores
            const scoreColor =
                scores.overall >= 0.7
                    ? "\x1b[32m"
                    : scores.overall >= 0.4
                      ? "\x1b[33m"
                      : "\x1b[31m";
            console.log(
                `   ${scoreColor}Overall: ${(scores.overall * 100).toFixed(0)}%\x1b[0m`
            );
            console.log(
                `   Correctness: ${scores.correctness.label} | Helpfulness: ${scores.helpfulness.label} | Relevance: ${scores.relevance.label}`
            );
        } catch (evalError) {
            console.log(
                `   \x1b[31mEvaluation error: ${evalError instanceof Error ? evalError.message : String(evalError)}\x1b[0m`
            );
            results.push({
                query,
                response,
                duration,
                scores: {
                    correctness: { label: "eval_error", score: 0 },
                    helpfulness: { label: "eval_error", score: 0 },
                    relevance: { label: "eval_error", score: 0 },
                    overall: 0,
                },
                error:
                    evalError instanceof Error ? evalError.message : String(evalError),
            });
        }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("QUALITY SUMMARY");
    console.log("=".repeat(60));

    const validResults = results.filter((r) => !r.error);
    if (validResults.length === 0) {
        console.log("No valid results to summarize.");
        process.exit(1);
    }

    // Calculate averages
    const avgCorrectness =
        validResults.reduce((sum, r) => sum + r.scores.correctness.score, 0) /
        validResults.length;
    const avgHelpfulness =
        validResults.reduce((sum, r) => sum + r.scores.helpfulness.score, 0) /
        validResults.length;
    const avgRelevance =
        validResults.reduce((sum, r) => sum + r.scores.relevance.score, 0) /
        validResults.length;
    const avgOverall =
        validResults.reduce((sum, r) => sum + r.scores.overall, 0) /
        validResults.length;

    console.log(`\nEvaluated: ${validResults.length} responses`);
    console.log(`Errors: ${results.length - validResults.length}`);
    console.log(`\nAverage Scores:`);
    console.log(`  Correctness: ${(avgCorrectness * 100).toFixed(0)}%`);
    console.log(`  Helpfulness: ${(avgHelpfulness * 100).toFixed(0)}%`);
    console.log(`  Relevance:   ${(avgRelevance * 100).toFixed(0)}%`);
    console.log(`  \x1b[1mOverall:      ${(avgOverall * 100).toFixed(0)}%\x1b[0m`);

    // Show individual results table
    console.log(`\nDetailed Results:`);
    console.log("-".repeat(80));
    console.log(
        `${"Query ID".padEnd(25)} | ${"Correct".padEnd(10)} | ${"Helpful".padEnd(10)} | ${"Relevant".padEnd(10)} | Overall`
    );
    console.log("-".repeat(80));

    for (const r of results) {
        const correct = r.scores.correctness.label.slice(0, 8).padEnd(10);
        const helpful = r.scores.helpfulness.label.slice(0, 8).padEnd(10);
        const relevant = r.scores.relevance.label.slice(0, 8).padEnd(10);
        const overall = r.error ? "error" : `${(r.scores.overall * 100).toFixed(0)}%`;
        console.log(
            `${r.query.id.padEnd(25)} | ${correct} | ${helpful} | ${relevant} | ${overall}`
        );
    }

    // Exit with error if average is below threshold
    if (avgOverall < 0.5) {
        console.log("\n\x1b[31mQuality below threshold (50%)\x1b[0m");
        process.exit(1);
    }

    console.log("\n\x1b[32mQuality evaluation complete!\x1b[0m");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
