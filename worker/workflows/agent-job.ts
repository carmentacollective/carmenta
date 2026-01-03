/**
 * Agent Job Workflow
 *
 * Executes a scheduled job using the employee agent with streaming to Redis.
 * Allows users to "tap in" and watch the agent work in real-time.
 *
 * Flow:
 * 1. Load job context (prompt, memory, user info)
 * 2. Create job run record with "running" status
 * 3. Generate streamId and save to run record (so UI can connect immediately)
 * 4. Execute streaming employee (streams to Redis under that streamId)
 * 5. Finalize run with results
 */

import { proxyActivities, ApplicationFailure } from "@temporalio/workflow";
import type * as activities from "../activities";

/**
 * Extract the root cause message from Temporal failures.
 *
 * Temporal wraps activity errors in ActivityFailure, which causes
 * the message to become generic "Activity task failed". The actual
 * error is buried in the cause chain. This function digs it out.
 */
function extractRootCauseMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error);
    }

    // Walk the cause chain to find the deepest error message
    let current: Error | undefined = error;
    let deepestMessage = error.message;

    while (current?.cause instanceof Error) {
        current = current.cause;
        if (current.message) {
            deepestMessage = current.message;
        }
    }

    // ApplicationFailure has details array that may contain more info
    if (
        error instanceof ApplicationFailure &&
        error.details &&
        error.details.length > 0
    ) {
        const details = error.details[0];
        if (typeof details === "string") {
            return details;
        }
    }

    return deepestMessage;
}

/**
 * Extract the root cause stack from Temporal failures.
 */
function extractRootCauseStack(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }

    // Walk the cause chain to find the deepest stack
    let current: Error | undefined = error;
    let deepestStack = error.stack;

    while (current?.cause instanceof Error) {
        current = current.cause;
        if (current.stack) {
            deepestStack = current.stack;
        }
    }

    return deepestStack;
}

const {
    loadFullJobContext,
    createJobRun,
    generateJobStreamId,
    executeStreamingEmployee,
    updateJobRunStreamId,
    finalizeJobRun,
    clearJobRunStreamId,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes", // Longer timeout for tool-using agents
    retry: {
        maximumAttempts: 3,
        backoffCoefficient: 2,
    },
});

export interface AgentJobInput {
    jobId: string;
}

export interface AgentJobResult {
    success: boolean;
    summary: string;
    runId: string;
}

/**
 * Main workflow - loads job context, executes streaming employee, records result
 */
export async function agentJobWorkflow(input: AgentJobInput): Promise<AgentJobResult> {
    const { jobId } = input;

    // Load context first so we have userId for error recording if needed
    const context = await loadFullJobContext(jobId);

    // Create run record immediately so UI can show "running" state
    const runId = await createJobRun(jobId);

    // Generate streamId and save to DB BEFORE execution
    // This allows users to "tap in" as soon as the job starts
    const streamId = await generateJobStreamId(jobId);
    await updateJobRunStreamId(runId, streamId);

    try {
        // Execute streaming employee - streams to Redis under streamId
        const result = await executeStreamingEmployee(context, streamId);

        // Finalize with results (this clears streamId too)
        await finalizeJobRun(runId, jobId, context.userId, result);

        return {
            success: result.success,
            summary: result.summary,
            runId,
        };
    } catch (error) {
        // Extract the ACTUAL error from Temporal's ActivityFailure wrapper
        // Temporal wraps errors, hiding the real message. Dig it out.
        const errorMessage = extractRootCauseMessage(error);
        const errorStack = extractRootCauseStack(error);

        // Extract error code - check both wrapped and root cause
        const errorCode =
            (error as { code?: string })?.code ??
            ((error as Error)?.cause as { code?: string })?.code ??
            "WORKFLOW_ACTIVITY_FAILED";

        const failedResult = {
            success: false,
            summary: `Failed: ${errorMessage}`,
            toolCallsExecuted: 0,
            notifications: [],
            updatedMemory: context.memory,
            // Observability fields for debugging
            errorDetails: {
                message: errorMessage,
                code: errorCode,
                stack: errorStack,
                context: {
                    jobId,
                    runId,
                    failedAt: new Date().toISOString(),
                    failurePoint: "workflow_catch",
                    // Include original wrapper message for debugging
                    temporalMessage: error instanceof Error ? error.message : undefined,
                },
            },
        };

        // Try to finalize the failure, but don't mask the original error
        try {
            await finalizeJobRun(runId, jobId, context.userId, failedResult);
        } catch (finalizationError) {
            // Finalization failed - activity will capture error in Sentry
            // Clear stream ID to prevent UI showing stale "in progress" state
            await clearJobRunStreamId(runId).catch(() => {
                // Double failure - logged in activity, workflow continues with original error
            });
        }

        throw error;
    }
}
