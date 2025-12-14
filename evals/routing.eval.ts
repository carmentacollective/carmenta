/**
 * Carmenta Routing Eval
 *
 * Braintrust-native evaluation for Concierge routing decisions.
 * Tests model selection, temperature, reasoning, and tool invocation.
 *
 * Usage:
 *   pnpm braintrust eval evals/routing.eval.ts
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - TEST_USER_TOKEN in .env.local (Clerk JWT for API auth)
 *   - Carmenta server running at http://localhost:3000
 *     Start with: pnpm dev
 */

import "dotenv/config";
import { Eval } from "braintrust";
import {
    RoutingScorer,
    type RoutingExpectations,
    type RoutingOutput,
} from "./scorers/routing-scorer";
import { testData, type TestInput } from "./routing-test-data";

// Configuration
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;

if (!JWT_TOKEN) {
    console.error("❌ Missing TEST_USER_TOKEN environment variable");
    console.error("\n📋 Setup required:");
    console.error("   1. Get a long-lived JWT from Clerk Dashboard");
    console.error("   2. Add to .env.local: TEST_USER_TOKEN=<your_token>");
    console.error("\n▶️  Then run: pnpm braintrust eval evals/routing.eval.ts");
    process.exit(1);
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
        } catch (error) {
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
 * Consume streaming response and extract content
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
                    } catch (error) {
                        // SSE lines that aren't JSON are expected (comments, empty lines)
                    }
                }

                // Legacy format support
                if (line.startsWith("0:")) {
                    const match = line.match(/^0:"([^"\\]*(?:\\.[^"\\]*)*)"/);
                    if (match) {
                        try {
                            extractedText += JSON.parse(`"${match[1]}"`);
                        } catch (error) {
                            // Fallback to raw match if JSON parsing fails
                            extractedText += match[1];
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Stream may have been closed early - return what we have
    }

    return { text: extractedText, toolsCalled };
}

/**
 * Execute a single-turn test against the Carmenta API
 */
async function executeTest(input: TestInput): Promise<RoutingOutput> {
    const content = Array.isArray(input.content) ? input.content[0] : input.content;

    try {
        const response = await fetch(`${BASE_URL}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({
                messages: [buildMessage(content)],
                ...input.overrides,
            }),
        });

        const headers = parseHeaders(response.headers);
        const { text, toolsCalled } = await consumeStream(response);

        return {
            text,
            model: headers.model,
            temperature: headers.temperature,
            reasoning: headers.reasoning,
            toolsCalled,
            status: response.status,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("fetch failed")) {
            throw new Error(
                `Cannot connect to API at ${BASE_URL}. Make sure the server is running: npm run dev`
            );
        }

        throw error;
    }
}

/**
 * Execute a multi-turn test (conversation with history)
 */
async function executeMultiTurnTest(input: TestInput): Promise<RoutingOutput> {
    if (!Array.isArray(input.content)) {
        throw new Error("Multi-turn test must have array content");
    }

    const messages: ReturnType<typeof buildMessage>[] = [];
    let connectionId: string | undefined;
    let lastResult: RoutingOutput | null = null;

    try {
        for (const content of input.content) {
            messages.push(buildMessage(content));

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

            const { text, toolsCalled } = await consumeStream(response);

            // Add assistant response to history
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
                status: response.status,
            };
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("fetch failed")) {
            throw new Error(
                `Cannot connect to API at ${BASE_URL}. Make sure the server is running: npm run dev`
            );
        }

        throw error;
    }

    if (!lastResult) {
        throw new Error(
            "Multi-turn test produced no results - content array was empty"
        );
    }
    return lastResult;
}

/**
 * Run the Braintrust eval
 */
Eval("Carmenta Routing", {
    data: () =>
        testData
            .filter((t) => !t.input.slow) // Skip slow tests by default
            .map((t) => ({
                input: t.input,
                expected: t.expected,
                tags: t.tags,
                metadata: { id: t.input.id, category: t.input.category },
            })),

    task: async (input: TestInput): Promise<RoutingOutput> => {
        if (input.multiTurn) {
            return executeMultiTurnTest(input);
        }
        return executeTest(input);
    },

    scores: [RoutingScorer],

    metadata: {
        baseUrl: BASE_URL,
        commit: process.env.COMMIT_SHA ?? "local",
        environment: process.env.NODE_ENV ?? "development",
    },
});
