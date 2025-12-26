/**
 * Message transformation utilities for AI SDK.
 *
 * Handles conversion and filtering of messages for multi-turn conversations.
 */

import type { UIMessage } from "ai";

/**
 * Part types that should be filtered from multi-turn conversations.
 *
 * Anthropic's API rejects requests that include thinking/reasoning blocks
 * from previous turns. These must be stripped before sending to any provider.
 */
const REASONING_PART_TYPES = ["reasoning", "thinking", "redacted_thinking"] as const;

/**
 * Filters reasoning/thinking blocks from messages for multi-turn API calls.
 *
 * When sending a conversation history to the API, thinking blocks from previous
 * assistant messages must be stripped. Anthropic's API rejects requests containing
 * thinking blocks in prior turns (they're ephemeral, not meant to persist).
 *
 * Note: This is different from multi-step tool calling within a single turn,
 * which the Vercel AI gateway handles correctly.
 *
 * @param messages - Array of UIMessages from the conversation
 * @returns Messages with reasoning/thinking parts removed
 */
export function filterReasoningFromMessages(messages: UIMessage[]): UIMessage[] {
    return messages.map((msg) => {
        const filtered: any = { ...msg };

        // Filter parts array if it exists
        if (msg.parts) {
            filtered.parts = msg.parts.filter((part) => {
                const partType = part.type as string;
                return !REASONING_PART_TYPES.includes(partType as any);
            });
        }

        // Filter content array if it exists and is an array
        if (Array.isArray((msg as any).content)) {
            filtered.content = (msg as any).content.filter((part: any) => {
                const partType = part.type as string;
                return !REASONING_PART_TYPES.includes(partType as any);
            });
        }

        return filtered;
    });
}

/**
 * Extracts plain text content from a UIMessage.
 *
 * Useful for creating summaries, triggering ingestion, or other
 * operations that need just the text content.
 *
 * @param msg - UIMessage to extract text from
 * @returns Concatenated text from all text parts
 */
export function extractTextFromMessage(msg: UIMessage): string {
    return (
        msg.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(" ") ?? ""
    );
}
