/**
 * Agent Job Workflow
 *
 * Executes a scheduled job by calling an LLM with the job's prompt.
 * This is the infrastructure skeleton - tool support will be added
 * when we wire up internal integrations.
 */

import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const { loadJobContext, callLLM, recordJobRun } = proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minutes",
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

const SYSTEM_PROMPT = `You are an autonomous agent executing a scheduled task.
Complete the user's task based on the prompt provided.
Be concise and actionable in your response.`;

/**
 * Main workflow - loads job, calls LLM, records result
 */
export async function agentJobWorkflow(input: AgentJobInput): Promise<AgentJobResult> {
    const { jobId } = input;

    const messages: Array<{ role: string; content: string }> = [];

    try {
        // Load job configuration
        const context = await loadJobContext(jobId);
        messages.push({ role: "user", content: context.prompt });

        // Call LLM
        const response = await callLLM({
            systemPrompt: SYSTEM_PROMPT,
            messages,
            memory: context.memory,
        });

        messages.push({ role: "assistant", content: response.content });

        // Record successful run
        await recordJobRun({
            jobId,
            status: "completed",
            summary: response.content,
            messages,
        });

        return {
            success: true,
            summary: response.content,
        };
    } catch (error) {
        // Record failed run
        const errorMessage = error instanceof Error ? error.message : String(error);
        const summary = `Failed: ${errorMessage}`;

        await recordJobRun({
            jobId,
            status: "failed",
            summary,
            messages,
        });

        throw error;
    }
}
