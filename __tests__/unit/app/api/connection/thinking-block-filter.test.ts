/**
 * Tests for thinking block filtering in multi-turn conversations
 *
 * When reasoning is enabled, Anthropic returns thinking blocks in messages.
 * These blocks cannot be modified in multi-turn conversations - we must
 * filter them out before sending messages back to the API.
 */

import { describe, test, expect } from "bun:test";

describe("Thinking block filtering", () => {
    // Simulate the filtering logic from route.ts
    function filterReasoningBlocks(messages: any[]) {
        return messages.map((msg) => {
            const filtered: any = { ...msg };

            // Filter parts array if it exists
            if (msg.parts) {
                filtered.parts = msg.parts.filter((part: any) => {
                    const partType = part.type as string;
                    return (
                        partType !== "reasoning" &&
                        partType !== "thinking" &&
                        partType !== "redacted_thinking"
                    );
                });
            }

            // Filter content array if it exists and is an array
            if (Array.isArray(msg.content)) {
                filtered.content = msg.content.filter((part: any) => {
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
    }

    test("filters reasoning blocks from parts array", () => {
        const messages = [
            {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "The answer is..." },
                    { type: "reasoning", text: "Let me think..." },
                ],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        expect(filtered[0].parts).toHaveLength(1);
        expect(filtered[0].parts[0].type).toBe("text");
    });

    test("filters thinking blocks from content array", () => {
        const messages = [
            {
                id: "msg-1",
                role: "assistant",
                content: [
                    { type: "text", text: "The answer is..." },
                    { type: "thinking", text: "Internal reasoning..." },
                ],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        expect(filtered[0].content).toHaveLength(1);
        expect(filtered[0].content[0].type).toBe("text");
    });

    test("filters redacted_thinking blocks from content array", () => {
        const messages = [
            {
                id: "msg-1",
                role: "assistant",
                content: [
                    { type: "text", text: "The answer is..." },
                    { type: "redacted_thinking", text: "[redacted]" },
                ],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        expect(filtered[0].content).toHaveLength(1);
        expect(filtered[0].content[0].type).toBe("text");
    });

    test("handles messages with both parts and content", () => {
        const messages = [
            {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "Answer from parts" },
                    { type: "reasoning", text: "Reasoning in parts..." },
                ],
                content: [
                    { type: "text", text: "Answer from content" },
                    { type: "thinking", text: "Thinking in content..." },
                ],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        expect(filtered[0].parts).toHaveLength(1);
        expect(filtered[0].parts[0].type).toBe("text");
        expect(filtered[0].content).toHaveLength(1);
        expect(filtered[0].content[0].type).toBe("text");
    });

    test("preserves messages without reasoning blocks", () => {
        const messages = [
            {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Hello!" }],
            },
            {
                id: "msg-2",
                role: "assistant",
                parts: [{ type: "text", text: "Hi there!" }],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        expect(filtered).toHaveLength(2);
        expect(filtered[0].parts).toHaveLength(1);
        expect(filtered[1].parts).toHaveLength(1);
    });

    test("handles multi-turn conversation with reasoning", () => {
        const messages = [
            {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Solve this riddle" }],
            },
            {
                id: "msg-2",
                role: "assistant",
                content: [
                    { type: "text", text: "The answer is: an echo" },
                    { type: "thinking", text: "Let me analyze this riddle..." },
                ],
                parts: [
                    { type: "text", text: "The answer is: an echo" },
                    { type: "reasoning", text: "Let me analyze this riddle..." },
                ],
            },
            {
                id: "msg-3",
                role: "user",
                parts: [{ type: "text", text: "Explain your reasoning" }],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        // User messages unchanged
        expect(filtered[0].parts).toHaveLength(1);
        expect(filtered[2].parts).toHaveLength(1);

        // Assistant message has thinking blocks removed
        expect(filtered[1].content).toHaveLength(1);
        expect(filtered[1].content[0].type).toBe("text");
        expect(filtered[1].parts).toHaveLength(1);
        expect(filtered[1].parts[0].type).toBe("text");
    });

    test("handles empty arrays after filtering", () => {
        const messages = [
            {
                id: "msg-1",
                role: "assistant",
                parts: [{ type: "reasoning", text: "Only reasoning..." }],
                content: [{ type: "thinking", text: "Only thinking..." }],
            },
        ];

        const filtered = filterReasoningBlocks(messages);

        expect(filtered[0].parts).toHaveLength(0);
        expect(filtered[0].content).toHaveLength(0);
    });
});
