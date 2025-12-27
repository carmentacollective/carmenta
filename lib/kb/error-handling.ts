/**
 * Error Handling Utilities for Knowledge Base
 *
 * User-friendly error message formatting for KB operations.
 * Handles cryptic errors from service workers and network failures.
 */

/**
 * Parse network/save errors into user-friendly messages.
 * Handles the cryptic errors from service workers and network failures.
 */
export function formatSaveError(error: unknown): string {
    // Handle null/undefined/empty
    if (error === null || error === undefined) {
        return "We couldn't save your changes. Please try again.";
    }

    const message = error instanceof Error ? error.message : String(error);

    // Network errors from service worker or fetch
    if (
        message.includes("Load failed") ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("network")
    ) {
        return "Connection lost. Please check your network and try again.";
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("Timeout")) {
        return "Request timed out. Please try again.";
    }

    // Server errors
    if (message.includes("500") || message.includes("Internal Server Error")) {
        return "Something went wrong on our end. Please try again in a moment.";
    }

    // Auth errors
    if (message.includes("401") || message.includes("Unauthorized")) {
        return "Your session has expired. Please refresh the page.";
    }

    // Generic fallback - but still clean
    // TypeError and other internal errors shouldn't be shown to users
    const isTypeError = error instanceof TypeError;
    if (message.includes("{") || isTypeError) {
        return "We couldn't save your changes. Please try again.";
    }

    // If the message is already user-friendly, use it
    return message || "We couldn't save your changes. Please try again.";
}
