/**
 * Message transformation utilities for AI SDK.
 *
 * Handles conversion and filtering of messages for multi-turn conversations.
 */

import type { UIMessage } from "ai";

/**
 * Extended message type to handle both parts and content arrays.
 * Some messages have parts[], others have content[] - both need filtering.
 */
type ExtendedUIMessage = UIMessage & {
    content?: Array<{ type: string; [key: string]: unknown }>;
};

/**
 * Part types that should be filtered from multi-turn conversations.
 *
 * Anthropic's API rejects requests that include thinking/reasoning blocks
 * from previous turns. These must be stripped before sending to any provider.
 */
const REASONING_PART_TYPES = ["reasoning", "thinking", "redacted_thinking"] as const;

/**
 * Check if a part type is a reasoning/thinking block
 */
function isReasoningPart(type: string): boolean {
    return (REASONING_PART_TYPES as readonly string[]).includes(type);
}

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
        const extendedMsg = msg as ExtendedUIMessage;
        const filtered: Partial<ExtendedUIMessage> = { ...extendedMsg };

        // Filter parts array if it exists
        if (extendedMsg.parts) {
            const filteredParts = extendedMsg.parts.filter(
                (part) => !isReasoningPart(part.type as string)
            );
            // Only set if non-empty to avoid empty array issues
            filtered.parts = filteredParts.length > 0 ? filteredParts : undefined;
        }

        // Filter content array if it exists and is an array
        if (Array.isArray(extendedMsg.content)) {
            const filteredContent = extendedMsg.content.filter(
                (part) => !isReasoningPart(part.type)
            );
            // Only set if non-empty to avoid empty array issues
            filtered.content = filteredContent.length > 0 ? filteredContent : undefined;
        }

        return filtered as UIMessage;
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

/**
 * Filters large binary data (base64 images) from tool results.
 *
 * Image generation tools return base64 data that must be displayed to the user
 * but should NOT be included in subsequent LLM calls. This data can be 500KB+
 * and causes context_length_exceeded errors.
 *
 * @param messages - Array of UIMessages from the conversation
 * @returns Messages with base64 image data replaced with placeholders
 */
export function filterLargeToolOutputs(messages: UIMessage[]): UIMessage[] {
    return messages.map((msg) => {
        if (!msg.parts) return msg;

        const filteredParts = msg.parts.map((part) => {
            // Handle tool result parts with image output
            if (
                part.type?.startsWith("tool-") &&
                "output" in part &&
                typeof part.output === "object" &&
                part.output !== null
            ) {
                const output = part.output as Record<string, unknown>;

                // Check for base64 image data in common patterns
                if (typeof output.base64 === "string" && output.base64.length > 1000) {
                    return {
                        ...part,
                        output: {
                            ...output,
                            base64: "[IMAGE_DATA_OMITTED]",
                            _originalSize: output.base64.length,
                        },
                    };
                }

                // Check for image data in nested result structure
                if (
                    typeof output.image === "object" &&
                    output.image !== null &&
                    typeof (output.image as Record<string, unknown>).base64 === "string"
                ) {
                    const imageData = output.image as Record<string, unknown>;
                    const base64 = imageData.base64 as string;
                    if (base64.length > 1000) {
                        return {
                            ...part,
                            output: {
                                ...output,
                                image: {
                                    ...imageData,
                                    base64: "[IMAGE_DATA_OMITTED]",
                                    _originalSize: base64.length,
                                },
                            },
                        };
                    }
                }

                // Check for SubagentResult structure: { data: { images: [{ base64, ... }] } }
                if (
                    typeof output.data === "object" &&
                    output.data !== null &&
                    Array.isArray((output.data as Record<string, unknown>).images)
                ) {
                    const data = output.data as Record<string, unknown>;
                    const images = data.images as Array<Record<string, unknown>>;
                    const hasLargeImages = images.some(
                        (img) =>
                            typeof img.base64 === "string" && img.base64.length > 1000
                    );

                    if (hasLargeImages) {
                        return {
                            ...part,
                            output: {
                                ...output,
                                data: {
                                    ...data,
                                    images: images.map((img) => ({
                                        ...img,
                                        base64:
                                            typeof img.base64 === "string" &&
                                            img.base64.length > 1000
                                                ? "[IMAGE_DATA_OMITTED]"
                                                : img.base64,
                                        _originalSize:
                                            typeof img.base64 === "string"
                                                ? img.base64.length
                                                : undefined,
                                    })),
                                },
                            },
                        };
                    }
                }
            }

            return part;
        });

        return { ...msg, parts: filteredParts };
    });
}
