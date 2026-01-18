/**
 * GitHub App Errors Tests
 *
 * Tests for custom error types and error classification.
 */

import { describe, it, expect } from "vitest";
import {
    GitHubAppError,
    GitHubAuthError,
    GitHubAPIError,
    GitHubRateLimitError,
    isRetryableError,
} from "@/lib/github-app/errors";

describe("GitHub App Errors", () => {
    describe("GitHubAppError", () => {
        it("creates error with all properties", () => {
            const error = new GitHubAppError("Test error", "API_ERROR", 500, true);

            expect(error.message).toBe("Test error");
            expect(error.code).toBe("API_ERROR");
            expect(error.statusCode).toBe(500);
            expect(error.retryable).toBe(true);
            expect(error.name).toBe("GitHubAppError");
        });

        it("defaults retryable to false", () => {
            const error = new GitHubAppError("Test error", "VALIDATION_ERROR");

            expect(error.retryable).toBe(false);
        });
    });

    describe("GitHubAuthError", () => {
        it("creates auth error with defaults", () => {
            const error = new GitHubAuthError();

            expect(error.message).toBe("GitHub App authentication failed");
            expect(error.code).toBe("AUTH_FAILED");
            expect(error.statusCode).toBe(401);
            expect(error.retryable).toBe(false);
            expect(error.name).toBe("GitHubAuthError");
        });

        it("accepts custom message", () => {
            const error = new GitHubAuthError("Custom auth error message");

            expect(error.message).toBe("Custom auth error message");
        });
    });

    describe("GitHubAPIError", () => {
        it("creates API error with status code", () => {
            const error = new GitHubAPIError("Server error", 503, true);

            expect(error.message).toBe("Server error");
            expect(error.code).toBe("API_ERROR");
            expect(error.statusCode).toBe(503);
            expect(error.retryable).toBe(true);
            expect(error.name).toBe("GitHubAPIError");
        });

        it("defaults retryable to false", () => {
            const error = new GitHubAPIError("Bad request", 400);

            expect(error.retryable).toBe(false);
        });
    });

    describe("GitHubRateLimitError", () => {
        it("creates rate limit error with defaults", () => {
            const error = new GitHubRateLimitError();

            expect(error.message).toBe("GitHub API rate limit exceeded");
            expect(error.code).toBe("RATE_LIMITED");
            expect(error.statusCode).toBe(403);
            expect(error.retryable).toBe(true);
            expect(error.name).toBe("GitHubRateLimitError");
        });

        it("accepts reset time", () => {
            const resetAt = new Date("2025-01-15T11:00:00Z");
            const error = new GitHubRateLimitError("Rate limited", resetAt);

            expect(error.resetAt).toEqual(resetAt);
        });
    });

    describe("isRetryableError", () => {
        describe("GitHubAppError instances", () => {
            it("returns true for retryable GitHubAppError", () => {
                const error = new GitHubAppError("Retryable", "API_ERROR", 500, true);
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns false for non-retryable GitHubAppError", () => {
                const error = new GitHubAppError(
                    "Not retryable",
                    "VALIDATION_ERROR",
                    400,
                    false
                );
                expect(isRetryableError(error)).toBe(false);
            });

            it("returns false for auth errors", () => {
                const error = new GitHubAuthError();
                expect(isRetryableError(error)).toBe(false);
            });

            it("returns true for rate limit errors", () => {
                const error = new GitHubRateLimitError();
                expect(isRetryableError(error)).toBe(true);
            });
        });

        describe("Network errors", () => {
            it("returns true for network error", () => {
                const error = new Error("network error: connection refused");
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns true for timeout error", () => {
                const error = new Error("Request timeout after 30000ms");
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns true for ECONNRESET error", () => {
                const error = new Error("ECONNRESET: Connection reset by peer");
                expect(isRetryableError(error)).toBe(true);
            });

            it("is case-insensitive for network keywords", () => {
                const error = new Error("NETWORK ERROR");
                expect(isRetryableError(error)).toBe(true);
            });
        });

        describe("HTTP status codes", () => {
            it("returns true for 500 status", () => {
                const error = { status: 500 };
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns true for 502 status", () => {
                const error = { status: 502 };
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns true for 503 status", () => {
                const error = { status: 503 };
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns true for 504 status", () => {
                const error = { status: 504 };
                expect(isRetryableError(error)).toBe(true);
            });

            it("returns false for 400 status", () => {
                const error = { status: 400 };
                expect(isRetryableError(error)).toBe(false);
            });

            it("returns false for 401 status", () => {
                const error = { status: 401 };
                expect(isRetryableError(error)).toBe(false);
            });

            it("returns false for 404 status", () => {
                const error = { status: 404 };
                expect(isRetryableError(error)).toBe(false);
            });
        });

        describe("Other error types", () => {
            it("returns false for regular Error", () => {
                const error = new Error("Something went wrong");
                expect(isRetryableError(error)).toBe(false);
            });

            it("returns false for null", () => {
                expect(isRetryableError(null)).toBe(false);
            });

            it("returns false for undefined", () => {
                expect(isRetryableError(undefined)).toBe(false);
            });

            it("returns false for string", () => {
                expect(isRetryableError("error")).toBe(false);
            });
        });
    });
});
