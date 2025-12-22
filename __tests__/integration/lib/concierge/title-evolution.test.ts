/**
 * Integration tests for title evolution using mocked AI SDK.
 *
 * Tests the title evolution logic that determines whether to update
 * a connection's title as the conversation progresses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock generateText and tool before importing the module under test
vi.mock("ai", () => ({
    generateText: vi.fn(),
    tool: vi.fn((config) => config),
}));

// Mock Sentry
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
    evaluateTitleEvolution,
    summarizeRecentMessages,
} from "@/lib/concierge/title-evolution";

describe("title evolution", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("summarizeRecentMessages", () => {
        it("summarizes user messages from recent history", () => {
            const messages = [
                { role: "user", content: "What is TypeScript?" },
                { role: "assistant", content: "TypeScript is..." },
                { role: "user", content: "How do generics work?" },
                { role: "assistant", content: "Generics allow..." },
            ];

            const summary = summarizeRecentMessages(messages);

            expect(summary).toContain("User: What is TypeScript?");
            expect(summary).toContain("User: How do generics work?");
            expect(summary).not.toContain("assistant");
        });

        it("truncates long messages", () => {
            const longMessage = "x".repeat(200);
            const messages = [{ role: "user", content: longMessage }];

            const summary = summarizeRecentMessages(messages);

            expect(summary.length).toBeLessThan(longMessage.length);
            expect(summary).toContain("...");
        });

        it("takes only last 10 messages", () => {
            const messages = Array.from({ length: 20 }, (_, i) => ({
                role: i % 2 === 0 ? "user" : "assistant",
                content: `Message ${i}`,
            }));

            const summary = summarizeRecentMessages(messages);

            // Should not contain early messages (0-9), only later ones (10-19)
            expect(summary).not.toContain("Message 0");
            expect(summary).toContain("Message 10");
        });

        it("returns fallback for empty messages", () => {
            const summary = summarizeRecentMessages([]);
            expect(summary).toBe("No recent messages");
        });

        it("returns fallback when no user messages", () => {
            const messages = [
                { role: "assistant", content: "Hello!" },
                { role: "assistant", content: "How can I help?" },
            ];

            const summary = summarizeRecentMessages(messages);
            expect(summary).toBe("No user messages in recent history");
        });
    });

    describe("evaluateTitleEvolution", () => {
        it("keeps title when conversation continues same topic", async () => {
            vi.mocked(generateText).mockResolvedValueOnce({
                text: "Tool call response",
                toolCalls: [
                    {
                        type: "tool-call",
                        toolCallId: "test-1",
                        toolName: "evaluateTitleTool",
                        input: {
                            action: "keep",
                            reasoning: "Follow-up messages continuing the same topic.",
                        },
                    },
                ],
                usage: { promptTokens: 100, completionTokens: 50 },
                finishReason: "stop",
            } as any);

            const result = await evaluateTitleEvolution(
                "🔧 Fix auth bug",
                "User: more examples\nUser: what about edge cases"
            );

            expect(result.action).toBe("keep");
            expect(result.title).toBeUndefined();
            expect(result.reasoning).toBe(
                "Follow-up messages continuing the same topic."
            );
        });

        it("updates title when explicit pivot occurs", async () => {
            vi.mocked(generateText).mockResolvedValueOnce({
                text: "Tool call response",
                toolCalls: [
                    {
                        type: "tool-call",
                        toolCallId: "test-2",
                        toolName: "evaluateTitleTool",
                        input: {
                            action: "update",
                            title: "🗄️ Database migration",
                            reasoning:
                                "Explicit pivot signal. New primary topic replaces old.",
                        },
                    },
                ],
                usage: { promptTokens: 100, completionTokens: 50 },
                finishReason: "stop",
            } as any);

            const result = await evaluateTitleEvolution(
                "🔧 Fix auth bug",
                "User: actually, let's talk about the database migration instead"
            );

            expect(result.action).toBe("update");
            expect(result.title).toBe("🗄️ Database migration");
        });

        it("consolidates umbrella when multiple topics emerge", async () => {
            vi.mocked(generateText).mockResolvedValueOnce({
                text: "Tool call response",
                toolCalls: [
                    {
                        type: "tool-call",
                        toolCallId: "test-3",
                        toolName: "evaluateTitleTool",
                        input: {
                            action: "update",
                            title: "💳 Payments: receipts, refunds",
                            reasoning:
                                "Three related topics now warrant umbrella consolidation.",
                        },
                    },
                ],
                usage: { promptTokens: 100, completionTokens: 50 },
                finishReason: "stop",
            } as any);

            const result = await evaluateTitleEvolution(
                "💳 Stripe setup",
                "User: webhooks\nUser: receipts\nUser: refund handling"
            );

            expect(result.action).toBe("update");
            expect(result.title).toBe("💳 Payments: receipts, refunds");
        });

        it("removes quotes from title", async () => {
            vi.mocked(generateText).mockResolvedValueOnce({
                text: "Tool call response",
                toolCalls: [
                    {
                        type: "tool-call",
                        toolCallId: "test-4",
                        toolName: "evaluateTitleTool",
                        input: {
                            action: "update",
                            title: '"Quoted title"',
                            reasoning: "Test quote removal.",
                        },
                    },
                ],
                usage: { promptTokens: 100, completionTokens: 50 },
                finishReason: "stop",
            } as any);

            const result = await evaluateTitleEvolution("Old title", "User: test");

            expect(result.title).toBe("Quoted title");
        });

        it("enforces max title length", async () => {
            const longTitle =
                "This is a very long title that exceeds the maximum character limit";

            vi.mocked(generateText).mockResolvedValueOnce({
                text: "Tool call response",
                toolCalls: [
                    {
                        type: "tool-call",
                        toolCallId: "test-5",
                        toolName: "evaluateTitleTool",
                        input: {
                            action: "update",
                            title: longTitle,
                            reasoning: "Test length enforcement.",
                        },
                    },
                ],
                usage: { promptTokens: 100, completionTokens: 50 },
                finishReason: "stop",
            } as any);

            const result = await evaluateTitleEvolution("Old title", "User: test");

            // 40 char max (from types.ts)
            expect(result.title!.length).toBeLessThanOrEqual(40);
            expect(result.title).toContain("...");
        });

        it("returns keep on API error", async () => {
            vi.mocked(generateText).mockRejectedValueOnce(new Error("API Error"));

            const result = await evaluateTitleEvolution("Current title", "User: test");

            expect(result.action).toBe("keep");
            expect(result.reasoning).toBe("Evaluation failed, maintaining stability");
        });

        it("returns keep when no tool call generated", async () => {
            vi.mocked(generateText).mockResolvedValueOnce({
                text: "Response without tool call",
                toolCalls: [],
                usage: { promptTokens: 100, completionTokens: 50 },
                finishReason: "stop",
            } as any);

            const result = await evaluateTitleEvolution("Current title", "User: test");

            expect(result.action).toBe("keep");
        });

        it("reports errors to Sentry", async () => {
            vi.mocked(generateText).mockRejectedValueOnce(new Error("API Error"));
            const Sentry = await import("@sentry/nextjs");

            await evaluateTitleEvolution("Current title", "User: test");

            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    tags: { component: "title-evolution" },
                })
            );
        });
    });
});
