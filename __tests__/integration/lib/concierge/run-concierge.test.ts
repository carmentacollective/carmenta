/**
 * Integration tests for runConcierge using mocked AI SDK.
 *
 * These tests mock the `generateText` and `tool` functions from the AI SDK to test
 * the full concierge flow without making actual API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";

// Mock generateText and tool before importing the module under test
vi.mock("ai", () => ({
    generateText: vi.fn(),
    tool: vi.fn((config) => config), // Pass-through mock for tool definition
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

import { generateText } from "ai";
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
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-1",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "anthropic/claude-opus-4.5",
                        temperature: 0.6,
                        explanation: "Complex analysis needs deeper reasoning.",
                        reasoning: { enabled: true, effort: "high" },
                        title: "🧠 Analyze complex problem",
                    },
                },
            ],
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
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-2",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "anthropic/claude-sonnet-4.5",
                        temperature: 0.4,
                        explanation:
                            "Code review is well-suited for our balanced default.",
                        reasoning: { enabled: true, effort: "medium" },
                        title: "🔍 Code review",
                    },
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([createUserMessage("Review my code")]);

        expect(result.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result.temperature).toBeLessThanOrEqual(0.5);
    });

    it("selects Haiku for quick questions with reasoning disabled", async () => {
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-3",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "anthropic/claude-haiku-4.5",
                        temperature: 0.3,
                        explanation: "Simple factual lookup needs speed over depth.",
                        reasoning: { enabled: false },
                        title: "TypeScript explanation",
                    },
                },
            ],
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
        expect(generateText).not.toHaveBeenCalled();
    });

    it("returns defaults when LLM call fails", async () => {
        (generateText as any).mockRejectedValueOnce(new Error("API Error"));

        const result = await runConcierge([createUserMessage("Test query")]);

        expect(result).toEqual(CONCIERGE_DEFAULTS);
    });

    it("returns defaults and reports to Sentry when tool call fails", async () => {
        // This test verifies behavior when no tool calls are generated
        // Common causes: API errors, network issues, model doesn't call the tool
        (generateText as any).mockResolvedValueOnce({
            text: "Some response without tool calls",
            toolCalls: [], // No tool calls generated
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const Sentry = await import("@sentry/nextjs");

        const result = await runConcierge([createUserMessage("Test query")]);

        // Should gracefully return defaults
        expect(result).toEqual(CONCIERGE_DEFAULTS);

        // Should report to Sentry for observability with error type tag
        expect(Sentry.captureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                tags: expect.objectContaining({
                    component: "concierge",
                    error_type: "Error",
                }),
            })
        );
    });

    it("uses last user message when multiple messages exist", async () => {
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-4",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "anthropic/claude-sonnet-4.5",
                        temperature: 0.7,
                        explanation:
                            "Creative writing benefits from higher temperature.",
                        reasoning: { enabled: false },
                        title: "🎨 Creative story",
                    },
                },
            ],
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

        // Verify generateText was called with the last user message wrapped in our prompt structure
        // Note: we now use messages array instead of prompt param for caching support
        expect(generateText).toHaveBeenCalledTimes(1);
        const call = (generateText as any).mock.calls[0][0];
        const userMessage = call.messages.find((m: any) => m.role === "user");
        expect(userMessage.content).toContain("<user-message>");
        expect(userMessage.content).toContain("Write a creative story");
        expect(userMessage.content).toContain("</user-message>");
        expect(userMessage.content).toContain("Do NOT answer the message");
    });

    it("calls generateText with correct parameters including tool", async () => {
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-5",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "anthropic/claude-sonnet-4.5",
                        temperature: 0.5,
                        explanation: "Default choice.",
                        reasoning: { enabled: false },
                        title: "Test query",
                    },
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        await runConcierge([createUserMessage("Test")]);

        expect(generateText).toHaveBeenCalledWith(
            expect.objectContaining({
                temperature: 0.1, // Low temperature for consistent routing
                tools: expect.objectContaining({
                    selectModelTool: expect.any(Object),
                }),
                toolChoice: "required", // Force the model to call the tool
            })
        );
    });

    it("accepts GPT 5.2 selection for integration tool queries", async () => {
        // When concierge selects GPT 5.2 for multi-step tool queries,
        // the result should be properly processed
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-gpt52",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "openai/gpt-5.2",
                        temperature: 0.5,
                        explanation:
                            "Fetching and summarizing conversations needs tool-calling accuracy",
                        reasoning: { enabled: false },
                        title: "📝 Yesterday's highlights",
                    },
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([
            createUserMessage(
                "Look at my Limitless conversations from yesterday and give me the highlights"
            ),
        ]);

        expect(result.modelId).toBe("openai/gpt-5.2");
        expect(result.temperature).toBe(0.5);
        expect(result.reasoning.enabled).toBe(false);
        expect(result.title).toBe("📝 Yesterday's highlights");
    });

    it("accepts GPT 5.2 selection for research queries needing multi-step tools", async () => {
        (generateText as any).mockResolvedValueOnce({
            text: "Tool call response",
            toolCalls: [
                {
                    type: "tool-call",
                    toolCallId: "test-research",
                    toolName: "selectModelTool",
                    input: {
                        modelId: "openai/gpt-5.2",
                        temperature: 0.5,
                        explanation:
                            "Research with analysis needs accurate tool calling",
                        reasoning: { enabled: true, effort: "medium" },
                        title: "⚛️ React 19 features",
                    },
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
        } as any);

        const result = await runConcierge([
            createUserMessage(
                "Search the web for React 19 features and give me a detailed analysis"
            ),
        ]);

        expect(result.modelId).toBe("openai/gpt-5.2");
        expect(result.reasoning.enabled).toBe(true);
        expect(result.reasoning.effort).toBe("medium");
        // GPT 5.2 uses effort-based reasoning, not token budget
        expect(result.reasoning.maxTokens).toBeUndefined();
    });
});
