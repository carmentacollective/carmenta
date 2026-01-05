/**
 * DCOS Utility Functions
 *
 * Infrastructure utilities for subagent orchestration including
 * timeout handling, step exhaustion detection, and Sentry trace propagation.
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { errorResult, type SubagentResult, type SubagentContext } from "./types";

/**
 * Default timeout for subagent invocations (60 seconds)
 *
 * Most subagents should complete well within this. Researcher may need longer
 * for deep web fetches - callers can override via context.timeoutMs.
 */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Error thrown when a subagent exceeds its timeout
 */
export class SubagentTimeoutError extends Error {
    constructor(
        public readonly subagentId: string,
        public readonly timeoutMs: number
    ) {
        super(`Subagent '${subagentId}' timed out after ${timeoutMs}ms`);
        this.name = "SubagentTimeoutError";
    }
}

/**
 * Invoke a subagent with timeout protection and proper abort signaling
 *
 * Based on robustness review recommendation to prevent blocking:
 * - Creates AbortController to signal cancellation to subagent
 * - Aborts the controller on timeout (so fetch/AI SDK calls are cancelled)
 * - Returns structured error on timeout
 * - Logs warning with Sentry breadcrumb
 *
 * @param subagentId - Identifier for logging
 * @param fn - The async operation to execute (receives context with abortSignal)
 * @param context - Subagent context including optional timeout override
 */
export async function invokeWithTimeout<T>(
    subagentId: string,
    fn: (contextWithSignal: SubagentContext) => Promise<SubagentResult<T>>,
    context: SubagentContext
): Promise<SubagentResult<T>> {
    const timeoutMs = context.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const subagentLogger = logger.child({ subagentId, timeoutMs });

    // Create AbortController to signal cancellation
    const abortController = new AbortController();
    const contextWithSignal: SubagentContext = {
        ...context,
        abortSignal: abortController.signal,
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    const timeoutPromise = new Promise<SubagentResult<T>>((resolve) => {
        timeoutId = setTimeout(() => {
            timedOut = true;

            // Abort the operation - this signals fetch/AI SDK calls to cancel
            abortController.abort(new SubagentTimeoutError(subagentId, timeoutMs));

            subagentLogger.warn(
                { abandoned: true },
                `Subagent timed out after ${timeoutMs}ms - operation aborted`
            );

            Sentry.addBreadcrumb({
                category: "subagent.timeout",
                message: `${subagentId} timed out and aborted`,
                level: "warning",
                data: { subagentId, timeoutMs },
            });

            resolve(
                errorResult<T>(
                    "TIMEOUT",
                    `Subagent '${subagentId}' timed out after ${timeoutMs}ms`
                )
            );
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([fn(contextWithSignal), timeoutPromise]);
        return result;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

/**
 * Check if a subagent exhausted its step limit without explicit completion
 *
 * Based on robustness review: Silent step exhaustion is a failure mode where
 * the subagent returns partial results without signaling it gave up.
 *
 * @param stepsUsed - Number of steps the agent consumed
 * @param maxSteps - Maximum steps allowed
 * @param completedExplicitly - Whether the agent called its completion tool
 */
export function detectStepExhaustion(
    stepsUsed: number,
    maxSteps: number,
    completedExplicitly: boolean
): { exhausted: boolean; message?: string } {
    if (stepsUsed >= maxSteps && !completedExplicitly) {
        return {
            exhausted: true,
            message: `Agent exhausted ${maxSteps} steps without completing. Results may be partial.`,
        };
    }
    return { exhausted: false };
}

/**
 * Get Sentry trace context for cross-agent correlation
 *
 * Propagates trace ID from parent span so subagent errors
 * link back to the DCOS conversation trace in Sentry.
 */
export function getSentryTraceContext(): { traceId?: string; spanId?: string } {
    const activeSpan = Sentry.getActiveSpan();
    if (!activeSpan) return {};

    const spanContext = activeSpan.spanContext();
    return {
        traceId: spanContext?.traceId,
        spanId: spanContext?.spanId,
    };
}

/**
 * Create a Sentry span for subagent invocation
 *
 * Wraps subagent execution in a span for performance monitoring
 * and trace correlation.
 */
export async function withSubagentSpan<T>(
    subagentId: string,
    action: string,
    fn: () => Promise<SubagentResult<T>>
): Promise<SubagentResult<T>> {
    return Sentry.startSpan(
        {
            op: "subagent.invoke",
            name: `${subagentId}.${action}`,
            attributes: { subagentId, action },
        },
        async (span) => {
            const result = await fn();

            if (result.success) {
                span.setStatus({ code: 1, message: "Success" });
            } else {
                span.setStatus({
                    code: 2,
                    message: result.error?.message ?? "Unknown error",
                });
                span.setAttribute("error.code", result.error?.code ?? "UNKNOWN");
            }

            // Attach trace ID to result for correlation
            if (!result.sentryTraceId && span) {
                result.sentryTraceId = span.spanContext()?.traceId;
            }

            return result;
        }
    );
}

/**
 * Wrap a subagent result handler to normalize all responses
 *
 * Catches unhandled errors and converts them to SubagentResult format.
 * This ensures DCOS always gets structured results, never raw exceptions.
 */
export async function normalizeSubagentResult<T>(
    subagentId: string,
    fn: () => Promise<SubagentResult<T>>
): Promise<SubagentResult<T>> {
    try {
        return await fn();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const eventId = Sentry.captureException(error, {
            tags: { component: "dcos", subagent: subagentId },
        });

        logger.error({ error, subagentId }, `Unhandled subagent error: ${message}`);

        return errorResult<T>("PERMANENT", message, { sentryEventId: eventId });
    }
}

/**
 * Full subagent invocation wrapper combining all safety measures:
 * - Timeout protection with AbortController
 * - Error normalization
 * - Sentry span wrapping
 *
 * Use this as the primary entry point for invoking subagents.
 *
 * The `fn` receives an updated context with `abortSignal` set.
 * Subagents should pass this signal to fetch/AI SDK calls for proper cancellation.
 */
export async function safeInvoke<T>(
    subagentId: string,
    action: string,
    fn: (ctx: SubagentContext) => Promise<SubagentResult<T>>,
    context: SubagentContext
): Promise<SubagentResult<T>> {
    return withSubagentSpan(subagentId, action, () =>
        normalizeSubagentResult(subagentId, () =>
            invokeWithTimeout(subagentId, fn, context)
        )
    );
}
