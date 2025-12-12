/**
 * Competitive Benchmark Eval
 *
 * Runs the 25 competitive benchmark queries against Carmenta
 * and scores responses on multiple dimensions.
 *
 * Usage:
 *   bunx braintrust eval evals/competitive.eval.ts
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - TEST_USER_TOKEN in .env.local (Clerk JWT for API auth)
 *   - Carmenta server running at http://localhost:3000
 */

import "dotenv/config";
import { Eval } from "braintrust";
import { competitiveQueries, type CompetitiveQuery } from "./competitive-queries";

// Configuration
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;

if (!JWT_TOKEN) {
    console.error("❌ Missing TEST_USER_TOKEN environment variable");
    console.error("\n📋 Setup required:");
    console.error("   1. Get a long-lived JWT from Clerk Dashboard");
    console.error("   2. Add to .env.local: TEST_USER_TOKEN=<your_token>");
    process.exit(1);
}

/** Detected error event from the SSE stream */
interface StreamError {
    type: "error" | "tool-error";
    message?: string;
    code?: string;
    raw: unknown;
}

/** Failure classification to distinguish infra issues from quality issues */
type FailureType =
    | "none"
    | "http_error" // Non-2xx status code
    | "stream_error" // Error event in SSE stream
    | "stream_crash" // Stream terminated unexpectedly (TypeError: terminated)
    | "truncated" // Response ends mid-sentence or with "I'll search for..."
    | "body_error"; // 200 status but error message in body

interface CompetitiveOutput {
    /** Full response text */
    text: string;
    /** Model used (from header) */
    model?: string;
    /** Whether reasoning was enabled */
    reasoningEnabled: boolean;
    /** Tools that were called */
    toolsCalled: string[];
    /** Response time in ms */
    latencyMs: number;
    /** HTTP status */
    status: number;
    /** Error events captured from stream */
    streamErrors: StreamError[];
    /** Classification of any failure */
    failureType: FailureType;
    /** Human-readable failure explanation */
    failureReason?: string;
    /** Whether response was truncated mid-sentence */
    wasTruncated: boolean;
    /** Token counts if available */
    tokens?: {
        input?: number;
        output?: number;
    };
}

/**
 * Build UIMessage format required by the API
 */
function buildMessage(content: string) {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

/**
 * Parse concierge headers from response
 */
function parseHeaders(headers: Headers) {
    const modelId = headers.get("X-Concierge-Model-Id");
    const reasoningRaw = headers.get("X-Concierge-Reasoning");

    let reasoning: { enabled: boolean } | undefined;
    if (reasoningRaw) {
        try {
            reasoning = JSON.parse(decodeURIComponent(reasoningRaw));
        } catch {
            // Skip if parsing fails
        }
    }

    return {
        model: modelId ?? undefined,
        reasoningEnabled: reasoning?.enabled ?? false,
    };
}

/** Result of consuming the SSE stream */
interface StreamResult {
    text: string;
    toolsCalled: string[];
    errors: StreamError[];
    /** Error thrown during stream reading (e.g., TypeError: terminated) */
    readError?: Error;
}

/**
 * Patterns that indicate the response was truncated mid-stream.
 * These are phrases that models say when starting a task before output is complete.
 * Only use patterns that strongly indicate incomplete output - avoid false positives
 * on legitimate short responses.
 */
const TRUNCATION_PATTERNS = [
    /I'll search for.*$/i,
    /Let me (look up|research|find|search).*$/i,
    /Searching for.*$/i,
    /I'll (check|look|find).*$/i,
    /I need to (search|look|find).*$/i,
    /Let me check.*$/i,
    // Ellipsis at end without completion
    /\.{3}\s*$/,
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

/**
 * Detect if response text appears to be truncated mid-stream.
 *
 * Conservative detection: only flag truncation when we see specific patterns
 * that indicate the model was cut off while announcing an action.
 * This avoids false positives on legitimate short responses.
 */
function detectTruncation(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Only flag as truncated if we match a specific truncation pattern
    // A short response without proper punctuation might just be a brief answer
    return TRUNCATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Detect if response body contains error indicators despite 200 status
 */
function detectBodyError(text: string): string | null {
    const trimmed = text.trim();

    // Try to parse as JSON error
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.error) {
                return typeof parsed.error === "string"
                    ? parsed.error
                    : JSON.stringify(parsed.error);
            }
        } catch {
            // Not JSON, continue checking
        }
    }

    // Check text patterns
    for (const pattern of BODY_ERROR_PATTERNS) {
        if (pattern.test(trimmed)) {
            return trimmed.slice(0, 200);
        }
    }

    return null;
}

/**
 * Consume streaming response and extract content, tools, and errors
 */
async function consumeStream(response: Response): Promise<StreamResult> {
    const reader = response.body?.getReader();
    if (!reader) {
        return { text: "", toolsCalled: [], errors: [] };
    }

    const decoder = new TextDecoder();
    let extractedText = "";
    const toolsCalled: string[] = [];
    const errors: StreamError[] = [];
    let buffer = "";
    let readError: Error | undefined;

    try {
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

                        // Capture text deltas
                        if (data.type === "text-delta" && data.delta) {
                            extractedText += data.delta;
                        }

                        // Capture tool calls
                        if (
                            (data.type === "tool-input-start" ||
                                data.type === "tool-input-available") &&
                            data.toolName &&
                            !toolsCalled.includes(data.toolName)
                        ) {
                            toolsCalled.push(data.toolName);
                        }

                        // Capture error events - THIS IS THE KEY ADDITION
                        if (data.type === "error" || data.type === "tool-error") {
                            errors.push({
                                type: data.type,
                                message: data.message || data.error,
                                code: data.code,
                                raw: data,
                            });
                        }
                    } catch {
                        // SSE lines that aren't JSON are expected
                    }
                }

                // Legacy format support
                if (line.startsWith("0:")) {
                    const match = line.match(/^0:"([^"\\]*(?:\\.[^"\\]*)*)"/);
                    if (match) {
                        try {
                            extractedText += JSON.parse(`"${match[1]}"`);
                        } catch {
                            extractedText += match[1];
                        }
                    }
                }
            }
        }
    } catch (err) {
        // Capture stream read errors (e.g., TypeError: terminated)
        readError = err instanceof Error ? err : new Error(String(err));
    }

    return { text: extractedText, toolsCalled, errors, readError };
}

/**
 * Classify the failure type based on all available signals
 */
function classifyFailure(
    status: number,
    text: string,
    streamErrors: StreamError[],
    readError?: Error
): { type: FailureType; reason?: string } {
    // HTTP error takes precedence
    if (status < 200 || status >= 300) {
        return { type: "http_error", reason: `HTTP ${status}` };
    }

    // Stream crash (TypeError: terminated, network errors)
    if (readError) {
        return {
            type: "stream_crash",
            reason: `Stream crashed: ${readError.message}`,
        };
    }

    // Error events in stream
    if (streamErrors.length > 0) {
        const firstError = streamErrors[0];
        return {
            type: "stream_error",
            reason: `Stream error: ${firstError.message || JSON.stringify(firstError.raw)}`,
        };
    }

    // Body contains error message despite 200 status
    const bodyError = detectBodyError(text);
    if (bodyError) {
        return { type: "body_error", reason: `Error in body: ${bodyError}` };
    }

    // Response was truncated mid-stream
    const wasTruncated = detectTruncation(text);
    if (wasTruncated && text.split(/\s+/).filter(Boolean).length < MIN_WORD_COUNT) {
        return {
            type: "truncated",
            reason: `Response truncated after ${text.length} chars`,
        };
    }

    return { type: "none" };
}

/**
 * Execute a query against Carmenta
 */
async function executeQuery(query: CompetitiveQuery): Promise<CompetitiveOutput> {
    const startTime = Date.now();

    try {
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
        const { text, toolsCalled, errors, readError } = await consumeStream(response);
        const latencyMs = Date.now() - startTime;

        // Classify any failure
        const { type: failureType, reason: failureReason } = classifyFailure(
            response.status,
            text,
            errors,
            readError
        );

        // Detect truncation separately for metadata
        const wasTruncated = detectTruncation(text);

        return {
            text,
            model: headers.model,
            reasoningEnabled: headers.reasoningEnabled,
            toolsCalled,
            latencyMs,
            status: response.status,
            streamErrors: errors,
            failureType,
            failureReason,
            wasTruncated,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("fetch failed")) {
            throw new Error(
                `Cannot connect to API at ${BASE_URL}. Start the server with: bun run dev`
            );
        }

        throw error;
    }
}

/**
 * Score a competitive response
 *
 * IMPORTANT: Separates Infrastructure Health (binary) from Response Quality.
 * Infrastructure failures are LOUD - they're bugs, not quality issues.
 */
function CompetitiveScorer({
    input,
    output,
}: {
    input: CompetitiveQuery;
    output: CompetitiveOutput;
}) {
    const scores: Array<{
        name: string;
        score: number;
        metadata?: Record<string, unknown>;
    }> = [];

    // INFRASTRUCTURE HEALTH - Binary pass/fail, includes all failure types
    // This is THE critical metric for integration testing
    const infraPassed = output.failureType === "none";
    scores.push({
        name: "Infrastructure Health",
        score: infraPassed ? 1 : 0,
        metadata: {
            failureType: output.failureType,
            failureReason: output.failureReason,
            status: output.status,
            errorCount: output.streamErrors.length,
            wasTruncated: output.wasTruncated,
            // Include response preview on failure for debugging
            ...(output.failureType !== "none" && {
                responsePreview: output.text.slice(0, 500),
                fullResponseLength: output.text.length,
            }),
        },
    });

    // HTTP Success - kept for backwards compatibility but Infrastructure Health is primary
    scores.push({
        name: "HTTP Success",
        score: output.status >= 200 && output.status < 300 ? 1 : 0,
        metadata: { status: output.status },
    });

    // QUALITY METRICS - Only meaningful if infrastructure passed
    const wordCount = output.text.split(/\s+/).filter(Boolean).length;

    if (infraPassed) {
        // Response Substance - only score if infra is healthy
        const hasSubstantialResponse = wordCount >= MIN_WORD_COUNT;
        scores.push({
            name: "Response Substance",
            score: hasSubstantialResponse ? 1 : 0,
            metadata: { wordCount },
        });
    } else {
        // Mark as null/skip for quality when infra failed
        // This prevents "18 words" from hiding "stream crashed"
        scores.push({
            name: "Response Substance",
            score: 0, // Failed due to infra, not quality
            metadata: {
                wordCount,
                skipped: true,
                skipReason: `Infrastructure failure: ${output.failureType}`,
            },
        });
    }

    // Reasoning Usage - for reasoning category, should enable reasoning
    if (input.category === "reasoning") {
        scores.push({
            name: "Reasoning Enabled",
            score: output.reasoningEnabled ? 1 : 0,
            metadata: { reasoningEnabled: output.reasoningEnabled },
        });
    }

    // Tool Usage - for web-search and tools categories
    if (input.category === "web-search") {
        const usedWebSearch = output.toolsCalled.includes("webSearch");
        scores.push({
            name: "Web Search Used",
            score: usedWebSearch ? 1 : 0,
            metadata: { toolsCalled: output.toolsCalled },
        });
    }

    if (input.category === "tools") {
        const usedAnyTool = output.toolsCalled.length > 0;
        scores.push({
            name: "Tool Used",
            score: usedAnyTool ? 1 : 0,
            metadata: { toolsCalled: output.toolsCalled },
        });
    }

    // Latency - 30s threshold allows for web search + reasoning; mild penalty beyond
    scores.push({
        name: "Latency (ms)",
        score: output.latencyMs < 30000 ? 1 : 0.5,
        metadata: { latencyMs: output.latencyMs },
    });

    return scores;
}

/**
 * Run the competitive benchmark eval
 */
Eval("Carmenta Competitive Benchmark", {
    data: () =>
        competitiveQueries.map((q) => ({
            input: q,
            expected: {}, // No expected output - we're measuring quality
            tags: [q.category, q.difficulty, ...q.tags],
            metadata: {
                id: q.id,
                category: q.category,
                difficulty: q.difficulty,
                rationale: q.rationale,
            },
        })),

    task: async (input: CompetitiveQuery): Promise<CompetitiveOutput> => {
        return executeQuery(input);
    },

    scores: [CompetitiveScorer],

    metadata: {
        baseUrl: BASE_URL,
        commit: process.env.COMMIT_SHA ?? "local",
        environment: process.env.NODE_ENV ?? "development",
        queryCount: competitiveQueries.length,
    },
});
