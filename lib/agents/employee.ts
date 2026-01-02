/**
 * AI Employee Agent
 *
 * Executes scheduled jobs using the same tools and patterns as the main chat.
 * Uses Vercel AI SDK with ToolLoopAgent for agentic execution.
 *
 * Key differences from main concierge:
 * - Focused on completing a specific task (defined by job prompt)
 * - More aggressive message pruning (less history needed)
 * - Explicit completion signal via tool call
 * - No streaming (runs in background worker)
 */

import { generateText, tool, stepCountIs, hasToolCall } from "ai";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { builtInTools } from "@/lib/tools/built-in";
import { pruneModelMessages } from "@/lib/ai/message-pruning";
import type { ModelMessage } from "ai";

/**
 * Fallback chain for employee execution
 * Sonnet for balanced cost/capability, with fallbacks
 */
const EMPLOYEE_FALLBACK_CHAIN = [
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3-5-sonnet-20241022",
    "google/gemini-2.0-flash-001",
];

/**
 * Maximum steps per job execution
 * Employees should complete focused tasks efficiently
 */
const MAX_STEPS = 15;

/**
 * Input for employee execution
 */
export interface EmployeeInput {
    jobId: string;
    userId: string;
    userEmail: string;
    prompt: string;
    memory: Record<string, unknown>;
    messages?: ModelMessage[];
}

/**
 * Result from employee execution
 */
export interface EmployeeResult {
    success: boolean;
    summary: string;
    notifications: Array<{
        title: string;
        body: string;
        priority: "low" | "normal" | "high" | "urgent";
    }>;
    updatedMemory: Record<string, unknown>;
    toolCallsExecuted: number;
}

/**
 * Schema for the complete tool parameters
 */
const completeToolSchema = z.object({
    summary: z
        .string()
        .describe("Brief summary of what was accomplished (1-2 sentences)"),
    notifications: z
        .array(
            z.object({
                title: z.string().describe("Short notification title"),
                body: z.string().describe("Notification message body"),
                priority: z
                    .enum(["low", "normal", "high", "urgent"])
                    .describe("Priority level"),
            })
        )
        .optional()
        .describe("Optional notifications to send to the user"),
    memoryUpdates: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Key-value pairs to persist for next run"),
});

type CompleteToolParams = z.infer<typeof completeToolSchema>;

function createCompleteTool() {
    return tool({
        description:
            "Call this when you have completed the task. Provide a summary and any notifications for the user.",
        inputSchema: completeToolSchema,
        execute: async ({
            summary,
            notifications,
            memoryUpdates,
        }: CompleteToolParams) => {
            // This tool signals completion - the agent loop will stop
            return {
                completed: true,
                summary,
                notifications: notifications ?? [],
                memoryUpdates: memoryUpdates ?? {},
            };
        },
    });
}

/**
 * Build system prompt for employee execution
 */
function buildEmployeePrompt(
    jobPrompt: string,
    memory: Record<string, unknown>
): string {
    const memorySection =
        Object.keys(memory).length > 0
            ? `
<memory>
Context from previous runs:
${JSON.stringify(memory, null, 2)}
</memory>`
            : "";

    return `You are an AI employee executing a scheduled task. Complete the task thoroughly but efficiently.

<task>
${jobPrompt}
</task>
${memorySection}

<guidelines>
- Focus on the specific task - don't go beyond what's asked
- Use available tools to accomplish the task
- When done, call the 'complete' tool with a summary
- Include notifications for anything the user should know about
- Update memory with any context useful for future runs
- If you cannot complete the task, explain why in the summary
</guidelines>

Available integrations will be provided as tools. Use them as needed to complete the task.`;
}

/**
 * Run an AI employee to execute a scheduled job
 *
 * @param input - Job context and user information
 * @returns Execution result with summary, notifications, and updated memory
 *
 * @example
 * ```ts
 * const result = await runEmployee({
 *   jobId: "123",
 *   userId: "user-456",
 *   userEmail: "user@example.com",
 *   prompt: "Check my email and summarize important messages",
 *   memory: {},
 * });
 * ```
 */
export async function runEmployee(input: EmployeeInput): Promise<EmployeeResult> {
    const { jobId, userEmail, prompt, memory, messages = [] } = input;

    const employeeLogger = logger.child({ jobId, userEmail });
    employeeLogger.info(
        { prompt: prompt.slice(0, 100) },
        "🤖 Starting employee execution"
    );

    try {
        // Load tools available to this user
        const integrationTools = await getIntegrationTools(userEmail);
        const completeTool = createCompleteTool();

        const allTools = {
            ...builtInTools,
            ...integrationTools,
            complete: completeTool,
        };

        employeeLogger.debug(
            { tools: Object.keys(allTools) },
            "Loaded tools for employee"
        );

        // Build system prompt
        const systemPrompt = buildEmployeePrompt(prompt, memory);

        // Prune messages for employee context
        const prunedMessages = pruneModelMessages(messages, { mode: "employee" });

        // Prepare messages with system prompt
        const allMessages: ModelMessage[] = [
            { role: "system", content: systemPrompt },
            ...prunedMessages,
            // Add a user message to trigger execution if no messages provided
            ...(prunedMessages.length === 0
                ? [{ role: "user" as const, content: "Please execute the task." }]
                : []),
        ];

        // Get gateway client
        const gateway = getGatewayClient();
        const primaryModel = EMPLOYEE_FALLBACK_CHAIN[0];

        // Execute with tool loop
        const result = await generateText({
            model: gateway(translateModelId(primaryModel)),
            messages: allMessages,
            tools: allTools,
            stopWhen: [hasToolCall("complete"), stepCountIs(MAX_STEPS)],
            providerOptions: {
                gateway: {
                    models: EMPLOYEE_FALLBACK_CHAIN.map(translateModelId),
                },
            },
        });

        // Count tool calls
        const toolCallsExecuted = result.steps.reduce(
            (count, step) => count + (step.toolCalls?.length ?? 0),
            0
        );

        // Extract completion data from tool call
        const completeCall = result.steps
            .flatMap((step) => step.toolCalls ?? [])
            .find((call) => call.toolName === "complete");

        if (completeCall) {
            // Access tool call input (the parsed parameters)
            const completion = (completeCall as { input: CompleteToolParams }).input;

            employeeLogger.info(
                {
                    summary: completion.summary,
                    notificationCount: completion.notifications?.length ?? 0,
                    toolCallsExecuted,
                },
                "✅ Employee completed task"
            );

            return {
                success: true,
                summary: completion.summary,
                notifications: completion.notifications ?? [],
                updatedMemory: { ...memory, ...completion.memoryUpdates },
                toolCallsExecuted,
            };
        }

        // No explicit completion - use last text response
        const lastText = result.text ?? "Task completed without explicit summary.";

        employeeLogger.warn(
            { text: lastText.slice(0, 200), steps: result.steps.length },
            "⚠️ Employee finished without calling complete tool"
        );

        return {
            success: true,
            summary: lastText,
            notifications: [],
            updatedMemory: memory,
            toolCallsExecuted,
        };
    } catch (error) {
        employeeLogger.error({ error }, "❌ Employee execution failed");

        return {
            success: false,
            summary: `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            notifications: [],
            updatedMemory: memory,
            toolCallsExecuted: 0,
        };
    }
}

/**
 * Re-export types for consumers
 */
export type { ModelMessage };
