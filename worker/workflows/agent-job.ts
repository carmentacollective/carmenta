/**
 * Agent Job Workflow
 *
 * Executes a scheduled agent job with tool use, loops, and decisions.
 * The agent can call integrations, update memory, and send notifications.
 */

import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
    loadJobContext,
    callLLM,
    executeIntegration,
    updateJobMemory,
    createNotification,
    recordJobRun,
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minutes",
    retry: {
        maximumAttempts: 3,
        backoffCoefficient: 2,
    },
});

export interface AgentJobInput {
    jobId: string;
    userId: string;
    userEmail: string;
}

export interface AgentJobResult {
    success: boolean;
    summary: string;
    notificationsSent: number;
    toolCallsExecuted: number;
}

/**
 * Main agent workflow - loops until the LLM decides to complete
 */
export async function agentJobWorkflow(input: AgentJobInput): Promise<AgentJobResult> {
    const { jobId, userId, userEmail } = input;

    // Track execution stats
    let toolCallsExecuted = 0;
    let notificationsSent = 0;
    const messages: Array<{ role: string; content: string }> = [];

    try {
        // Load job configuration and memory from database
        const context = await loadJobContext(jobId);
        const { prompt, integrations } = context;
        let memory = context.memory;

        // Initialize conversation with system prompt and user's job prompt
        const systemPrompt = buildSystemPrompt(integrations);
        messages.push({ role: "user", content: prompt });

        // Agent loop - LLM decides when to stop
        const MAX_STEPS = 20;
        let step = 0;

        while (step < MAX_STEPS) {
            step++;

            // Call LLM with current context
            const response = await callLLM({
                systemPrompt,
                messages,
                memory,
                availableTools: integrations,
            });

            // Process the response
            if (response.type === "text") {
                messages.push({ role: "assistant", content: response.content ?? "" });

                // Check if the agent is done
                if (response.isComplete) {
                    break;
                }
            }

            if (
                response.type === "tool_call" &&
                response.toolName &&
                response.toolArgs
            ) {
                const { toolName, toolArgs } = response;
                toolCallsExecuted++;

                // Handle special tools
                if (toolName === "notify_user") {
                    await createNotification({
                        userId,
                        jobId,
                        title: String(toolArgs.title || ""),
                        body: String(toolArgs.body || ""),
                        priority: String(toolArgs.priority || "normal"),
                    });
                    notificationsSent++;
                    messages.push({
                        role: "tool",
                        content: JSON.stringify({
                            success: true,
                            message: "Notification sent",
                        }),
                    });
                } else if (toolName === "update_memory") {
                    const updates = (toolArgs.updates || {}) as Record<string, unknown>;
                    await updateJobMemory(jobId, updates);

                    // Update local memory so subsequent LLM calls see the changes
                    memory = { ...memory, ...updates };

                    messages.push({
                        role: "tool",
                        content: JSON.stringify({
                            success: true,
                            message: "Memory updated",
                        }),
                    });
                } else {
                    // Execute integration tool via MCP-Hubby
                    const result = await executeIntegration({
                        userEmail,
                        service: toolName,
                        action: String(toolArgs.action || "describe"),
                        params: (toolArgs.params || {}) as Record<string, unknown>,
                    });
                    messages.push({
                        role: "tool",
                        content: JSON.stringify(result),
                    });
                }
            }

            // Brief pause between steps to avoid rate limits
            await sleep(100);
        }

        // Generate summary from final message
        const lastAssistantMessage = messages
            .filter((m) => m.role === "assistant")
            .pop();
        const summary = lastAssistantMessage?.content ?? "Job completed";

        // Record the run in our database
        await recordJobRun({
            jobId,
            status: "completed",
            summary,
            messages,
            toolCallsExecuted,
            notificationsSent,
        });

        return {
            success: true,
            summary,
            notificationsSent,
            toolCallsExecuted,
        };
    } catch (error) {
        // Record failed run for observability
        const errorMessage = error instanceof Error ? error.message : String(error);
        const summary = `Failed: ${errorMessage}`;

        await recordJobRun({
            jobId,
            status: "failed",
            summary,
            messages,
            toolCallsExecuted,
            notificationsSent,
        });

        // Re-throw to let Temporal handle retries
        throw error;
    }
}

function buildSystemPrompt(integrations: string[]): string {
    const integrationList = integrations.join(", ");

    return `You are an autonomous agent executing a scheduled task. You have access to the following integrations: ${integrationList}.

Your job is to complete the user's task by:
1. Reading data from integrations as needed
2. Processing and analyzing information
3. Taking actions based on your analysis
4. Notifying the user of important findings

Available tools:
- notify_user(title, body, priority): Send a notification to the user. Use this when you find something important.
- update_memory(updates): Store information for future runs. Use this to remember state between executions.
- [integration tools]: Each integration (${integrationList}) provides operations you can discover by calling with action="describe".

When you have completed the task or have nothing more to do, end your response with "TASK_COMPLETE" to signal you're done.

Be efficient. Don't over-notify. Focus on what's actually valuable to the user.`;
}
