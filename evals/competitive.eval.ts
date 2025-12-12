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

/**
 * Consume streaming response and extract content + tools
 */
async function consumeStream(
    response: Response
): Promise<{ text: string; toolsCalled: string[] }> {
    const reader = response.body?.getReader();
    if (!reader) {
        return { text: "", toolsCalled: [] };
    }

    const decoder = new TextDecoder();
    let extractedText = "";
    const toolsCalled: string[] = [];
    let buffer = "";

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
    } catch {
        // Stream may have been closed early
    }

    return { text: extractedText, toolsCalled };
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
        const { text, toolsCalled } = await consumeStream(response);
        const latencyMs = Date.now() - startTime;

        return {
            text,
            model: headers.model,
            reasoningEnabled: headers.reasoningEnabled,
            toolsCalled,
            latencyMs,
            status: response.status,
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

    // HTTP Success - basic sanity check
    scores.push({
        name: "HTTP Success",
        score: output.status >= 200 && output.status < 300 ? 1 : 0,
        metadata: { status: output.status },
    });

    // Response Length - penalize empty or very short responses
    // 50 words minimum ensures response actually addresses the query
    const wordCount = output.text.split(/\s+/).filter(Boolean).length;
    const hasSubstantialResponse = wordCount >= 50;
    scores.push({
        name: "Response Substance",
        score: hasSubstantialResponse ? 1 : 0,
        metadata: { wordCount },
    });

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
