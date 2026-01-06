/**
 * Carmenta Assistant Utilities
 *
 * Shared utilities for Carmenta components.
 */

/**
 * Extract text content from AI SDK message parts
 *
 * Messages from useChat contain parts array with different types.
 * This extracts and joins all text parts into a single string.
 */
export function getMessageText(message: {
    parts?: Array<{ type?: string; text?: string }>;
}): string {
    return (
        message.parts
            ?.filter(
                (part): part is { type: "text"; text: string } =>
                    typeof part === "object" && "type" in part && part.type === "text"
            )
            .map((part) => part.text)
            .join("") || ""
    );
}
