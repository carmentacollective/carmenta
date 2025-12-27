/**
 * KB Error Handling Tests
 *
 * Tests for user-friendly error messages when KB operations fail.
 * Documents the "Load failed" bug from the service worker.
 */

import { describe, it, expect } from "vitest";

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

describe("formatSaveError", () => {
    describe("network errors", () => {
        it("converts 'Load failed' to friendly message", () => {
            // This is the exact error from the bug report
            const error = new TypeError("Load failed");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Connection lost. Please check your network and try again."
            );
            expect(result).not.toContain("Load failed");
            expect(result).not.toContain("TypeError");
        });

        it("converts 'Failed to fetch' to friendly message", () => {
            const error = new TypeError("Failed to fetch");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Connection lost. Please check your network and try again."
            );
        });

        it("converts NetworkError to friendly message", () => {
            const error = new Error("NetworkError when attempting to fetch resource");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Connection lost. Please check your network and try again."
            );
        });
    });

    describe("timeout errors", () => {
        it("converts timeout errors to friendly message", () => {
            const error = new Error("Request timeout after 30000ms");

            const result = formatSaveError(error);

            expect(result).toBe("Request timed out. Please try again.");
        });
    });

    describe("server errors", () => {
        it("converts 500 errors to friendly message", () => {
            const error = new Error("500 Internal Server Error");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Something went wrong on our end. Please try again in a moment."
            );
        });
    });

    describe("auth errors", () => {
        it("converts 401 to session expired message", () => {
            const error = new Error("401 Unauthorized");

            const result = formatSaveError(error);

            expect(result).toBe("Your session has expired. Please refresh the page.");
        });
    });

    describe("generic errors", () => {
        it("converts TypeError to generic friendly message", () => {
            const error = new TypeError("Cannot read property 'x' of undefined");

            const result = formatSaveError(error);

            expect(result).toBe("We couldn't save your changes. Please try again.");
        });

        it("converts JSON-looking errors to generic friendly message", () => {
            const error = new Error('{"code":"ERR_FAILED","details":{}}');

            const result = formatSaveError(error);

            expect(result).toBe("We couldn't save your changes. Please try again.");
        });

        it("passes through already-friendly messages", () => {
            const error = new Error("Document not found");

            const result = formatSaveError(error);

            expect(result).toBe("Document not found");
        });

        it("handles non-Error values", () => {
            const result = formatSaveError("some string error");

            expect(result).toBe("some string error");
        });

        it("handles empty/null values", () => {
            const result = formatSaveError(null);

            expect(result).toBe("We couldn't save your changes. Please try again.");
        });
    });

    describe("bug report scenario: service worker + mobile network drop", () => {
        it("user sees friendly message instead of cryptic 'Load failed'", () => {
            // Simulate the exact error chain from the bug:
            // 1. User pastes ChatGPT text
            // 2. Save triggers
            // 3. Service worker intercepts
            // 4. Network drops on mobile
            // 5. Service worker throws TypeError: Load failed

            const serviceWorkerError = new TypeError("Load failed");

            const displayedMessage = formatSaveError(serviceWorkerError);

            // User should see actionable message, not technical garbage
            expect(displayedMessage).toBe(
                "Connection lost. Please check your network and try again."
            );

            // Should never show these to users
            expect(displayedMessage).not.toContain("TypeError");
            expect(displayedMessage).not.toContain("Load failed");
            expect(displayedMessage).not.toContain("FetchEvent");
            expect(displayedMessage).not.toContain("respondWith");
        });
    });
});
