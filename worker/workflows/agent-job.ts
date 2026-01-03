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

import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

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
            success: true,
            summary: result.summary,
            runId,
        };
    } catch (error) {
        // Record failed run
        const errorMessage = error instanceof Error ? error.message : String(error);

        const failedResult = {
            success: false,
            summary: `Failed: ${errorMessage}`,
            toolCallsExecuted: 0,
            notifications: [],
            updatedMemory: context.memory,
        };

        // Try to finalize the failure, but don't mask the original error
        try {
            await finalizeJobRun(runId, jobId, context.userId, failedResult);
        } catch {
            // Clear stream ID at minimum
            await clearJobRunStreamId(runId).catch(() => {});
        }

        throw error;
    }
}
