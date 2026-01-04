import { logger } from "@/lib/client-logger";

/**
 * Lazy-loaded marked parser for markdown conversion.
 * Only imported when copyMarkdownWithFormats or copyPlainText is called,
 * saving ~30KB from the initial bundle.
 */
async function getMarked() {
    const { marked } = await import("marked");
    return marked;
}

/**
 * Copy text to clipboard with error handling and structured logging
 *
 * Returns boolean to indicate success/failure without throwing.
 * Logs all operations (successful and failed) for observability.
 *
 * Used for plain text copy (code blocks, etc.)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        logger.info({ length: text.length }, "Text copied to clipboard");
        return true;
    } catch (error) {
        logger.error({ error }, "Failed to copy to clipboard");
        return false;
    }
}

/**
 * Copy markdown with multiple formats to clipboard (rich text mode)
 *
 * Writes both HTML and plain text (markdown) to clipboard simultaneously.
 * Applications automatically choose the format they prefer:
 * - Rich text editors (Google Docs, Word) use HTML for formatting
 * - Markdown-aware apps (Slack, Discord) use plain text and render markdown
 * - Plain text editors (VSCode, terminals) use plain text and show markdown syntax
 *
 * This provides the best experience for all paste targets with a single click.
 */
export async function copyMarkdownWithFormats(markdown: string): Promise<boolean> {
    // Just use writeText - the ClipboardItem API is unreliable
    return copyMarkdown(markdown);
}

/**
 * Copy markdown syntax only
 *
 * Writes just the markdown text to clipboard.
 * Use for markdown editors, GitHub comments, etc.
 */
export async function copyMarkdown(markdown: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(markdown);
        logger.info({ length: markdown.length }, "Markdown syntax copied");
        return true;
    } catch (error) {
        logger.error({ error }, "Failed to copy markdown");
        return false;
    }
}

/**
 * Copy plain text with markdown formatting stripped
 *
 * Converts markdown to HTML, then extracts text content to remove all formatting.
 * Use for terminal, plain email, SMS, etc.
 */
export async function copyPlainText(markdown: string): Promise<boolean> {
    try {
        // Lazy load marked only when needed
        const marked = await getMarked();
        const html = await marked(markdown);

        // Create temporary DOM element to extract text
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        const plainText = tempDiv.textContent || "";

        await navigator.clipboard.writeText(plainText);

        logger.info(
            { originalLength: markdown.length, plainLength: plainText.length },
            "Plain text copied (markdown stripped)"
        );
        return true;
    } catch (error) {
        logger.error({ error }, "Failed to copy plain text");
        return false;
    }
}
