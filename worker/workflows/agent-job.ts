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

    try {
        // Load full job context (includes user email, integrations, memory)
        const context = await loadFullJobContext(jobId);

        // Execute employee agent with tool access
        const result = await executeEmployee(context);

        // Record successful run
        await recordEmployeeRun(jobId, context.userId, result);

        return {
            success: true,
            summary: result.summary,
        };
    } catch (error) {
        // Record failed run
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Load context again for userId (needed for error recording)
        const context = await loadFullJobContext(jobId);

        // Create a failed result
        const failedResult = {
            success: false,
            summary: `Failed: ${errorMessage}`,
            toolCallsExecuted: 0,
            notifications: [],
            updatedMemory: context.memory,
        };

        await recordEmployeeRun(jobId, context.userId, failedResult);

        throw error;
    }
}
