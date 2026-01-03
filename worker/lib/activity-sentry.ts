/**
 * Activity Sentry Integration
 *
 * Utilities for capturing activity errors in Sentry with rich context.
 * Activities throw errors that Temporal catches and wraps in ActivityFailure,
 * which loses the original context. We capture errors here BEFORE Temporal wraps them.
 */

import * as Sentry from "@sentry/node";
import { Context } from "@temporalio/activity";
import { logger } from "../../lib/logger";

export interface ActivityContext {
    activityName: string;
    jobId?: string;
    runId?: string;
    connectionId?: number;
    userId?: string;
    streamId?: string;
    [key: string]: unknown;
}

/**
 * Capture an activity error in Sentry with full context.
 *
 * Call this in activity catch blocks BEFORE re-throwing.
 * This ensures Sentry sees the original error with rich context,
 * not the generic ActivityFailure that Temporal will wrap it in.
 */
export function captureActivityError(error: unknown, context: ActivityContext): void {
    const { activityName, ...extra } = context;

    // Get Temporal activity info if available
    let temporalContext: Record<string, unknown> = {};
    try {
        const activityInfo = Context.current().info;
        temporalContext = {
            workflowId: activityInfo.workflowExecution.workflowId,
            runId: activityInfo.workflowExecution.runId,
            activityId: activityInfo.activityId,
            activityType: activityInfo.activityType,
            attempt: activityInfo.attempt,
            taskQueue: activityInfo.taskQueue,
            isLocal: activityInfo.isLocal,
        };
    } catch {
        // Not in activity context (e.g., direct call in tests)
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;

    // Log with structured context
    logger.error(
        {
            error,
            activityName,
            ...extra,
            ...temporalContext,
        },
        `Activity failed: ${activityName}`
    );

    // Build tags object - TypeScript doesn't like conditional spreads with unknown types
    const tags: Record<string, string> = {
        component: "temporal-activity",
        activity: activityName,
    };
    if (errorCode) {
        tags.errorCode = errorCode;
    }
    if (typeof temporalContext.attempt === "number") {
        tags.attempt = String(temporalContext.attempt);
    }

    // Capture in Sentry with rich context
    Sentry.captureException(error, {
        tags,
        extra: {
            ...extra,
            temporal: temporalContext,
            errorMessage,
        },
        fingerprint: ["temporal-activity", activityName, errorMessage],
    });
}

/**
 * Wrap an activity function with automatic Sentry error capture.
 *
 * Usage:
 * ```ts
 * export const myActivity = withActivitySentry(
 *   "myActivity",
 *   async (input: MyInput) => {
 *     // activity implementation
 *   }
 * );
 * ```
 */
export function withActivitySentry<TArgs extends unknown[], TReturn>(
    activityName: string,
    fn: (...args: TArgs) => Promise<TReturn>,
    getContext?: (...args: TArgs) => Partial<ActivityContext>
): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
        try {
            return await fn(...args);
        } catch (error) {
            const extraContext = getContext ? getContext(...args) : {};
            captureActivityError(error, {
                activityName,
                ...extraContext,
            });
            throw error; // Re-throw so Temporal can handle retry/failure
        }
    };
}

/**
 * Create a Sentry span for an activity execution.
 * Use this for high-value activities where you want tracing, not just error capture.
 */
export async function withActivitySpan<T>(
    activityName: string,
    context: Partial<ActivityContext>,
    fn: () => Promise<T>
): Promise<T> {
    return await Sentry.startSpan(
        {
            op: "temporal.activity",
            name: activityName,
        },
        async (span) => {
            // Add context as span attributes
            for (const [key, value] of Object.entries(context)) {
                if (value !== undefined) {
                    span.setAttribute(key, String(value));
                }
            }

            try {
                const result = await fn();
                span.setStatus({ code: 1, message: "ok" });
                return result;
            } catch (error) {
                span.setStatus({ code: 2, message: "error" });
                captureActivityError(error, { activityName, ...context });
                throw error;
            }
        }
    );
}
