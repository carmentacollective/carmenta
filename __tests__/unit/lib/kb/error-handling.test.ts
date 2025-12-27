/**
 * KB Error Handling Tests
 *
 * Tests for user-friendly error messages when KB operations fail.
 * Documents the "Load failed" bug from the service worker.
 *
 * Philosophy: Be honest about what happened. Don't say "try again" when
 * retrying won't work. If it's our bug, own it. If it's transient, say so.
 */

import { describe, it, expect } from "vitest";
import { formatSaveError } from "@/lib/kb/error-handling";

describe("formatSaveError", () => {
    describe("network errors - user can fix, retry is honest", () => {
        it("converts 'Load failed' to friendly message", () => {
            // This is the exact error from the bug report
            const error = new TypeError("Load failed");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Connection dropped. Check your network and try again?"
            );
            expect(result).not.toContain("Load failed");
            expect(result).not.toContain("TypeError");
        });

        it("converts 'Failed to fetch' to friendly message", () => {
            const error = new TypeError("Failed to fetch");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Connection dropped. Check your network and try again?"
            );
        });

        it("converts NetworkError to friendly message", () => {
            const error = new Error("NetworkError when attempting to fetch resource");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Connection dropped. Check your network and try again?"
            );
        });
    });

    describe("timeout errors - transient, retry is honest", () => {
        it("converts timeout errors to friendly message", () => {
            const error = new Error("Request timeout after 30000ms");

            const result = formatSaveError(error);

            expect(result).toBe("That request timed out. Try again?");
        });
    });

    describe("server errors - our bug, no dishonest retry suggestion", () => {
        it("converts 500 errors to honest message with robot acknowledgment", () => {
            const error = new Error("500 Internal Server Error");

            const result = formatSaveError(error);

            expect(result).toBe(
                "Something broke on our end. The robots have been notified. 🤖"
            );
            // Should NOT suggest retry for our bugs
            expect(result).not.toContain("try again");
        });
    });

    describe("auth errors - specific action needed, not retry", () => {
        it("converts 401 to session expired message with clear action", () => {
            const error = new Error("401 Unauthorized");

            const result = formatSaveError(error);

            expect(result).toBe("Session expired. Refresh the page to continue.");
            // Should NOT use "Your" language
            expect(result).not.toContain("Your");
        });
    });

    describe("generic errors - our bug, own it", () => {
        it("converts TypeError to honest message with robot acknowledgment", () => {
            const error = new TypeError("Cannot read property 'x' of undefined");

            const result = formatSaveError(error);

            expect(result).toBe(
                "We couldn't save those changes. The robots have been alerted. 🤖"
            );
        });

        it("converts JSON-looking errors to honest message with robot acknowledgment", () => {
            const error = new Error('{"code":"ERR_FAILED","details":{}}');

            const result = formatSaveError(error);

            expect(result).toBe(
                "We couldn't save those changes. The robots have been alerted. 🤖"
            );
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

        it("handles empty/null values with honest message", () => {
            const result = formatSaveError(null);

            expect(result).toBe(
                "We couldn't save those changes. The robots have been alerted. 🤖"
            );
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
            // Network errors ARE the user's to fix, so retry is honest here
            expect(displayedMessage).toBe(
                "Connection dropped. Check your network and try again?"
            );

            // Should never show these to users
            expect(displayedMessage).not.toContain("TypeError");
            expect(displayedMessage).not.toContain("Load failed");
            expect(displayedMessage).not.toContain("FetchEvent");
            expect(displayedMessage).not.toContain("respondWith");
        });
    });
});
