import { logger } from "@/lib/client-logger";

/**
 * Copy text to clipboard with error handling and logging
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        logger.info({ length: text.length }, "Text copied to clipboard");
        return true;
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to copy to clipboard"
        );
        return false;
    }
}

/**
 * Extract clean markdown content for copying
 * Preserves formatting but removes UI-specific artifacts
 */
export function extractMarkdown(content: string): string {
    return content.trim();
}

/**
 * Extract code from a code block, removing language identifier and backticks
 */
export function extractCodeBlock(content: string): string | null {
    // Match code blocks with optional language identifier
    const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);

    if (match && match[1]) {
        return match[1].trim();
    }

    // If no code block found, return null
    return null;
}

/**
 * Extract inline code, removing backticks
 */
export function extractInlineCode(content: string): string {
    // Remove single backticks
    return content.replace(/`(.+?)`/g, "$1");
}
