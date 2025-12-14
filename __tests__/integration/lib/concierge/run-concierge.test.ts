/**
 * Integration tests for runConcierge using mocked AI SDK.
 *
 * These tests mock the `generateObject` function from the AI SDK to test
 * the full concierge flow without making actual API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";

// Mock generateObject before importing the module under test
vi.mock("ai", () => ({
    generateObject: vi.fn(),
}));

// Mock fs/promises for rubric loading
vi.mock("fs/promises", () => {
    const mockReadFile = vi.fn().mockResolvedValue(`# Test Rubric
## Primary Models
### anthropic/claude-sonnet-4.5
Our default model.
**Choose when**: Most requests
`);
    return {
        default: { readFile: mockReadFile },
        readFile: mockReadFile,
    };
});

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

import { generateObject } from "ai";
import { runConcierge, clearRubricCache, CONCIERGE_DEFAULTS } from "@/lib/concierge";

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
        (generateObject as any).mockResolvedValueOnce({
            object: {
                modelId: "anthropic/claude-opus-4.5",
                temperature: 0.6,
                explanation: "Complex analysis needs deeper reasoning.",
                reasoning: { enabled: true, effort: "high" },
                title: "🧠 Analyze complex problem",
            },
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
        (generateObject as any).mockResolvedValueOnce({
            object: {
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.4,
                explanation: "Code review is well-suited for our balanced default.",
                reasoning: { enabled: true, effort: "medium" },
                title: "🔍 Code review",
            },
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("Review my code")]);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.temperature).toBeLessThanOrEqual(0.5);
    });

    it("selects Haiku for quick questions with reasoning disabled", async () => {
        (generateObject as any).mockResolvedValueOnce({
            object: {
                modelId: "anthropic/claude-haiku-4.5",
                temperature: 0.3,
                explanation: "Simple factual lookup needs speed over depth.",
                reasoning: { enabled: false },
                title: "TypeScript explanation",
            },
            usage: { promptTokens: 50, completionTokens: 30 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("What is TypeScript?")]);

        expect(result.modelId).toBe("anthropic/claude-haiku-4.5");
        expect(result.reasoning.enabled).toBe(false);
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
        expect(generateObject).not.toHaveBeenCalled();
    });

    it("returns defaults when LLM call fails", async () => {
        (generateObject as any).mockRejectedValueOnce(new Error("API Error"));

        const result = await runConcierge([createUserMessage("Test query")]);

        expect(result).toEqual(CONCIERGE_DEFAULTS);
    });

    it("returns defaults and reports to Sentry when AI_NoObjectGeneratedError occurs", async () => {
        // This error occurs when generateObject can't parse the LLM response
        // Common causes: truncated output, model returns non-JSON, provider issues
        const noObjectError = new Error(
            "No object generated: could not parse the response."
        );
        noObjectError.name = "AI_NoObjectGeneratedError";
        (generateObject as any).mockRejectedValueOnce(noObjectError);

        const Sentry = await import("@sentry/nextjs");

        const result = await runConcierge([createUserMessage("Test query")]);

        // Should gracefully return defaults
        expect(result).toEqual(CONCIERGE_DEFAULTS);

        // Should report to Sentry for observability with error type tag
        expect(Sentry.captureException).toHaveBeenCalledWith(
            noObjectError,
            expect.objectContaining({
                tags: expect.objectContaining({
                    component: "concierge",
                    error_type: "AI_NoObjectGeneratedError",
                }),
            })
        );
    });

    it("uses last user message when multiple messages exist", async () => {
        (generateObject as any).mockResolvedValueOnce({
            object: {
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.7,
                explanation: "Creative writing benefits from higher temperature.",
                reasoning: { enabled: false },
                title: "🎨 Creative story",
            },
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

        // Verify generateObject was called with the last user message wrapped in our prompt structure
        expect(generateObject).toHaveBeenCalledTimes(1);
        const call = (generateObject as any).mock.calls[0][0];
        expect(call.prompt).toContain("<user-message>");
        expect(call.prompt).toContain("Write a creative story");
        expect(call.prompt).toContain("</user-message>");
        expect(call.prompt).toContain("Do NOT answer the message");
    });

    it("calls generateObject with correct parameters including schema", async () => {
        (generateObject as any).mockResolvedValueOnce({
            object: {
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Default choice.",
                reasoning: { enabled: false },
                title: "Test query",
            },
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        await runConcierge([createUserMessage("Test")]);

        expect(generateObject).toHaveBeenCalledWith(
            expect.objectContaining({
                temperature: 0.1, // Low temperature for consistent routing
                schema: expect.any(Object), // Zod schema
                schemaName: "ConciergeResponse",
            })
        );

        // Verify we DON'T set maxOutputTokens - let the SDK handle it
        const callArgs = (generateObject as any).mock.calls[0][0];
        expect(callArgs.maxOutputTokens).toBeUndefined();
    });
});
