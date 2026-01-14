/**
 * AI Team Member Unit Tests
 *
 * Tests the AI Team member execution logic with mocked AI SDK responses.
 * Focuses on edge cases and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("ai", () => ({
    generateText: vi.fn(),
    streamText: vi.fn(),
    tool: vi.fn((config) => config),
    stepCountIs: vi.fn(() => () => false),
    hasToolCall: vi.fn(() => () => false),
}));

vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_, fn) =>
        fn({
            setAttribute: vi.fn(),
            setAttributes: vi.fn(),
            spanContext: () => ({ traceId: "test-trace-id" }),
        })
    ),
    getActiveSpan: vi.fn(() => ({ spanContext: () => ({ traceId: "test-trace-id" }) })),
    captureException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        })),
    },
}));

vi.mock("@/lib/ai/gateway", () => ({
    getGatewayClient: vi.fn(() => vi.fn()),
    translateModelId: vi.fn((id) => id),
}));

vi.mock("@/lib/integrations/tools", () => ({
    getIntegrationTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/tools/built-in", () => ({
    builtInTools: {},
}));

vi.mock("@/lib/ai/message-pruning", () => ({
    pruneModelMessages: vi.fn((messages) => messages),
}));

import { generateText } from "ai";
import { runAITeamMember, type AITeamMemberInput } from "@/lib/agents/ai-team-member";

const baseInput: AITeamMemberInput = {
    jobId: "job-123",
    userId: "user-456",
    userEmail: "test@example.com",
    prompt: "Check the weather",
    memory: {},
};

describe("runAITeamMember", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handles successful completion with valid args", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: {
                                summary: "Weather checked successfully",
                                notifications: [],
                            },
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.summary).toBe("Weather checked successfully");
    });

    it("handles completion tool call with undefined args gracefully", async () => {
        // This is the bug scenario: complete tool exists but args is undefined
        // This can happen with malformed AI responses
        vi.mocked(generateText).mockResolvedValue({
            text: "I completed the task.",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: undefined, // Malformed - args missing
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        // Should NOT throw - should fall back to text response
        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.summary).toBe("I completed the task.");
    });

    it("handles completion tool call with null args gracefully", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "Task done via text.",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: null, // Explicit null
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.summary).toBe("Task done via text.");
    });

    it("falls back to text when no complete tool is called", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "Here is your answer without explicit completion.",
            steps: [
                {
                    toolCalls: [],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.summary).toBe("Here is your answer without explicit completion.");
    });

    it("returns error result when execution throws", async () => {
        vi.mocked(generateText).mockRejectedValue(new Error("API rate limited"));

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(false);
        expect(result.summary).toContain("API rate limited");
    });

    it("counts tool calls across multiple steps", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "search",
                            toolCallId: "call-1",
                            args: { query: "weather" },
                        },
                        {
                            toolName: "fetch",
                            toolCallId: "call-2",
                            args: { url: "example.com" },
                        },
                    ],
                    toolResults: [],
                },
                {
                    toolCalls: [
                        { toolName: "analyze", toolCallId: "call-3", args: {} },
                    ],
                    toolResults: [],
                },
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-4",
                            args: { summary: "Done", notifications: [] },
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.toolCallsExecuted).toBe(4);
    });

    it("merges memory updates from completion", async () => {
        const inputWithMemory: AITeamMemberInput = {
            ...baseInput,
            memory: { existingKey: "existingValue", overwriteMe: "old" },
        };

        vi.mocked(generateText).mockResolvedValue({
            text: "",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: {
                                summary: "Memory updated",
                                notifications: [],
                                memoryUpdates: {
                                    newKey: "newValue",
                                    overwriteMe: "new",
                                },
                            },
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(inputWithMemory);

        expect(result.updatedMemory).toEqual({
            existingKey: "existingValue",
            overwriteMe: "new",
            newKey: "newValue",
        });
    });

    it("extracts notifications from completion", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: {
                                summary: "Task done",
                                notifications: [
                                    {
                                        title: "Alert",
                                        body: "Something important happened",
                                        priority: "high",
                                    },
                                    {
                                        title: "Info",
                                        body: "FYI",
                                        priority: "low",
                                    },
                                ],
                            },
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.notifications).toHaveLength(2);
        expect(result.notifications[0]).toEqual({
            title: "Alert",
            body: "Something important happened",
            priority: "high",
        });
    });

    it("handles completion with missing optional fields", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: {
                                summary: "Minimal completion",
                                // No notifications, no memoryUpdates
                            },
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.notifications).toEqual([]);
        expect(result.updatedMemory).toEqual({});
    });

    it("handles steps with undefined toolCalls array", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "Completed without tools",
            steps: [
                { toolCalls: undefined, toolResults: [] },
                { toolCalls: null, toolResults: [] },
                { toolResults: [] }, // Missing toolCalls entirely
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.toolCallsExecuted).toBe(0);
        expect(result.summary).toBe("Completed without tools");
    });

    it("uses default summary when text is empty and no completion", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "",
            steps: [],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.summary).toBe("Task completed without explicit summary.");
    });

    it("uses text when null and falls back to default", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: null,
            steps: [],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(true);
        expect(result.summary).toBe("Task completed without explicit summary.");
    });

    it("finds complete tool in later steps", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "Should not use this",
            steps: [
                {
                    toolCalls: [{ toolName: "search", toolCallId: "call-1", args: {} }],
                    toolResults: [],
                },
                {
                    toolCalls: [
                        { toolName: "analyze", toolCallId: "call-2", args: {} },
                    ],
                    toolResults: [],
                },
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-3",
                            args: { summary: "Found in step 3", notifications: [] },
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        expect(result.summary).toBe("Found in step 3");
    });

    it("preserves original memory when no updates provided", async () => {
        const inputWithMemory: AITeamMemberInput = {
            ...baseInput,
            memory: { preserved: "value", another: 123 },
        };

        vi.mocked(generateText).mockResolvedValue({
            text: "Done",
            steps: [],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(inputWithMemory);

        expect(result.updatedMemory).toEqual({ preserved: "value", another: 123 });
    });

    it("handles error with non-Error object", async () => {
        vi.mocked(generateText).mockRejectedValue("String error");

        const result = await runAITeamMember(baseInput);

        expect(result.success).toBe(false);
        expect(result.summary).toContain("Unknown error");
    });

    it("handles empty args object gracefully", async () => {
        vi.mocked(generateText).mockResolvedValue({
            text: "Fallback text",
            steps: [
                {
                    toolCalls: [
                        {
                            toolName: "complete",
                            toolCallId: "call-1",
                            args: {}, // Empty object - missing required summary
                        },
                    ],
                    toolResults: [],
                },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
        } as any);

        const result = await runAITeamMember(baseInput);

        // Empty args object should fall back to text (no summary present)
        expect(result.success).toBe(true);
        expect(result.summary).toBe("Fallback text");
    });
});
