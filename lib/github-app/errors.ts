/**
 * Custom error types for GitHub App operations
 *
 * Following the pattern from @/lib/errors - typed errors that bubble up
 * to boundaries rather than being silently caught.
 */

export class GitHubAppError extends Error {
    constructor(
        message: string,
        public readonly code:
            | "AUTH_FAILED"
            | "API_ERROR"
            | "RATE_LIMITED"
            | "NOT_FOUND"
            | "VALIDATION_ERROR",
        public readonly statusCode?: number,
        public readonly retryable: boolean = false
    ) {
        super(message);
        this.name = "GitHubAppError";
    }
}

export class GitHubAuthError extends GitHubAppError {
    constructor(message: string = "GitHub App authentication failed") {
        super(message, "AUTH_FAILED", 401, false);
        this.name = "GitHubAuthError";
    }
}

export class GitHubAPIError extends GitHubAppError {
    constructor(message: string, statusCode?: number, retryable: boolean = false) {
        super(message, "API_ERROR", statusCode, retryable);
        this.name = "GitHubAPIError";
    }
}

export class GitHubRateLimitError extends GitHubAppError {
    constructor(
        message: string = "GitHub API rate limit exceeded",
        public readonly resetAt?: Date
    ) {
        super(message, "RATE_LIMITED", 403, true);
        this.name = "GitHubRateLimitError";
    }
}

/**
 * Check if an error is retryable (transient failures)
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof GitHubAppError) {
        return error.retryable;
    }

    // Network errors are retryable
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
            message.includes("network") ||
            message.includes("timeout") ||
            message.includes("econnreset")
        ) {
            return true;
        }
    }

    // HTTP 5xx errors are retryable
    if (typeof error === "object" && error !== null && "status" in error) {
        const status = (error as { status: number }).status;
        return status >= 500 && status < 600;
    }

    return false;
}
