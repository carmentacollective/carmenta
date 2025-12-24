/**
 * Carmenta Nightly Eval Suite
 *
 * Combines routing and competitive benchmark tests into a comprehensive nightly suite.
 * Runs all test cases from both evals and aggregates results.
 *
 * Usage:
 *   pnpm braintrust eval evals/nightly/eval.ts
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - TEST_USER_TOKEN in .env.local (Clerk JWT for API auth)
 *   - Carmenta server running at http://localhost:3000
 */

import "dotenv/config";
import { Eval } from "braintrust";
import { testData as routingTests } from "../routing/cases";
import { competitiveQueries } from "../competitive/queries";
import { RoutingScorer } from "../routing/scorer";
import type { TestInput as RoutingInput } from "../routing/cases";
import type { RoutingExpectations, RoutingOutput } from "../routing/scorer";
import type { CompetitiveQuery } from "../competitive/queries";

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

/** Combined test type */
type NightlyTest =
    | { type: "routing"; input: RoutingInput; expected: RoutingExpectations }
    | { type: "competitive"; input: CompetitiveQuery };

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

/** Combined output type that supports both routing and competitive outputs */
interface NightlyOutput {
    /** Full response text */
    text: string;
    /** Model used (from header) */
    model?: string;
    /** Temperature (from header) */
    temperature?: number;
    /** Reasoning config */
    reasoning?: { enabled: boolean; effort?: string; maxTokens?: number };
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
    const temperature = headers.get("X-Concierge-Temperature");
    const reasoningRaw = headers.get("X-Concierge-Reasoning");

    let reasoning:
        | { enabled: boolean; effort?: string; maxTokens?: number }
        | undefined;
    if (reasoningRaw) {
        try {
            reasoning = JSON.parse(decodeURIComponent(reasoningRaw));
        } catch {
            // Expected in some test cases - silently skip
        }
    }

    return {
        model: modelId ?? undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        reasoning,
    };
}

/**
 * Patterns that indicate the response was truncated mid-stream
 */
const TRUNCATION_PATTERNS = [
    /I'll search for.*$/i,
    /Let me (look up|research|find|search).*$/i,
    /Searching for.*$/i,
    /I'll (check|look|find).*$/i,
    /I need to (search|look|find).*$/i,
    /Let me check.*$/i,
    /\.{3}\s*$/,
];

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
 * Detect if response text appears to be truncated mid-stream
 */
function detectTruncation(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return TRUNCATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Detect if response body contains error indicators despite 200 status
 */
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
            return null;
        } catch {
            // Not valid JSON, continue checking text patterns
        }
    }

    for (const pattern of BODY_ERROR_PATTERNS) {
        if (pattern.test(trimmed)) {
            return trimmed.slice(0, 200);
        }
    }

    return null;
}

/** Result of consuming the SSE stream */
interface StreamResult {
    text: string;
    toolsCalled: string[];
    errors: StreamError[];
    readError?: Error;
}

/**
 * Consume streaming response and extract content
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

                        if (data.type === "text-delta" && data.delta) {
                            extractedText += data.delta;
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
    if (status < 200 || status >= 300) {
        return { type: "http_error", reason: `HTTP ${status}` };
    }

    if (readError) {
        return {
            type: "stream_crash",
            reason: `Stream crashed: ${readError.message}`,
        };
    }

    if (streamErrors.length > 0) {
        const firstError = streamErrors[0];
        return {
            type: "stream_error",
            reason: `Stream error: ${firstError.message || JSON.stringify(firstError.raw)}`,
        };
    }

    const bodyError = detectBodyError(text);
    if (bodyError) {
        return { type: "body_error", reason: `Error in body: ${bodyError}` };
    }

    const wasTruncated = detectTruncation(text);
    if (wasTruncated && text.split(/\s+/).filter(Boolean).length < 50) {
        return {
            type: "truncated",
            reason: `Response truncated after ${text.length} chars`,
        };
    }

    return { type: "none" };
}

/**
 * Execute a single-turn test against the Carmenta API
 */
async function executeTest(
    content: string,
    overrides?: RoutingInput["overrides"]
): Promise<NightlyOutput> {
    const startTime = Date.now();

    try {
        const response = await fetch(`${BASE_URL}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [buildMessage(content)],
                ...overrides,
            }),
        });

        const headers = parseHeaders(response.headers);
        const { text, toolsCalled, errors, readError } = await consumeStream(response);
        const latencyMs = Date.now() - startTime;

        const { type: failureType, reason: failureReason } = classifyFailure(
            response.status,
            text,
            errors,
            readError
        );

        const wasTruncated = detectTruncation(text);

        return {
            text,
            model: headers.model,
            temperature: headers.temperature,
            reasoning: headers.reasoning,
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
                `Cannot connect to API at ${BASE_URL}. Start the server with: pnpm dev`
            );
        }

        throw error;
    }
}

/**
 * Execute a multi-turn test (conversation with history)
 */
async function executeMultiTurnTest(input: RoutingInput): Promise<NightlyOutput> {
    if (!Array.isArray(input.content)) {
        throw new Error("Multi-turn test must have array content");
    }

    const messages: ReturnType<typeof buildMessage>[] = [];
    let connectionId: string | undefined;
    let lastResult: NightlyOutput | null = null;

    for (const content of input.content) {
        messages.push(buildMessage(content));
        const startTime = Date.now();

        const response = await fetch(`${BASE_URL}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages,
                ...(connectionId && { connectionId }),
                ...input.overrides,
            }),
        });

        const headers = parseHeaders(response.headers);
        connectionId = response.headers.get("X-Connection-Id") ?? connectionId;

        const { text, toolsCalled, errors, readError } = await consumeStream(response);
        const latencyMs = Date.now() - startTime;

        const { type: failureType, reason: failureReason } = classifyFailure(
            response.status,
            text,
            errors,
            readError
        );

        const wasTruncated = detectTruncation(text);

        messages.push({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: text,
            parts: [{ type: "text", text }],
        } as ReturnType<typeof buildMessage>);

        lastResult = {
            text,
            model: headers.model,
            temperature: headers.temperature,
            reasoning: headers.reasoning,
            toolsCalled,
            latencyMs,
            status: response.status,
            streamErrors: errors,
            failureType,
            failureReason,
            wasTruncated,
        };
    }

    if (!lastResult) {
        throw new Error("Multi-turn test produced no results");
    }
    return lastResult;
}

/**
 * Combined scorer that applies the appropriate scorer based on test type
 */
function NightlyScorer({
    input,
    output,
    expected: _expected,
}: {
    input: NightlyTest;
    output: NightlyOutput;
    expected: unknown;
}) {
    if (input.type === "routing") {
        // Use routing scorer
        const routingOutput: RoutingOutput = {
            text: output.text,
            model: output.model,
            temperature: output.temperature,
            reasoning: output.reasoning,
            toolsCalled: output.toolsCalled,
            status: output.status,
        };
        return RoutingScorer({
            input: input.input,
            output: routingOutput,
            expected: input.expected,
        });
    } else {
        // Competitive scoring
        const scores: Array<{
            name: string;
            score: number;
            metadata?: Record<string, unknown>;
        }> = [];

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
                ...(output.failureType !== "none" && {
                    responsePreview: output.text.slice(0, 500),
                    fullResponseLength: output.text.length,
                }),
            },
        });

        scores.push({
            name: "HTTP Success",
            score: output.status >= 200 && output.status < 300 ? 1 : 0,
            metadata: { status: output.status },
        });

        const wordCount = output.text.split(/\s+/).filter(Boolean).length;
        const MIN_WORD_COUNT = 50;

        if (infraPassed) {
            const hasSubstantialResponse = wordCount >= MIN_WORD_COUNT;
            scores.push({
                name: "Response Substance",
                score: hasSubstantialResponse ? 1 : 0,
                metadata: { wordCount },
            });
        } else {
            scores.push({
                name: "Response Substance",
                score: 0,
                metadata: {
                    wordCount,
                    skipped: true,
                    skipReason: `Infrastructure failure: ${output.failureType}`,
                },
            });
        }

        if (input.input.category === "reasoning") {
            scores.push({
                name: "Reasoning Enabled",
                score: output.reasoning?.enabled ? 1 : 0,
                metadata: { reasoningEnabled: output.reasoning?.enabled ?? false },
            });
        }

        if (input.input.category === "web-search") {
            const usedWebSearch = output.toolsCalled.includes("webSearch");
            scores.push({
                name: "Web Search Used",
                score: usedWebSearch ? 1 : 0,
                metadata: { toolsCalled: output.toolsCalled },
            });
        }

        if (input.input.category === "tools") {
            const usedAnyTool = output.toolsCalled.length > 0;
            scores.push({
                name: "Tool Used",
                score: usedAnyTool ? 1 : 0,
                metadata: { toolsCalled: output.toolsCalled },
            });
        }

        scores.push({
            name: "Latency (ms)",
            score: output.latencyMs < 30000 ? 1 : 0.5,
            metadata: { latencyMs: output.latencyMs },
        });

        return scores;
    }
}

/**
 * Run the nightly eval suite
 */
Eval("Carmenta Nightly", {
    data: () => {
        const data: Array<{
            input: NightlyTest;
            expected: unknown;
            tags: string[];
            metadata: Record<string, unknown>;
        }> = [];

        // Add routing tests
        for (const test of routingTests) {
            if (test.input.slow) continue; // Skip slow tests by default

            data.push({
                input: {
                    type: "routing",
                    input: test.input,
                    expected: test.expected,
                },
                expected: test.expected,
                tags: [...(test.tags || []), "routing", "nightly"],
                metadata: {
                    testType: "routing",
                    id: test.input.id,
                    category: test.input.category,
                },
            });
        }

        // Add competitive tests
        for (const query of competitiveQueries) {
            data.push({
                input: {
                    type: "competitive",
                    input: query,
                },
                expected: {},
                tags: [
                    query.category,
                    query.difficulty,
                    ...query.tags,
                    "competitive",
                    "nightly",
                ],
                metadata: {
                    testType: "competitive",
                    id: query.id,
                    category: query.category,
                    difficulty: query.difficulty,
                    rationale: query.rationale,
                },
            });
        }

        return data;
    },

    task: async (input: NightlyTest): Promise<NightlyOutput> => {
        if (input.type === "routing") {
            const routingInput = input.input;
            const content = Array.isArray(routingInput.content)
                ? routingInput.content[0]
                : routingInput.content;

            if (routingInput.multiTurn) {
                return executeMultiTurnTest(routingInput);
            }
            return executeTest(content, routingInput.overrides);
        } else {
            // Competitive query
            return executeTest(input.input.query);
        }
    },

    scores: [NightlyScorer],

    metadata: {
        baseUrl: BASE_URL,
        commit: process.env.COMMIT_SHA ?? "local",
        environment: process.env.NODE_ENV ?? "development",
        timestamp: new Date().toISOString(),
        routingTestCount: routingTests.filter((t) => !t.input.slow).length,
        competitiveTestCount: competitiveQueries.length,
    },
});
