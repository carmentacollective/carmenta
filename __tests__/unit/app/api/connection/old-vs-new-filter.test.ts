/**
 * Demonstrates the bug in the old filtering logic and how the new logic fixes it
 */

import { describe, test, expect } from "bun:test";

describe("Bug replication: old vs new filtering logic", () => {
    // OLD LOGIC - only filtered parts array
    function oldFilteringLogic(messages: any[]) {
        return messages.map((msg) => ({
            ...msg,
            parts: msg.parts.filter((part: any) => {
                const partType = part.type as string;
                return (
                    partType !== "reasoning" &&
                    partType !== "thinking" &&
                    partType !== "redacted_thinking"
                );
            }),
        }));
    }

    // NEW LOGIC - filters both parts and content arrays
    function newFilteringLogic(messages: any[]) {
        return messages.map((msg) => {
            const filtered: any = { ...msg };

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

    test("BUG REPLICATION: old logic fails to filter thinking blocks from content array", () => {
        // This is the scenario that caused the original error:
        // messages.1.content.1: `thinking` blocks cannot be modified
        const messages = [
            {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Solve this riddle" }],
            },
            {
                id: "msg-2",
                role: "assistant",
                parts: [{ type: "text", text: "Answer: echo" }],
                // The AI SDK adds thinking blocks to content array
                content: [
                    { type: "text", text: "Answer: echo" },
                    { type: "thinking", text: "Let me analyze..." }, // ← THIS CAUSED THE BUG
                ],
            },
        ];

        const oldFiltered = oldFilteringLogic(messages);
        const newFiltered = newFilteringLogic(messages);

        // OLD LOGIC BUG: thinking block still in content array!
        expect(Array.isArray(oldFiltered[1].content)).toBe(true);
        expect(oldFiltered[1].content).toHaveLength(2); // ❌ Still has 2 items
        expect(oldFiltered[1].content[1].type).toBe("thinking"); // ❌ Thinking block still there!

        // NEW LOGIC FIX: thinking block removed from content array
        expect(Array.isArray(newFiltered[1].content)).toBe(true);
        expect(newFiltered[1].content).toHaveLength(1); // ✅ Only 1 item now
        expect(newFiltered[1].content[0].type).toBe("text"); // ✅ Only text remains
    });

    test("OLD LOGIC WORKS: correctly filters parts array (but that's not enough)", () => {
        const messages = [
            {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "Answer" },
                    { type: "reasoning", text: "Reasoning..." },
                ],
            },
        ];

        const oldFiltered = oldFilteringLogic(messages);

        // Old logic DID work for parts array
        expect(oldFiltered[0].parts).toHaveLength(1);
        expect(oldFiltered[0].parts[0].type).toBe("text");
    });

    test("FULL BUG SCENARIO: multi-turn with reasoning in content array", () => {
        // Exact scenario from the error message:
        // When you send a follow-up message in a conversation where
        // the previous assistant message had reasoning enabled
        const conversationHistory = [
            {
                id: "user-msg-1",
                role: "user",
                parts: [
                    {
                        type: "text",
                        text: "Solve this: I speak without a mouth and hear without ears",
                    },
                ],
            },
            {
                id: "assistant-msg-1",
                role: "assistant",
                parts: [{ type: "text", text: "The answer is: an echo" }],
                // When reasoning is enabled, AI SDK includes thinking in content
                content: [
                    { type: "text", text: "The answer is: an echo" },
                    {
                        type: "thinking",
                        text: "This riddle describes something that can produce sound...",
                    },
                ],
            },
            {
                id: "user-msg-2",
                role: "user",
                parts: [{ type: "text", text: "Explain your reasoning" }],
            },
        ];

        // When we send this back to the API with OLD logic:
        const oldFiltered = oldFilteringLogic(conversationHistory);

        // The thinking block is still there! This causes:
        // Error: messages.1.content.1: `thinking` blocks cannot be modified
        const assistantMsg = oldFiltered[1];
        expect(assistantMsg.content[1].type).toBe("thinking"); // ❌ BUG!

        // With NEW logic:
        const newFiltered = newFilteringLogic(conversationHistory);
        const fixedAssistantMsg = newFiltered[1];

        // Thinking block is removed - no error!
        expect(fixedAssistantMsg.content).toHaveLength(1);
        expect(fixedAssistantMsg.content[0].type).toBe("text"); // ✅ FIXED!
    });
});
