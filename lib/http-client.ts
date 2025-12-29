/**
 * HTTP Client - Configured ky Instance with Retry and Observability
 *
 * ## Retry Strategy
 * Retries on transient failures (408, 429, 5xx) with exponential backoff capped at 3s.
 * 3 retries max = 4 total attempts. Covers Nango's occasional 503s and rate limits.
 *
 * ## Timeout: 30 Seconds
 * Conservative timeout for external APIs. Some services (Notion bulk exports, Gmail
 * large mailboxes) can be slow. Better to wait than fail prematurely.
 *
 * ## Sentry Integration
 * Every request creates a span with method, URL, status. Retries add breadcrumbs.
 * Failed requests surface in Sentry with full context for debugging.
 *
 * ## safeJsonParse Helper
 * APIs sometimes return HTML error pages instead of JSON (especially on 5xx).
 * This helper captures response body for Sentry when JSON parsing fails.
 */

import * as Sentry from "@sentry/nextjs";
import ky from "ky";
import { logger } from "@/lib/logger";

const HTTP_TIMEOUT_MS = 30_000;
const HTTP_RETRY_BACKOFF_LIMIT_MS = 3_000;

export const httpClient = ky.create({
    timeout: HTTP_TIMEOUT_MS,
    retry: {
        limit: 3,
        methods: ["get", "post", "put", "patch", "delete"],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        backoffLimit: HTTP_RETRY_BACKOFF_LIMIT_MS,
    },
    hooks: {
        beforeRequest: [
            async (request) => {
                const url = new URL(request.url);
                const spanName = `${request.method} ${url.pathname}`;

                // @ts-expect-error - Custom property to track span across hooks
                request._sentrySpan = Sentry.startInactiveSpan({
                    op: "http.client",
                    name: spanName,
                    attributes: {
                        "http.method": request.method,
                        "http.url": request.url,
                        "http.host": url.host,
                        "http.path": url.pathname,
                    },
                });
            },
        ],
        beforeRetry: [
            async ({ request, error, retryCount }) => {
                logger.warn(
                    {
                        url: request.url,
                        method: request.method,
                        retryCount,
                        error: error.message,
                    },
                    "HTTP Retry"
                );

                Sentry.addBreadcrumb({
                    category: "http.retry",
                    message: `Retrying ${request.method} ${request.url}`,
                    level: "warning",
                    data: {
                        url: request.url,
                        method: request.method,
                        retryCount,
                        error: error.message,
                    },
                });

                // @ts-expect-error - Accessing custom property
                const span = request._sentrySpan;
                if (span) {
                    span.setAttribute("http.retry_count", retryCount);
                }
            },
        ],
        afterResponse: [
            async (request, _options, response) => {
                // @ts-expect-error - Accessing custom property
                const span = request._sentrySpan;

                if (span) {
                    span.setAttribute("http.status_code", response.status);
                    span.setAttribute("http.status_text", response.statusText);

                    if (response.ok) {
                        span.setStatus({ code: 1, message: "OK" });
                    } else {
                        span.setStatus({
                            code: 2,
                            message: `HTTP ${response.status}`,
                        });
                    }

                    span.end();
                }

                if (!response.ok) {
                    logger.error(
                        {
                            url: request.url,
                            method: request.method,
                            status: response.status,
                            statusText: response.statusText,
                        },
                        "HTTP Error"
                    );

                    Sentry.addBreadcrumb({
                        category: "http.error",
                        message: `HTTP ${response.status}: ${request.method} ${request.url}`,
                        level: "error",
                        data: {
                            url: request.url,
                            method: request.method,
                            status: response.status,
                            statusText: response.statusText,
                        },
                    });
                }

                return response;
            },
        ],
        beforeError: [
            async (error) => {
                // End span for requests that fail before reaching afterResponse
                // (network timeouts, DNS failures, connection refused)
                const request = error.request;

                // Only log for network errors (no response received)
                // HTTP errors (4xx/5xx) are already logged in afterResponse
                if (!error.response) {
                    const url = request?.url;
                    const method = request?.method;

                    logger.error(
                        {
                            url,
                            method,
                            error: error.message,
                            errorName: error.name,
                        },
                        "HTTP Network Error"
                    );

                    Sentry.addBreadcrumb({
                        category: "http.network_error",
                        message: `Network error: ${method} ${url}`,
                        level: "error",
                        data: {
                            url,
                            method,
                            error: error.message,
                            errorName: error.name,
                        },
                    });

                    // @ts-expect-error - Accessing custom property
                    const span = request?._sentrySpan;
                    if (span) {
                        span.setStatus({ code: 2, message: error.message });
                        span.end();
                    }
                }

                return error;
            },
        ],
    },
});

/**
 * Clone before consuming - allows reading body as text if JSON fails
 */
export async function safeJsonParse<T>(
    response: Response,
    context?: { url?: string; method?: string; service?: string }
): Promise<T> {
    const clonedResponse = response.clone();

    try {
        return await response.json();
    } catch (error) {
        const responseText = await clonedResponse
            .text()
            .catch(() => "<failed to read response text>");

        logger.error(
            {
                service: context?.service || "unknown",
                url: context?.url || response.url,
                method: context?.method || "unknown",
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get("content-type"),
                responsePreview: responseText.slice(0, 500),
                error: error instanceof Error ? error.message : String(error),
            },
            "JSON Parse Error"
        );

        Sentry.addBreadcrumb({
            category: "http.json_parse_error",
            message: `Failed to parse JSON from ${context?.service || "API"}`,
            level: "error",
            data: {
                url: context?.url || response.url,
                method: context?.method,
                status: response.status,
                contentType: response.headers.get("content-type"),
                responsePreview: responseText.slice(0, 200),
            },
        });

        Sentry.captureException(error, {
            tags: {
                error_type: "json_parse_error",
                service: context?.service,
            },
            extra: {
                url: context?.url || response.url,
                method: context?.method,
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get("content-type"),
                responseText: responseText.slice(0, 1000),
            },
        });

        throw error;
    }
}

/**
 * Create a service-specific HTTP client with base URL and optional auth
 */
export function createServiceClient(baseUrl: string, authToken?: string) {
    return httpClient.extend({
        prefixUrl: baseUrl,
        hooks: {
            beforeRequest: [
                (request) => {
                    if (authToken) {
                        request.headers.set("Authorization", `Bearer ${authToken}`);
                    }
                },
            ],
        },
    });
}
