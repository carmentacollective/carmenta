/**
 * Standardized API response utilities.
 *
 * Provides consistent JSON response builders for API routes.
 * Handles common patterns: errors, validation failures, auth failures.
 */

import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";

/**
 * Standard JSON response headers.
 */
const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Context for error responses - used for logging and Sentry.
 */
export interface ErrorContext {
    /** User email for logging */
    userEmail?: string | null;
    /** Connection/resource ID */
    resourceId?: number | string | null;
    /** Model or service being used */
    model?: string;
    /** Route name for Sentry tags */
    route?: string;
    /** Additional context for Sentry extra */
    extra?: Record<string, unknown>;
}

/**
 * Returns a 401 Unauthorized response.
 */
export function unauthorizedResponse(message = "Sign in to continue"): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: 401,
        headers: JSON_HEADERS,
    });
}

/**
 * Returns a 400 Bad Request response for validation errors.
 */
export function validationErrorResponse(
    details: unknown,
    message = "That request didn't quite make sense. The robots are looking into it. 🤖"
): Response {
    return new Response(JSON.stringify({ error: message, details }), {
        status: 400,
        headers: JSON_HEADERS,
    });
}

/**
 * Returns a 404 Not Found response.
 */
export function notFoundResponse(resource = "Resource"): Response {
    return new Response(JSON.stringify({ error: `${resource} not found` }), {
        status: 404,
        headers: JSON_HEADERS,
    });
}

/**
 * Returns a 500 Internal Server Error response.
 * Logs the error and reports to Sentry.
 *
 * @param error - The caught error
 * @param context - Additional context for logging and Sentry
 */
export function serverErrorResponse(
    error: unknown,
    context: ErrorContext = {}
): Response {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "Unknown";
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log detailed error for debugging
    logger.error(
        {
            error: errorMessage,
            errorName,
            errorStack,
            userEmail: context.userEmail,
            resourceId: context.resourceId,
            model: context.model,
        },
        `${context.route ?? "API"} request failed`
    );

    // Report to Sentry with context
    Sentry.captureException(error, {
        tags: {
            component: "api",
            route: context.route ?? "unknown",
            errorName,
        },
        extra: {
            userEmail: context.userEmail,
            resourceId: context.resourceId,
            model: context.model,
            errorMessage,
            ...context.extra,
        },
    });

    // Return user-safe error response
    return new Response(
        JSON.stringify({
            error: "Something went sideways. The robots are on it. 🤖",
            errorType: errorName,
        }),
        {
            status: 500,
            headers: JSON_HEADERS,
        }
    );
}
