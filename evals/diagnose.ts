/**
 * Diagnostic script for competitive benchmark failures
 *
 * Unlike the Braintrust eval, this script outputs verbose failure details
 * to help debug infrastructure issues vs quality issues.
 *
 * Run with: bunx tsx evals/diagnose.ts [--category=reasoning] [--query=web-02]
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { competitiveQueries, type CompetitiveQuery } from "./competitive-queries";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;

if (!JWT_TOKEN) {
    console.error("❌ Missing TEST_USER_TOKEN environment variable");
    console.error("\n📋 Setup required:");
    console.error("   1. Get a long-lived JWT from Clerk Dashboard");
    console.error("   2. Add to .env.local: TEST_USER_TOKEN=<your_token>");
    process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const categoryFilter = args.find((a) => a.startsWith("--category="))?.split("=")[1];
const queryFilter = args.find((a) => a.startsWith("--query="))?.split("=")[1];
const verbose = args.includes("--verbose") || args.includes("-v");

/** Detected error event from the SSE stream */
interface StreamError {
    type: "error" | "tool-error";
    message?: string;
    code?: string;
    raw: unknown;
}

/** Failure classification */
type FailureType =
    | "none"
    | "http_error"
    | "stream_error"
    | "stream_crash"
    | "truncated"
    | "body_error";

/**
 * Patterns that indicate the response was truncated mid-stream.
 * Conservative: only flag specific phrases indicating incomplete output.
 */
const TRUNCATION_PATTERNS = [
    /I'll search for.*$/i,
    /Let me (look up|research|find|search).*$/i,
    /Searching for.*$/i,
    /I'll (check|look|find).*$/i,
    /I need to (search|look|find).*$/i,
    /Let me check.*$/i,
    /\.{3}\s*$/, // Ellipsis at end without completion
];

/**
 * Minimum word count for a "substantial" response.
 * Below this threshold, we flag as a quality issue (unless it's an infra failure).
 */
const MIN_WORD_COUNT = 50;

/**
 * Patterns in response body that indicate an error even with 200 status
 */
const BODY_ERROR_PATTERNS = [
    /^{"error":/,
    /An error occurred/i,
    /Something went wrong/i,
    /Internal server error/i,
    /Service unavailable/i,
];

function buildMessage(content: string) {
    return {
        id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

function parseHeaders(headers: Headers) {
    const modelId = headers.get("X-Concierge-Model-Id");
    const reasoningRaw = headers.get("X-Concierge-Reasoning");

    let reasoning: { enabled: boolean } | undefined;
    if (reasoningRaw) {
        try {
            reasoning = JSON.parse(decodeURIComponent(reasoningRaw));
        } catch {
            // Skip
        }
    }

    return {
        model: modelId ?? undefined,
        reasoningEnabled: reasoning?.enabled ?? false,
    };
}

function detectTruncation(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    // Conservative: only flag truncation for specific patterns
    return TRUNCATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function detectBodyError(text: string): string | null {
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.error) {
                return typeof parsed.error === "string"
                    ? parsed.error
                    : JSON.stringify(parsed.error);
            }
            // Valid JSON without error field - not an error body
            // Early return prevents regex from matching {"error":false,...}
            return null;
        } catch {
            // Not valid JSON, continue checking text patterns
        }
    }
    for (const pattern of BODY_ERROR_PATTERNS) {
        if (pattern.test(trimmed)) return trimmed.slice(0, 200);
    }
    return null;
}

interface StreamResult {
    text: string;
    toolsCalled: string[];
    errors: StreamError[];
    readError?: Error;
    rawEvents: unknown[]; // For verbose mode
}

async function consumeStream(response: Response): Promise<StreamResult> {
    const reader = response.body?.getReader();
    if (!reader) {
        return { text: "", toolsCalled: [], errors: [], rawEvents: [] };
    }

    const decoder = new TextDecoder();
    let text = "";
    const toolsCalled: string[] = [];
    const errors: StreamError[] = [];
    const rawEvents: unknown[] = [];
    let buffer = "";
    let readError: Error | undefined;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        rawEvents.push(data);

                        if (data.type === "text-delta" && data.delta) {
                            text += data.delta;
                        }

                        if (
                            (data.type === "tool-input-start" ||
                                data.type === "tool-input-available") &&
                            data.toolName &&
                            !toolsCalled.includes(data.toolName)
                        ) {
                            toolsCalled.push(data.toolName);
                        }

                        if (data.type === "error" || data.type === "tool-error") {
                            errors.push({
                                type: data.type,
                                message: data.message || data.error || data.errorText,
                                code: data.code,
                                raw: data,
                            });
                        }
                    } catch {
                        // SSE lines that aren't JSON
                    }
                }
            }
        }
    } catch (err) {
        readError = err instanceof Error ? err : new Error(String(err));
    }

    return { text, toolsCalled, errors, readError, rawEvents };
}

function classifyFailure(
    status: number,
    text: string,
    errors: StreamError[],
    readError?: Error
): { type: FailureType; reason?: string } {
    if (status < 200 || status >= 300) {
        return { type: "http_error", reason: `HTTP ${status}` };
    }
    if (readError) {
        return { type: "stream_crash", reason: `Stream crashed: ${readError.message}` };
    }
    if (errors.length > 0) {
        const first = errors[0];
        return {
            type: "stream_error",
            reason: `Stream error: ${first.message || JSON.stringify(first.raw)}`,
        };
    }
    const bodyError = detectBodyError(text);
    if (bodyError) {
        return { type: "body_error", reason: `Error in body: ${bodyError}` };
    }
    const wasTruncated = detectTruncation(text);
    if (wasTruncated && text.split(/\s+/).filter(Boolean).length < MIN_WORD_COUNT) {
        return {
            type: "truncated",
            reason: `Response truncated after ${text.length} chars`,
        };
    }
    return { type: "none" };
}

interface DiagnosticResult {
    query: CompetitiveQuery;
    status: number;
    text: string;
    wordCount: number;
    toolsCalled: string[];
    reasoningEnabled: boolean;
    model?: string;
    failureType: FailureType;
    failureReason?: string;
    streamErrors: StreamError[];
    latencyMs: number;
    categoryIssues: string[];
    rawEvents?: unknown[];
}

async function runQuery(query: CompetitiveQuery): Promise<DiagnosticResult> {
    const startTime = Date.now();

    const response = await fetch(`${BASE_URL}/api/connection`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${JWT_TOKEN}`,
        },
        body: JSON.stringify({
            messages: [buildMessage(query.query)],
        }),
    });

    const headers = parseHeaders(response.headers);
    const { text, toolsCalled, errors, readError, rawEvents } =
        await consumeStream(response);
    const latencyMs = Date.now() - startTime;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const { type: failureType, reason: failureReason } = classifyFailure(
        response.status,
        text,
        errors,
        readError
    );

    // Category-specific issues
    const categoryIssues: string[] = [];

    if (query.category === "reasoning" && !headers.reasoningEnabled) {
        categoryIssues.push("Reasoning not enabled");
    }
    if (query.category === "web-search" && !toolsCalled.includes("webSearch")) {
        categoryIssues.push("Web search not used");
    }
    if (query.category === "tools" && toolsCalled.length === 0) {
        categoryIssues.push("No tools used");
    }

    return {
        query,
        status: response.status,
        text,
        wordCount,
        toolsCalled,
        reasoningEnabled: headers.reasoningEnabled,
        model: headers.model,
        failureType,
        failureReason,
        streamErrors: errors,
        latencyMs,
        categoryIssues,
        rawEvents: verbose ? rawEvents : undefined,
    };
}

function printResult(result: DiagnosticResult) {
    const hasInfraFailure = result.failureType !== "none";
    const hasQualityIssue = result.wordCount < MIN_WORD_COUNT && !hasInfraFailure;
    const hasCategoryIssue = result.categoryIssues.length > 0;
    const hasAnyIssue = hasInfraFailure || hasQualityIssue || hasCategoryIssue;

    // Status indicator
    const icon = hasInfraFailure ? "💥" : hasAnyIssue ? "⚠️" : "✅";
    const status = hasInfraFailure
        ? `INFRA FAIL: ${result.failureType}`
        : hasAnyIssue
          ? "ISSUES"
          : "OK";

    console.log(`\n${icon} ${result.query.id} [${result.query.category}] - ${status}`);
    console.log(`   Model: ${result.model || "unknown"} | ${result.latencyMs}ms`);
    console.log(
        `   Words: ${result.wordCount} | Tools: ${result.toolsCalled.join(", ") || "none"}`
    );

    if (result.query.category === "reasoning") {
        console.log(
            `   Reasoning: ${result.reasoningEnabled ? "✓ enabled" : "✗ disabled"}`
        );
    }

    // INFRASTRUCTURE FAILURES - LOUD
    if (hasInfraFailure) {
        console.log("\n   🚨 INFRASTRUCTURE FAILURE:");
        console.log(`   Type: ${result.failureType}`);
        console.log(`   Reason: ${result.failureReason}`);

        if (result.streamErrors.length > 0) {
            console.log("\n   Stream Errors:");
            for (const err of result.streamErrors) {
                console.log(
                    `   - ${err.type}: ${err.message || JSON.stringify(err.raw)}`
                );
            }
        }

        console.log("\n   Response Preview:");
        console.log("   " + "─".repeat(60));
        const preview = result.text.slice(0, 500);
        console.log("   " + preview.split("\n").join("\n   "));
        if (result.text.length > 500) {
            console.log(`   ... (${result.text.length - 500} more chars)`);
        }
        console.log("   " + "─".repeat(60));
    }

    // Category issues
    if (hasCategoryIssue) {
        console.log(`\n   ⚠️ Category Issues: ${result.categoryIssues.join(", ")}`);
    }

    // Quality issues (only if infra passed)
    if (hasQualityIssue) {
        console.log(
            `\n   ⚠️ Quality Issue: Short response (${result.wordCount} words)`
        );
        console.log("   Response Preview:");
        console.log("   " + "─".repeat(60));
        console.log("   " + result.text.slice(0, 300).split("\n").join("\n   "));
        console.log("   " + "─".repeat(60));
    }

    // Verbose mode - show all events
    if (verbose && result.rawEvents) {
        console.log("\n   📋 Raw Events:");
        for (const event of result.rawEvents.slice(0, 20)) {
            console.log("   " + JSON.stringify(event));
        }
        if (result.rawEvents.length > 20) {
            console.log(`   ... (${result.rawEvents.length - 20} more events)`);
        }
    }
}

async function runDiagnostics() {
    console.log("🔍 Carmenta Competitive Benchmark Diagnostics");
    console.log("=".repeat(60));
    console.log(`Target: ${BASE_URL}`);
    if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
    if (queryFilter) console.log(`Query filter: ${queryFilter}`);
    if (verbose) console.log(`Mode: verbose`);
    console.log("");

    // Filter queries
    let queries = competitiveQueries;
    if (categoryFilter) {
        queries = queries.filter((q) => q.category === categoryFilter);
    }
    if (queryFilter) {
        queries = queries.filter(
            (q) => q.id.includes(queryFilter) || q.id === queryFilter
        );
    }

    if (queries.length === 0) {
        console.log("No queries match filters");
        return;
    }

    console.log(`Running ${queries.length} queries...\n`);

    const results: DiagnosticResult[] = [];
    const infraFailures: DiagnosticResult[] = [];
    const qualityIssues: DiagnosticResult[] = [];
    const categoryIssues: DiagnosticResult[] = [];

    for (const query of queries) {
        process.stdout.write(`Testing ${query.id}... `);

        try {
            const result = await runQuery(query);
            results.push(result);

            if (result.failureType !== "none") {
                infraFailures.push(result);
                console.log(`💥 ${result.failureType}`);
            } else {
                // Quality and category issues can co-occur
                const hasQualityIssue = result.wordCount < MIN_WORD_COUNT;
                const hasCategoryIssue = result.categoryIssues.length > 0;

                if (hasQualityIssue) {
                    qualityIssues.push(result);
                }
                if (hasCategoryIssue) {
                    categoryIssues.push(result);
                }

                if (hasQualityIssue && hasCategoryIssue) {
                    console.log(
                        `⚠️ ${result.wordCount} words + ${result.categoryIssues.join(", ")}`
                    );
                } else if (hasQualityIssue) {
                    console.log(`⚠️ ${result.wordCount} words`);
                } else if (hasCategoryIssue) {
                    console.log(`⚠️ ${result.categoryIssues.join(", ")}`);
                } else {
                    console.log(`✅ ${result.wordCount} words`);
                }
            }
        } catch (error) {
            // Network errors (ECONNREFUSED, etc.) are infrastructure failures too
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`💥 Network error: ${errorMessage}`);

            // Create a synthetic result for the failed query so it counts
            const errorResult: DiagnosticResult = {
                query,
                status: 0,
                text: "",
                wordCount: 0,
                toolsCalled: [],
                reasoningEnabled: false,
                model: undefined,
                failureType: "stream_crash",
                failureReason: `Network error: ${errorMessage}`,
                streamErrors: [],
                latencyMs: 0,
                categoryIssues: [],
            };
            results.push(errorResult);
            infraFailures.push(errorResult);
        }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 DIAGNOSTIC SUMMARY\n");

    const total = results.length;
    // Count unique results with any issue (results can be in multiple arrays)
    const resultsWithIssues = new Set([
        ...infraFailures,
        ...qualityIssues,
        ...categoryIssues,
    ]);
    const passed = total - resultsWithIssues.size;

    console.log(`Total: ${total} queries`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`💥 Infrastructure Failures: ${infraFailures.length}`);
    console.log(`⚠️ Quality Issues: ${qualityIssues.length}`);
    console.log(`⚠️ Category Issues: ${categoryIssues.length}`);

    // Detail sections
    if (infraFailures.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("💥 INFRASTRUCTURE FAILURES (These are bugs!)");
        for (const result of infraFailures) {
            printResult(result);
        }
    }

    if (qualityIssues.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("⚠️ QUALITY ISSUES");
        for (const result of qualityIssues) {
            printResult(result);
        }
    }

    if (categoryIssues.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("⚠️ CATEGORY-SPECIFIC ISSUES");
        for (const result of categoryIssues) {
            printResult(result);
        }
    }

    // Exit code for CI
    if (infraFailures.length > 0) {
        process.exit(1);
    }
}

runDiagnostics().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
