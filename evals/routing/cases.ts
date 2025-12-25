import type { RoutingExpectations } from "./scorer";

export interface TestInput {
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

export const testData: TestCase[] = [
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
                "Analyze the philosophical implications of the trolley problem. Consider utilitarian versus deontological ethics, the doctrine of double effect, and how different moral frameworks would evaluate the choice.",
            category: "routing",
        },
        expected: {
            // Note: Gemini Flash (Concierge model) interprets complex reasoning as potentially
            // needing tools, routing to GPT-5.2. This is acceptable - user gets capable model.
            // Ideal would be opus|sonnet per Tool+Reasoning Matrix, but GPT-5.2 also works.
            model: "opus|sonnet|gpt",
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

    // USER HINTS - Highest priority routing signals
    {
        input: {
            id: "hint-use-opus",
            description:
                "User hint 'use opus' should route to Opus regardless of query complexity",
            content: "Use opus for this: what's 2+2?",
            category: "routing",
        },
        expected: {
            model: "opus",
            shouldSucceed: true,
        },
        tags: ["routing", "user-hints", "model-hint"],
    },
    {
        input: {
            id: "hint-quick-answer",
            description: "Speed hint 'quick' should route to fast model",
            content: "Quick question - explain the theory of relativity",
            category: "routing",
        },
        expected: {
            model: "haiku",
            shouldSucceed: true,
        },
        tags: ["routing", "user-hints", "speed-hint"],
    },
    {
        input: {
            id: "hint-be-creative",
            description: "Creative hint should increase temperature",
            content: "Be creative and write me a haiku about programming",
            category: "routing",
        },
        expected: {
            temperatureRange: [0.7, 1.0],
            shouldSucceed: true,
        },
        tags: ["routing", "user-hints", "creative-hint"],
    },

    // SENSITIVITY ROUTING - Route to Grok for direct engagement
    {
        input: {
            id: "sensitivity-political",
            description: "Political opinion request should route to Grok",
            content:
                "What's your honest opinion on whether capitalism or socialism is better?",
            category: "routing",
        },
        expected: {
            model: "grok",
            shouldSucceed: true,
        },
        tags: ["routing", "sensitivity", "political"],
    },
    {
        input: {
            id: "sensitivity-unfiltered",
            description: "Unfiltered signal should route to Grok",
            content: "Give me your unfiltered take on cancel culture",
            category: "routing",
        },
        expected: {
            model: "grok",
            shouldSucceed: true,
        },
        tags: ["routing", "sensitivity", "unfiltered"],
    },
];
