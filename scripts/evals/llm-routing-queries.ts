/**
 * LLM Routing Test Queries
 *
 * Test queries for validating the Concierge's routing decisions:
 * - Model routing (Haiku, Sonnet, Opus, Gemini, Grok)
 * - Reasoning levels (none, low, medium, high)
 * - Temperature selection (precise vs creative)
 * - Tool invocation (search, research, compare, fetch)
 * - User overrides (model, temperature, reasoning)
 */

export interface TestQuery {
    /** Unique identifier for the test */
    id: string;
    /** Human-readable description */
    description: string;
    /** The message content to send */
    content: string;
    /** Category for grouping results */
    category: "routing" | "tools" | "reasoning" | "overrides" | "edge-cases";
    /** Optional overrides to send with the request */
    overrides?: {
        modelOverride?: string;
        temperatureOverride?: number;
        reasoningOverride?: "none" | "low" | "medium" | "high";
    };
    /** Expected outcomes to validate */
    expectations: {
        /** Expected model (substring match) - null means any model is fine */
        model?: string | null;
        /** Expected temperature range [min, max] - null means any temp is fine */
        temperatureRange?: [number, number] | null;
        /** Expected reasoning enabled state - null means don't check */
        reasoningEnabled?: boolean | null;
        /** Expected tool to be called - null means no tool expected */
        toolCalled?: string | null;
        /** Response should contain this text (case-insensitive) */
        responseContains?: string | null;
        /** Should return 200 status */
        shouldSucceed?: boolean;
    };
    /** Whether this test is slow (e.g., deep research) */
    slow?: boolean;
    /** Skip this test by default */
    skip?: boolean;
}

/**
 * All test queries organized by what they're testing.
 */
export const TEST_QUERIES: TestQuery[] = [
    // ========================================================================
    // MODEL ROUTING TESTS
    // Validate that Concierge routes to appropriate models based on query type
    // ========================================================================
    {
        id: "route-simple-factual",
        description: "Simple factual question should route to fast model",
        content: "What year did World War 2 end?",
        category: "routing",
        expectations: {
            model: "haiku",
            reasoningEnabled: false,
            shouldSucceed: true,
        },
    },
    {
        id: "route-quick-signal",
        description: "Quick question signal should route to Haiku",
        content: "Quick question: what's the capital of France?",
        category: "routing",
        expectations: {
            model: "haiku",
            reasoningEnabled: false,
            shouldSucceed: true,
        },
    },
    {
        id: "route-code-task",
        description: "Code task should route to Sonnet with lower temp",
        content: "Write a TypeScript function that debounces another function",
        category: "routing",
        expectations: {
            model: "sonnet",
            temperatureRange: [0.2, 0.5],
            shouldSucceed: true,
        },
    },
    {
        id: "route-creative",
        description: "Creative writing should use higher temperature",
        content: "Write a short poem about the ocean at sunset",
        category: "routing",
        expectations: {
            temperatureRange: [0.5, 1.0],
            shouldSucceed: true,
        },
    },
    {
        id: "route-complex-analysis",
        description: "Complex analysis should route to deeper model with reasoning",
        content:
            "Analyze the economic implications of universal basic income. Consider labor markets, inflation, government budgets, and social effects.",
        category: "routing",
        expectations: {
            model: "opus|sonnet",
            reasoningEnabled: true,
            shouldSucceed: true,
        },
    },
    {
        id: "route-casual-chat",
        description: "Casual chat should route fast without reasoning",
        content: "Hey, how's it going?",
        category: "routing",
        expectations: {
            model: "haiku",
            reasoningEnabled: false,
            shouldSucceed: true,
        },
    },

    // ========================================================================
    // TOOL INVOCATION TESTS
    // Validate that tools are called when appropriate
    // ========================================================================
    {
        id: "tool-web-search",
        description: "Current events query should invoke webSearch tool",
        content: "What are the latest developments in AI regulation?",
        category: "tools",
        expectations: {
            toolCalled: "webSearch",
            shouldSucceed: true,
        },
    },
    {
        id: "tool-compare",
        description: "Comparison request should invoke compareOptions tool",
        content:
            "Compare React, Vue, and Svelte for building web applications. Show pros and cons.",
        category: "tools",
        expectations: {
            toolCalled: "compareOptions",
            shouldSucceed: true,
        },
    },
    {
        id: "tool-deep-research",
        description: "Research request should invoke deepResearch tool",
        content:
            "Do deep research on the current state of quantum computing and its practical applications",
        category: "tools",
        expectations: {
            toolCalled: "deepResearch",
            shouldSucceed: true,
        },
        slow: true,
    },

    // ========================================================================
    // REASONING TESTS
    // Validate that reasoning is enabled/disabled appropriately
    // ========================================================================
    {
        id: "reasoning-math-proof",
        description: "Math proof should enable reasoning",
        content: "Prove that the square root of 2 is irrational",
        category: "reasoning",
        expectations: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
    },
    {
        id: "reasoning-logic-puzzle",
        description: "Logic puzzle should enable reasoning",
        content:
            "Three people are in a room. Alice says 'Bob is lying'. Bob says 'Carol is lying'. Carol says 'Both Alice and Bob are lying'. Who is telling the truth?",
        category: "reasoning",
        expectations: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
    },
    {
        id: "reasoning-disabled-simple",
        description: "Simple question should not enable reasoning",
        content: "What color is the sky?",
        category: "reasoning",
        expectations: {
            reasoningEnabled: false,
            shouldSucceed: true,
        },
    },

    // ========================================================================
    // OVERRIDE TESTS
    // Validate that user overrides are respected
    // ========================================================================
    {
        id: "override-model-opus",
        description: "Model override should force Opus",
        content: "Hello, this is a simple test",
        category: "overrides",
        overrides: {
            modelOverride: "anthropic/claude-opus-4.5",
        },
        expectations: {
            model: "opus",
            shouldSucceed: true,
        },
    },
    {
        id: "override-model-haiku",
        description: "Model override should force Haiku",
        content: "This complex analysis would normally go to a bigger model",
        category: "overrides",
        overrides: {
            modelOverride: "anthropic/claude-haiku-4.5",
        },
        expectations: {
            model: "haiku",
            shouldSucceed: true,
        },
    },
    {
        id: "override-reasoning-high",
        description: "Reasoning override should force high reasoning",
        content: "What is 2 + 2?",
        category: "overrides",
        overrides: {
            reasoningOverride: "high",
        },
        expectations: {
            reasoningEnabled: true,
            shouldSucceed: true,
        },
    },
    {
        id: "override-reasoning-none",
        description: "Reasoning override should disable reasoning",
        content: "Prove that there are infinitely many prime numbers",
        category: "overrides",
        overrides: {
            reasoningOverride: "none",
        },
        expectations: {
            reasoningEnabled: false,
            shouldSucceed: true,
        },
    },
    {
        id: "override-temperature-low",
        description: "Temperature override should force low temp",
        content: "Write a creative story about a dragon",
        category: "overrides",
        overrides: {
            temperatureOverride: 0.1,
        },
        expectations: {
            temperatureRange: [0.1, 0.1],
            shouldSucceed: true,
        },
    },
    {
        id: "override-temperature-high",
        description: "Temperature override should force high temp",
        content: "What is the exact syntax for a JavaScript arrow function?",
        category: "overrides",
        overrides: {
            temperatureOverride: 0.9,
        },
        expectations: {
            temperatureRange: [0.9, 0.9],
            shouldSucceed: true,
        },
    },

    // ========================================================================
    // EDGE CASES
    // Validate handling of unusual inputs
    // ========================================================================
    {
        id: "edge-empty-response",
        description: "Should handle query that expects short response",
        content: "Reply with just the word 'yes'",
        category: "edge-cases",
        expectations: {
            shouldSucceed: true,
        },
    },
    {
        id: "edge-unicode",
        description: "Should handle unicode characters",
        content: "Translate 'hello world' to Japanese: \u3053\u3093\u306b\u3061\u306f",
        category: "edge-cases",
        expectations: {
            shouldSucceed: true,
        },
    },
    {
        id: "edge-long-context",
        description: "Should handle longer context",
        content: `Here is a longer piece of text to process. ${Array(50).fill("This sentence is repeated to create more context.").join(" ")} Now summarize this in one sentence.`,
        category: "edge-cases",
        expectations: {
            shouldSucceed: true,
        },
    },
];

/**
 * Get tests by category
 */
export function getTestsByCategory(category: TestQuery["category"]): TestQuery[] {
    return TEST_QUERIES.filter((t) => t.category === category && !t.skip);
}

/**
 * Get all non-skipped tests
 */
export function getAllTests(): TestQuery[] {
    return TEST_QUERIES.filter((t) => !t.skip);
}

/**
 * Get fast tests only (excludes slow tests like deep research)
 */
export function getFastTests(): TestQuery[] {
    return TEST_QUERIES.filter((t) => !t.skip && !t.slow);
}

/**
 * Get a specific test by ID
 */
export function getTestById(id: string): TestQuery | undefined {
    return TEST_QUERIES.find((t) => t.id === id);
}
