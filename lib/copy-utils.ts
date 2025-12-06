import { marked } from "marked";
import { logger } from "@/lib/client-logger";

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
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to copy to clipboard"
        );
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
    try {
        // Convert markdown to HTML
        const html = await marked(markdown);

        // Create clipboard item with multiple formats
        const item = new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([markdown], { type: "text/plain" }),
        });

        // Write both formats to clipboard
        await navigator.clipboard.write([item]);

        logger.info(
            { markdownLength: markdown.length, htmlLength: html.length },
            "Markdown copied with multiple formats"
        );
        return true;
    } catch (error) {
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to copy markdown with formats"
        );
        return false;
    }
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
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to copy markdown"
        );
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
        // Convert markdown to HTML first
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
        logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Failed to copy plain text"
        );
        return false;
    }
}
