#!/usr/bin/env bun
/**
 * Carmenta Routing Eval
 *
 * Braintrust-native evaluation for Concierge routing decisions.
 * Tests model selection, temperature, reasoning, and tool invocation.
 *
 * Usage:
 *   bunx braintrust eval evals/routing.eval.ts
 *   bunx braintrust eval evals/routing.eval.ts --watch  # Re-run on file changes
 *
 * Requires:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - TEST_USER_TOKEN in .env.local (Clerk JWT for API auth)
 */

import "dotenv/config";
import { Eval } from "braintrust";
import {
    RoutingScorer,
    type RoutingExpectations,
    type RoutingOutput,
} from "./scorers/routing-scorer";

// Configuration
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_TOKEN = process.env.TEST_USER_TOKEN;

if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set in environment");
    console.error(
        "Create a long-lived JWT in Clerk Dashboard and add it to .env.local"
    );
    process.exit(1);
}

// Types
interface TestInput {
    id: string;
    description: string;
    content: string | string[];
    category: "routing" | "tools" | "reasoning" | "overrides" | "edge-cases";
    overrides?: {
        modelOverride?: string;
        temperatureOverride?: number;
        reasoningOverride?: "none" | "low" | "medium" | "high";
    };
    multiTurn?: boolean;
    slow?: boolean;
}

interface TestCase {
    input: TestInput;
    expected: RoutingExpectations;
    tags?: string[];
    metadata?: Record<string, unknown>;
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
            // Ignore parse errors
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
                    } catch {
                        // Ignore parse errors
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
        // Stream read error - return what we have
    }

    return { text: extractedText, toolsCalled };
}

/**
 * Execute a single-turn test against the Carmenta API
 */
async function executeTest(input: TestInput): Promise<RoutingOutput> {
    const content = Array.isArray(input.content) ? input.content[0] : input.content;

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

    return lastResult!;
}

/**
 * Test dataset - converted from llm-routing-queries.ts
 */
const testData: TestCase[] = [
    // MODEL ROUTING TESTS
    {
        input: {
            id: "route-simple-factual",
            description: "Simple factual question should route to fast model",
            content: "What year did World War 2 end?",
            category: "routing",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
            shouldSucceed: true,
        },
        tags: ["routing", "fast"],
    },
    {
        input: {
            id: "route-quick-signal",
            description: "Quick question signal should route to Haiku",
            content: "Quick question: what's the capital of France?",
            category: "routing",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
            shouldSucceed: true,
        },
        tags: ["routing", "fast"],
    },
    {
        input: {
            id: "route-code-task",
            description: "Code task should route to Sonnet with lower temp",
            content: "Write a TypeScript function that debounces another function",
            category: "routing",
        },
        expected: {
            model: "sonnet",
            temperatureRange: [0.2, 0.5],
            shouldSucceed: true,
        },
        tags: ["routing", "code"],
    },
    {
        input: {
            id: "route-creative",
            description: "Creative writing should use higher temperature",
            content: "Write a short poem about the ocean at sunset",
            category: "routing",
        },
        expected: {
            temperatureRange: [0.5, 1.0],
            shouldSucceed: true,
        },
        tags: ["routing", "creative"],
    },
    {
        input: {
            id: "route-complex-analysis",
            description: "Complex analysis should route to deeper model with reasoning",
            content:
                "Analyze the economic implications of universal basic income. Consider labor markets, inflation, government budgets, and social effects.",
            category: "routing",
        },
        expected: {
            model: "opus|sonnet",
            reasoningEnabled: true,
            shouldSucceed: true,
        },
        tags: ["routing", "complex"],
    },
    {
        input: {
            id: "route-casual-chat",
            description: "Casual chat should route fast without reasoning",
            content: "Hey, how's it going?",
            category: "routing",
        },
        expected: {
            model: "haiku",
            reasoningEnabled: false,
            shouldSucceed: true,
        },
        tags: ["routing", "chat"],
    },

    // TOOL INVOCATION TESTS
    {
        input: {
            id: "tool-web-search",
            description: "Current events query should invoke webSearch tool",
            content: "What are the latest developments in AI regulation?",
            category: "tools",
        },
        expected: {
            toolCalled: "webSearch",
            shouldSucceed: true,
        },
        tags: ["tools", "search"],
    },
    {
        input: {
            id: "tool-compare",
            description: "Comparison request should invoke compareOptions tool",
            content:
                "Compare React, Vue, and Svelte for building web applications. Show pros and cons.",
            category: "tools",
        },
        expected: {
            toolCalled: "compareOptions",
            shouldSucceed: true,
        },
        tags: ["tools", "compare"],
    },
    {
        input: {
            id: "tool-deep-research",
            description: "Research request should invoke deepResearch tool",
            content:
                "Do deep research on the current state of quantum computing and its practical applications",
            category: "tools",
            slow: true,
        },
        expected: {
            toolCalled: "deepResearch",
            shouldSucceed: true,
        },
        tags: ["tools", "research", "slow"],
    },

    // REASONING TESTS
    {
        input: {
            id: "reasoning-math-proof",
            description: "Math proof should enable reasoning",
            content: "Prove that the square root of 2 is irrational",
            category: "reasoning",
        },
        expected: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
        tags: ["reasoning", "math"],
    },
    {
        input: {
            id: "reasoning-logic-puzzle",
            description: "Logic puzzle should enable reasoning",
            content:
                "Three people are in a room. Alice says 'Bob is lying'. Bob says 'Carol is lying'. Carol says 'Both Alice and Bob are lying'. Who is telling the truth?",
            category: "reasoning",
        },
        expected: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
        tags: ["reasoning", "logic"],
    },
    {
        input: {
            id: "reasoning-disabled-simple",
            description: "Simple question should not enable reasoning",
            content: "What color is the sky?",
            category: "reasoning",
        },
        expected: {
            reasoningEnabled: false,
            shouldSucceed: true,
        },
        tags: ["reasoning", "simple"],
    },
    {
        input: {
            id: "reasoning-multi-turn",
            description: "Multi-turn conversation with reasoning should not error",
            content: [
                "Solve this riddle: I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
                "Now explain your reasoning process for solving that riddle",
            ],
            category: "reasoning",
            overrides: {
                reasoningOverride: "medium",
            },
            multiTurn: true,
        },
        expected: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
        tags: ["reasoning", "multi-turn"],
    },

    // OVERRIDE TESTS
    {
        input: {
            id: "override-model-opus",
            description: "Model override should force Opus",
            content: "Hello, this is a simple test",
            category: "overrides",
            overrides: {
                modelOverride: "anthropic/claude-opus-4.5",
            },
        },
        expected: {
            model: "opus",
            shouldSucceed: true,
        },
        tags: ["overrides", "model"],
    },
    {
        input: {
            id: "override-model-haiku",
            description: "Model override should force Haiku",
            content: "This complex analysis would normally go to a bigger model",
            category: "overrides",
            overrides: {
                modelOverride: "anthropic/claude-haiku-4.5",
            },
        },
        expected: {
            model: "haiku",
            shouldSucceed: true,
        },
        tags: ["overrides", "model"],
    },
    {
        input: {
            id: "override-reasoning-high",
            description: "Reasoning override should force high reasoning",
            content: "What is 2 + 2?",
            category: "overrides",
            overrides: {
                reasoningOverride: "high",
            },
        },
        expected: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
        tags: ["overrides", "reasoning"],
    },
    {
        input: {
            id: "override-reasoning-none",
            description: "Reasoning override should disable reasoning",
            content: "Prove that there are infinitely many prime numbers",
            category: "overrides",
            overrides: {
                reasoningOverride: "none",
            },
        },
        expected: {
            reasoningEnabled: false,
            shouldSucceed: true,
        },
        tags: ["overrides", "reasoning"],
    },
    {
        input: {
            id: "override-temperature-low",
            description: "Temperature override should force low temp",
            content: "Write a creative story about a dragon",
            category: "overrides",
            overrides: {
                temperatureOverride: 0.1,
            },
        },
        expected: {
            temperatureRange: [0.1, 0.1],
            shouldSucceed: true,
        },
        tags: ["overrides", "temperature"],
    },
    {
        input: {
            id: "override-temperature-high",
            description: "Temperature override should force high temp",
            content: "What is the exact syntax for a JavaScript arrow function?",
            category: "overrides",
            overrides: {
                temperatureOverride: 0.9,
            },
        },
        expected: {
            temperatureRange: [0.9, 0.9],
            shouldSucceed: true,
        },
        tags: ["overrides", "temperature"],
    },

    // EDGE CASES
    {
        input: {
            id: "edge-empty-response",
            description: "Should handle query that expects short response",
            content: "Reply with just the word 'yes'",
            category: "edge-cases",
        },
        expected: {
            shouldSucceed: true,
        },
        tags: ["edge-cases"],
    },
    {
        input: {
            id: "edge-unicode",
            description: "Should handle unicode characters",
            content: "Translate 'hello world' to Japanese: こんにちは",
            category: "edge-cases",
        },
        expected: {
            shouldSucceed: true,
        },
        tags: ["edge-cases", "unicode"],
    },
    {
        input: {
            id: "edge-long-context",
            description: "Should handle longer context",
            content: `Here is a longer piece of text to process. ${Array(50).fill("This sentence is repeated to create more context.").join(" ")} Now summarize this in one sentence.`,
            category: "edge-cases",
        },
        expected: {
            shouldSucceed: true,
        },
        tags: ["edge-cases", "long-context"],
    },
];

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
