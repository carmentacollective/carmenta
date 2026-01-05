/**
 * DCOS Type Definitions
 *
 * Core types for the Digital Chief of Staff orchestration layer.
 * Defines structured communication between DCOS and subagents.
 */

import type { UIMessageStreamWriter } from "ai";

/**
 * Error codes for subagent results
 *
 * Based on robustness review recommendations for structured error handling:
 * - TEMPORARY: Transient failure, retry may succeed (network, rate limits)
 * - PERMANENT: Fatal error, retry won't help (invalid input, missing resource)
 * - AUTH: Authentication/authorization failure
 * - VALIDATION: Input validation failed
 * - TIMEOUT: Subagent exceeded time limit
 * - STEP_LIMIT: Subagent exhausted step budget without completion
 */
export type SubagentErrorCode =
    | "TEMPORARY"
    | "PERMANENT"
    | "AUTH"
    | "VALIDATION"
    | "TIMEOUT"
    | "STEP_LIMIT";

/**
 * Structured error for subagent failures
 */
export interface SubagentError {
    code: SubagentErrorCode;
    message: string;
    retryable: boolean;
    sentryEventId?: string;
}

/**
 * Standardized result envelope for all subagent invocations
 *
 * DCOS can interpret this structure to make routing decisions:
 * - Retry on temporary failures
 * - Report permanent failures to user
 * - Handle auth errors by prompting reconnection
 */
export interface SubagentResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: SubagentError;
    /** Indicates response is degraded due to partial failure */
    degraded?: boolean;
    /** Number of agent steps consumed */
    stepsUsed?: number;
    /** Sentry trace ID for cross-agent debugging */
    sentryTraceId?: string;
}

/**
 * Context passed to subagent invocations
 */
export interface SubagentContext {
    /** User ID for KB access, permissions */
    userId: string;
    /** User email for service integrations */
    userEmail: string;
    /** Stream writer for status updates (optional) */
    writer?: UIMessageStreamWriter;
    /** Parent Sentry trace ID for correlation */
    parentTraceId?: string;
    /** Timeout in milliseconds (default: 60000) */
    timeoutMs?: number;
    /**
     * Abort signal for cancellation.
     * Subagents should check this periodically and pass to fetch/AI SDK calls.
     * Created automatically by invokeWithTimeout - do not set manually.
     */
    abortSignal?: AbortSignal;
}

/**
 * Subagent operation descriptor for progressive disclosure
 */
export interface SubagentOperation {
    name: string;
    description: string;
    params?: Array<{
        name: string;
        type: string;
        description: string;
        required?: boolean;
    }>;
}

/**
 * Subagent description returned by action='describe'
 */
export interface SubagentDescription {
    id: string;
    name: string;
    summary: string;
    operations: SubagentOperation[];
}

/**
 * Generic invoke function signature for subagent tools
 */
export type SubagentInvokeFn<TParams = Record<string, unknown>, TResult = unknown> = (
    action: string,
    params: TParams,
    context: SubagentContext
) => Promise<SubagentResult<TResult>>;

/**
 * Subagent definition for registration
 */
export interface SubagentDefinition {
    id: string;
    name: string;
    /** Short description for DCOS tool list (< 100 chars) */
    description: string;
    /** Capabilities for routing hints */
    capabilities: string[];
    /** Returns full operation descriptions */
    describe: () => SubagentDescription;
    /** Invokes the subagent */
    invoke: SubagentInvokeFn;
}

/**
 * DCOS conversation input from various channels
 */
export interface DCOSInput {
    message: string;
    /** Where the request originated */
    channel: "web" | "sms" | "voice";
    /** Channel-specific constraints */
    channelConstraints: {
        maxResponseLength?: number;
        supportsMarkdown: boolean;
        supportsToolDisplay: boolean;
    };
    /** Current page context (web only) */
    pageContext?: string;
}

/**
 * Type guard to check if a result indicates success
 */
export function isSuccessResult<T>(
    result: SubagentResult<T>
): result is SubagentResult<T> & { success: true; data: T } {
    return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if a result indicates failure
 */
export function isErrorResult<T>(
    result: SubagentResult<T>
): result is SubagentResult<T> & { success: false; error: SubagentError } {
    return result.success === false && result.error !== undefined;
}

/**
 * Helper to create a success result
 */
export function successResult<T>(
    data: T,
    options?: { stepsUsed?: number; sentryTraceId?: string }
): SubagentResult<T> {
    return {
        success: true,
        data,
        stepsUsed: options?.stepsUsed,
        sentryTraceId: options?.sentryTraceId,
    };
}

/**
 * Helper to create an error result
 */
export function errorResult<T = unknown>(
    code: SubagentErrorCode,
    message: string,
    options?: { sentryEventId?: string; stepsUsed?: number }
): SubagentResult<T> {
    const retryable = code === "TEMPORARY" || code === "TIMEOUT";
    return {
        success: false,
        error: {
            code,
            message,
            retryable,
            sentryEventId: options?.sentryEventId,
        },
        stepsUsed: options?.stepsUsed,
    };
}

/**
 * Helper to create a degraded result (partial success)
 */
export function degradedResult<T>(
    data: T,
    message: string,
    options?: { stepsUsed?: number; sentryTraceId?: string }
): SubagentResult<T> {
    return {
        success: true,
        data,
        degraded: true,
        error: {
            code: "TEMPORARY",
            message,
            retryable: false,
        },
        stepsUsed: options?.stepsUsed,
        sentryTraceId: options?.sentryTraceId,
    };
}
