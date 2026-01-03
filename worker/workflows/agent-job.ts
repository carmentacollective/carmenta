/**
 * Agent Job Workflow
 *
 * Executes a scheduled job using the employee agent with full tool access.
 */

import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const { loadFullJobContext, executeEmployee, recordEmployeeRun } = proxyActivities<
    typeof activities
>({
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
}

/**
 * Main workflow - loads job context, executes employee agent with tools, records result
 */
export async function agentJobWorkflow(input: AgentJobInput): Promise<AgentJobResult> {
    const { jobId } = input;

    // Load context first so we have userId for error recording if needed
    const context = await loadFullJobContext(jobId);

    try {
        // Execute employee agent with tool access
        const result = await executeEmployee(context);

        // Record successful run
        await recordEmployeeRun(jobId, context.userId, result);

        return {
            success: true,
            summary: result.summary,
        };
    } catch (error) {
        // Record failed run - we already have context from above
        const errorMessage = error instanceof Error ? error.message : String(error);

        const failedResult = {
            success: false,
            summary: `Failed: ${errorMessage}`,
            toolCallsExecuted: 0,
            notifications: [],
            updatedMemory: context.memory,
        };

        // Try to record the failure, but don't mask the original error
        try {
            await recordEmployeeRun(jobId, context.userId, failedResult);
        } catch (recordError) {
            // Log but don't throw - original error is more important
            // Temporal logging will capture this via the workflow error
        }

        throw error;
    }
}
