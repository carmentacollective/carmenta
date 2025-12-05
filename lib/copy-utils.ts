import { logger } from "@/lib/client-logger";

/**
 * Copy text to clipboard with error handling and structured logging
 *
 * Returns boolean to indicate success/failure without throwing.
 * Logs all operations (successful and failed) for observability.
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
