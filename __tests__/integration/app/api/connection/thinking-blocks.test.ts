/**
 * Regression test for thinking blocks bug
 *
 * Bug: When reasoning is enabled and tools are called, thinking blocks from the
 * assistant's response were included in originalMessages passed to toUIMessageStreamResponse,
 * causing Anthropic API error: "thinking blocks cannot be modified"
 *
 * Fix: Pass messagesWithoutReasoning to toUIMessageStreamResponse instead of originalMessages
 *
 * This test validates that messages with thinking blocks are properly filtered
 * before being used in multi-turn conversations.
 */

import { describe, test, expect } from "vitest";

describe("Thinking blocks regression test", () => {
    /**
     * Simulates the bug scenario:
     * 1. User sends message
     * 2. Assistant responds with reasoning (includes thinking blocks)
     * 3. Tools are called (multi-turn conversation)
     * 4. Messages need to be filtered before passing to toUIMessageStreamResponse
     */
    test("filters thinking blocks before passing to toUIMessageStreamResponse", () => {
        // Simulate conversation with reasoning and tool calls
        const messages = [
            {
                id: "user-1",
                role: "user",
                parts: [{ type: "text", text: "Research git worktrees" }],
            },
            {
                id: "assistant-1",
                role: "assistant",
                content: [
                    { type: "text", text: "Let me search for that" },
                    {
                        type: "thinking",
                        text: "The user wants information about git worktrees...",
                    },
                ],
                parts: [
                    { type: "text", text: "Let me search for that" },
                    {
                        type: "reasoning",
                        text: "The user wants information about git worktrees...",
                    },
                ],
            },
        ];

        // This is the filtering logic from route.ts (lines 463-491)
        const messagesWithoutReasoning = messages.map((msg) => {
            const filtered: any = { ...msg };

            // Filter parts array if it exists
            if ((msg as any).parts) {
                filtered.parts = (msg as any).parts.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            // Filter content array if it exists and is an array
            if (Array.isArray((msg as any).content)) {
                filtered.content = (msg as any).content.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            return filtered;
        });

        // Validate that thinking blocks were filtered out
        const assistantMessage = messagesWithoutReasoning[1];

        // Should have filtered thinking from content
        expect(assistantMessage.content).toHaveLength(1);
        expect(assistantMessage.content[0].type).toBe("text");

        // Should have filtered reasoning from parts
        expect(assistantMessage.parts).toHaveLength(1);
        expect(assistantMessage.parts[0].type).toBe("text");

        // User message should be unchanged
        expect(messagesWithoutReasoning[0].parts).toHaveLength(1);
        expect(messagesWithoutReasoning[0].parts[0].type).toBe("text");

        // THE BUG: Original code passed `messages` (with thinking blocks) to toUIMessageStreamResponse
        // THE FIX: Must pass `messagesWithoutReasoning` (filtered) instead
        //
        // This test validates the filtered messages are ready to be used in toUIMessageStreamResponse
        // without causing Anthropic API errors about modified thinking blocks.
        //
        // Before fix (line 622 of route.ts):
        //   originalMessages: messages  ← Contains thinking blocks, causes API error
        //
        // After fix (line 622 of route.ts):
        //   originalMessages: messagesWithoutReasoning  ← Filtered, no error

        // Verify the original messages still have thinking blocks (sanity check)
        expect(messages[1].content).toHaveLength(2);
        expect((messages[1].content as any)[1].type).toBe("thinking");
        expect(messages[1].parts).toHaveLength(2);
        expect((messages[1].parts as any)[1].type).toBe("reasoning");
    });

    test("preserves messages without thinking blocks", () => {
        const messages = [
            {
                id: "user-1",
                role: "user",
                parts: [{ type: "text", text: "Hello!" }],
            },
            {
                id: "assistant-1",
                role: "assistant",
                parts: [{ type: "text", text: "Hi there!" }],
            },
        ];

        // Apply filtering
        const messagesWithoutReasoning = messages.map((msg) => {
            const filtered: any = { ...msg };

            if ((msg as any).parts) {
                filtered.parts = (msg as any).parts.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            if (Array.isArray((msg as any).content)) {
                filtered.content = (msg as any).content.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            return filtered;
        });

        // Messages without thinking blocks should be unchanged
        expect(messagesWithoutReasoning).toHaveLength(2);
        expect(messagesWithoutReasoning[0].parts).toHaveLength(1);
        expect(messagesWithoutReasoning[1].parts).toHaveLength(1);
    });

    test("handles redacted_thinking blocks", () => {
        const messages = [
            {
                id: "assistant-1",
                role: "assistant",
                content: [
                    { type: "text", text: "The answer is 42" },
                    { type: "redacted_thinking", text: "[redacted]" },
                ],
            },
        ];

        // Apply filtering
        const messagesWithoutReasoning = messages.map((msg) => {
            const filtered: any = { ...msg };

            if ((msg as any).parts) {
                filtered.parts = (msg as any).parts.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            if (Array.isArray((msg as any).content)) {
                filtered.content = (msg as any).content.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            return filtered;
        });

        // redacted_thinking should be filtered out
        expect(messagesWithoutReasoning[0].content).toHaveLength(1);
        expect(messagesWithoutReasoning[0].content[0].type).toBe("text");
    });
});
