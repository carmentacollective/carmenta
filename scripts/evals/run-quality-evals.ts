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
 * Results are logged to Arize AX for tracking and analysis.
 *
 * Usage:
 *   bun scripts/evals/run-quality-evals.ts [options]
 *
 * Options:
 *   --limit=N      Run only N tests (default: 5)
 *   --verbose      Show full response content
 *   --base-url=X   Override API base URL (default: http://localhost:3000)
 *   --no-arize     Skip logging to Arize (console only)
 */

import { trace, SpanStatusCode } from "@opentelemetry/api";
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
    noArize: args.includes("--no-arize"),
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
 * Initialize Arize AX OTEL for tracing evals
 * Based on: https://arize.com/docs/ax/quickstarts/quickstart-tracing
 */
async function initArizeTracing(): Promise<boolean> {
    const { NodeTracerProvider, BatchSpanProcessor } =
        await import("@opentelemetry/sdk-trace-node");
    const { OTLPTraceExporter } =
        await import("@opentelemetry/exporter-trace-otlp-grpc");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { Metadata } = await import("@grpc/grpc-js");

    const spaceId = process.env.ARIZE_SPACE_ID;
    const apiKey = process.env.ARIZE_API_KEY;

    if (!spaceId || !apiKey) {
        console.warn(
            "⚠️  ARIZE_SPACE_ID or ARIZE_API_KEY not set - running in console-only mode"
        );
        return false;
    }

    // Create gRPC metadata with Arize credentials
    const metadata = new Metadata();
    metadata.set("space_id", spaceId);
    metadata.set("api_key", apiKey);

    // Create Arize gRPC exporter
    const arizeExporter = new OTLPTraceExporter({
        url: "https://otlp.arize.com/v1",
        metadata,
    });

    // Create provider with resource and span processors
    const provider = new NodeTracerProvider({
        resource: resourceFromAttributes({
            model_id: "carmenta-evals",
            model_version: "1.0.0",
        }),
        spanProcessors: [new BatchSpanProcessor(arizeExporter)],
    });

    // Register globally
    provider.register();

    console.log(`Arize OTEL initialized → otlp.arize.com/v1 (gRPC)`);
    return true;
}

/**
 * Run quality evals with Arize AX span tracking
 */
async function runWithArize() {
    console.log("=".repeat(60));
    console.log("CARMENTA QUALITY EVALUATIONS (Arize AX)");
    console.log("=".repeat(60));
    console.log(`Base URL: ${flags.baseUrl}`);
    console.log(`Running ${flags.limit} evaluations with Arize tracking\n`);

    // Initialize Arize OTEL
    await initArizeTracing();
    const tracer = trace.getTracer("carmenta-quality-evals");

    // Select tests for quality evaluation
    const qualityTests = TEST_QUERIES.filter(
        (t) => !t.skip && !t.slow && t.category !== "edge-cases"
    ).slice(0, flags.limit);

    const results: EvalResult[] = [];

    for (let i = 0; i < qualityTests.length; i++) {
        const query = qualityTests[i];

        // Create a span for this eval
        await tracer.startActiveSpan(`eval:${query.id}`, async (span) => {
            try {
                span.setAttribute("eval.query_id", query.id);
                span.setAttribute("eval.category", query.category);
                span.setAttribute("eval.query", query.content);

                console.log(`\n[${i + 1}/${qualityTests.length}] Running: ${query.id}`);
                console.log(
                    `   Query: "${query.content.slice(0, 60)}${query.content.length > 60 ? "..." : ""}"`
                );

                // Get response from Carmenta
                const { response, duration, error } = await runQuery(query);

                if (error) {
                    span.setAttribute("eval.error", error);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: error });
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
                    span.end();
                    return;
                }

                span.setAttribute("eval.response_length", response.length);
                span.setAttribute("eval.duration_ms", duration);
                console.log(`   Response received (${formatDuration(duration)})`);

                if (flags.verbose) {
                    const preview = response.slice(0, 200);
                    console.log(
                        `   Response: ${preview}${response.length > 200 ? "..." : ""}`
                    );
                }

                // Evaluate response quality
                console.log(`   Evaluating with LLM judge...`);
                const scores = await evaluateResponse(query.content, response);

                // Set score attributes on span
                span.setAttribute("eval.correctness_score", scores.correctness.score);
                span.setAttribute("eval.correctness_label", scores.correctness.label);
                span.setAttribute("eval.helpfulness_score", scores.helpfulness.score);
                span.setAttribute("eval.helpfulness_label", scores.helpfulness.label);
                span.setAttribute("eval.relevance_score", scores.relevance.score);
                span.setAttribute("eval.relevance_label", scores.relevance.label);
                span.setAttribute("eval.overall_score", scores.overall);

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

                span.setStatus({ code: SpanStatusCode.OK });
            } catch (evalError) {
                span.setAttribute(
                    "eval.error",
                    evalError instanceof Error ? evalError.message : String(evalError)
                );
                span.setStatus({ code: SpanStatusCode.ERROR });
                console.log(
                    `   \x1b[31mEvaluation error: ${evalError instanceof Error ? evalError.message : String(evalError)}\x1b[0m`
                );
            } finally {
                span.end();
            }
        });
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

    const avgOverall =
        validResults.reduce((sum, r) => sum + r.scores.overall, 0) /
        validResults.length;

    console.log(`\nEvaluated: ${validResults.length} responses`);
    console.log(`Average Overall: ${(avgOverall * 100).toFixed(0)}%`);
    // Write results to JSON file for easy viewing
    const resultsFile = `evals-${new Date().toISOString().split("T")[0]}.json`;
    const outputPath = `scripts/evals/results/${resultsFile}`;
    const { mkdir, writeFile } = await import("fs/promises");
    await mkdir("scripts/evals/results", { recursive: true });
    await writeFile(
        outputPath,
        JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                summary: { evaluated: validResults.length, avgOverall },
                results: results.map((r) => ({
                    id: r.query.id,
                    category: r.query.category,
                    query: r.query.content,
                    scores: r.scores,
                    duration: r.duration,
                    error: r.error,
                })),
            },
            null,
            2
        )
    );
    console.log(`\n\x1b[32mResults saved to ${outputPath}\x1b[0m`);

    // Give time for spans to flush (if Arize is configured)
    await new Promise((resolve) => setTimeout(resolve, 2000));
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

// Entry point: use Arize by default unless --no-arize
if (flags.noArize) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
} else {
    runWithArize().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}
