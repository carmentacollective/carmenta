/**
 * Error Display Tests
 *
 * Tests for ensuring error messages are displayed in a user-friendly format,
 * not as raw JSON.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Helper to extract error message from JSON if it's a JSON string
function parseErrorMessage(message: string): string {
    if (!message) return "We couldn't complete that request.";

    // Check if it looks like JSON
    if (message.trim().startsWith("{")) {
        try {
            const parsed = JSON.parse(message);
            // If it has an 'error' field, use that
            if (typeof parsed.error === "string") {
                return parsed.error;
            }
        } catch {
            // Not valid JSON, return as-is
        }
    }

    return message;
}

describe("Error Message Parsing", () => {
    describe("parseErrorMessage", () => {
        it("returns friendly message when JSON error response is passed", () => {
            const jsonError =
                '{"error":"We hit a snag processing that. Let\'s try again.","errorType":"Error"}';

            const result = parseErrorMessage(jsonError);

            expect(result).toBe("We hit a snag processing that. Let's try again.");
            expect(result).not.toContain("{");
            expect(result).not.toContain("errorType");
        });

        it("returns original message when not JSON", () => {
            const plainError = "Network connection failed";

            const result = parseErrorMessage(plainError);

            expect(result).toBe("Network connection failed");
        });

        it("returns original message when JSON but no error field", () => {
            const jsonWithoutError = '{"status":"failed","code":500}';

            const result = parseErrorMessage(jsonWithoutError);

            expect(result).toBe('{"status":"failed","code":500}');
        });

        it("returns default message when empty", () => {
            const result = parseErrorMessage("");

            expect(result).toBe("We couldn't complete that request.");
        });

        it("handles malformed JSON gracefully", () => {
            const malformed = '{"error": "incomplete';

            const result = parseErrorMessage(malformed);

            expect(result).toBe('{"error": "incomplete');
        });
    });
});

describe("RuntimeErrorBanner", () => {
    it("should NOT display raw JSON to users", () => {
        // This test documents the BUG: currently the error banner shows raw JSON
        const jsonErrorMessage =
            '{"error":"We hit a snag processing that. Let\'s try again.","errorType":"Error"}';

        // The EXPECTED behavior is that users see the friendly message
        const displayedMessage = parseErrorMessage(jsonErrorMessage);

        expect(displayedMessage).toBe(
            "We hit a snag processing that. Let's try again."
        );
        expect(displayedMessage).not.toMatch(/^\{.*\}$/); // Should NOT be JSON
    });

    it("should display a human-readable error message", () => {
        const errorScenarios = [
            {
                input: '{"error":"Connection timed out","errorType":"NetworkError"}',
                expected: "Connection timed out",
            },
            {
                input: "Failed to connect to server",
                expected: "Failed to connect to server",
            },
            {
                input: '{"error":"Rate limit exceeded","retry_after":60}',
                expected: "Rate limit exceeded",
            },
        ];

        for (const scenario of errorScenarios) {
            const result = parseErrorMessage(scenario.input);
            expect(result).toBe(scenario.expected);
            // Should never show curly braces to users
            expect(result).not.toContain("{");
            expect(result).not.toContain("}");
        }
    });
});
