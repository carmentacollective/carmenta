/**
 * Integration tests for runConcierge using mocked AI SDK.
 *
 * These tests mock the `generateText` function from the AI SDK to test
 * the full concierge flow without making actual API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";

// Mock generateText before importing the module under test
vi.mock("ai", async () => {
    const actual = await import("ai");
    return {
        ...actual,
        generateText: vi.fn(),
    };
});

// Mock fs/promises for rubric loading
vi.mock("node:fs/promises", () => ({
    default: {
        readFile: vi.fn().mockResolvedValue(`# Test Rubric
## Primary Models
### anthropic/claude-sonnet-4.5
Our default model.
**Choose when**: Most requests
`),
    },
    readFile: vi.fn().mockResolvedValue(`# Test Rubric
## Primary Models
### anthropic/claude-sonnet-4.5
Our default model.
**Choose when**: Most requests
`),
}));

vi.mock("fs/promises", () => ({
    default: {
        readFile: vi.fn().mockResolvedValue(`# Test Rubric
## Primary Models
### anthropic/claude-sonnet-4.5
Our default model.
**Choose when**: Most requests
`),
    },
    readFile: vi.fn().mockResolvedValue(`# Test Rubric
## Primary Models
### anthropic/claude-sonnet-4.5
Our default model.
**Choose when**: Most requests
`),
}));

// Mock Sentry to avoid errors
vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_, fn) => fn({ setAttribute: vi.fn() })),
    captureException: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: { OPENROUTER_API_KEY: "test-key" },
    assertEnv: vi.fn(),
}));

import { generateText } from "ai";
import {
    runConcierge,
    clearRubricCache,
    CONCIERGE_DEFAULTS,
    CONCIERGE_MAX_OUTPUT_TOKENS,
} from "@/lib/concierge";

describe("runConcierge integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRubricCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createUserMessage = (text: string): UIMessage => ({
        id: "1",
        role: "user",
        parts: [{ type: "text", text }],
    });

    it("returns parsed model selection from LLM response with reasoning config", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: JSON.stringify({
                modelId: "anthropic/claude-opus-4.5",
                temperature: 0.6,
                explanation: "Complex analysis needs deeper reasoning.",
                reasoning: { enabled: true, effort: "high" },
            }),
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([
            createUserMessage("Analyze this complex problem"),
        ]);

        expect(result.modelId).toBe("anthropic/claude-opus-4.5");
        expect(result.temperature).toBe(0.6);
        expect(result.explanation).toBe("Complex analysis needs deeper reasoning.");
        expect(result.reasoning.enabled).toBe(true);
        expect(result.reasoning.effort).toBe("high");
        expect(result.reasoning.maxTokens).toBe(16000); // high = 16K tokens
    });

    it("selects Sonnet for typical coding tasks", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.4,
                explanation: "Code review is well-suited for our balanced default.",
                reasoning: { enabled: true, effort: "medium" },
            }),
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("Review my code")]);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.temperature).toBeLessThanOrEqual(0.5);
    });

    it("selects Haiku for quick questions with reasoning disabled", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: JSON.stringify({
                modelId: "anthropic/claude-haiku-4.5",
                temperature: 0.3,
                explanation: "Simple factual lookup needs speed over depth.",
                reasoning: { enabled: false },
            }),
            usage: { promptTokens: 50, completionTokens: 30 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("What is TypeScript?")]);

        expect(result.modelId).toBe("anthropic/claude-haiku-4.5");
        expect(result.reasoning.enabled).toBe(false);
    });

    it("handles LLM response with markdown code blocks", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: `\`\`\`json
{
    "modelId": "anthropic/claude-sonnet-4.5",
    "temperature": 0.5,
    "explanation": "Standard task.",
    "reasoning": { "enabled": false }
}
\`\`\``,
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("Help me")]);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
    });

    it("returns defaults when no user message found", async () => {
        const assistantOnlyMessages: UIMessage[] = [
            {
                id: "1",
                role: "assistant",
                parts: [{ type: "text", text: "Hello!" }],
            },
        ];

        const result = await runConcierge(assistantOnlyMessages);

        expect(result).toEqual(CONCIERGE_DEFAULTS);
        expect(generateText).not.toHaveBeenCalled();
    });

    it("returns defaults when LLM call fails", async () => {
        vi.mocked(generateText).mockRejectedValueOnce(new Error("API Error"));

        const result = await runConcierge([createUserMessage("Test query")]);

        expect(result).toEqual(CONCIERGE_DEFAULTS);
    });

    it("returns defaults when LLM returns invalid JSON", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: "I'm not sure, let me think about it...",
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("Test query")]);

        expect(result).toEqual(CONCIERGE_DEFAULTS);
    });

    it("returns defaults when LLM response missing required fields", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: JSON.stringify({ modelId: "test" }), // missing temperature, explanation, reasoning
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("Test query")]);

        expect(result).toEqual(CONCIERGE_DEFAULTS);
    });

    it("uses last user message when multiple messages exist", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.7,
                explanation: "Creative writing benefits from higher temperature.",
                reasoning: { enabled: false },
            }),
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const messages: UIMessage[] = [
            {
                id: "1",
                role: "user",
                parts: [{ type: "text", text: "First question" }],
            },
            { id: "2", role: "assistant", parts: [{ type: "text", text: "Answer" }] },
            {
                id: "3",
                role: "user",
                parts: [{ type: "text", text: "Write a creative story" }],
            },
        ];

        await runConcierge(messages);

        // Verify generateText was called with the last user message
        expect(generateText).toHaveBeenCalledTimes(1);
        const call = vi.mocked(generateText).mock.calls[0][0];
        expect(call.prompt).toBe("Write a creative story");
    });

    it("calls generateText with correct parameters", async () => {
        vi.mocked(generateText).mockResolvedValueOnce({
            text: JSON.stringify({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Default choice.",
                reasoning: { enabled: false },
            }),
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        await runConcierge([createUserMessage("Test")]);

        expect(generateText).toHaveBeenCalledWith(
            expect.objectContaining({
                temperature: 0.1, // Low temperature for consistent routing
                maxOutputTokens: CONCIERGE_MAX_OUTPUT_TOKENS,
            })
        );
    });
});
