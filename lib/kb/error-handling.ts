/**
 * Error Handling Utilities for Knowledge Base
 *
 * User-friendly error message formatting for KB operations.
 * Handles cryptic errors from service workers and network failures.
 *
 * Philosophy: Be honest about what happened. Don't say "try again" when
 * retrying won't work. If it's our bug, own it. If it's transient, say so.
 */

/**
 * Parse network/save errors into user-friendly messages.
 * Handles the cryptic errors from service workers and network failures.
 */
export function formatSaveError(error: unknown): string {
    // Handle null/undefined/empty - likely our bug, don't suggest retry
    if (error === null || error === undefined) {
        return "We couldn't save those changes. The robots have been alerted. 🤖";
    }

    const message = error instanceof Error ? error.message : String(error);

    // Network errors from service worker or fetch - user can fix, retry is honest
    if (
        message.includes("Load failed") ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("network")
    ) {
        return "Connection dropped. Check your network and try again?";
    }

    // Timeout errors - transient, retry is honest
    if (message.includes("timeout") || message.includes("Timeout")) {
        return "That request timed out. Try again?";
    }

    // Server errors - our bug, don't lie about retry working
    if (message.includes("500") || message.includes("Internal Server Error")) {
        return "Something broke on our end. The robots have been notified. 🤖";
    }

    // Auth errors - specific action needed, not retry
    if (message.includes("401") || message.includes("Unauthorized")) {
        return "Session expired. Refresh the page to continue.";
    }

    // Generic fallback - likely our bug, own it
    // TypeError and other internal errors shouldn't be shown to users
    const isTypeError = error instanceof TypeError;
    if (message.includes("{") || isTypeError) {
        return "We couldn't save those changes. The robots have been alerted. 🤖";
    }

    // If the message is already user-friendly, use it
    return (
        message || "We couldn't save those changes. The robots have been alerted. 🤖"
    );
}
