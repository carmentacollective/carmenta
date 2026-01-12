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

import {
    generateText,
    streamText,
    tool,
    stepCountIs,
    hasToolCall,
    type UIMessageStreamWriter,
} from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { builtInTools } from "@/lib/tools/built-in";
import { pruneModelMessages } from "@/lib/ai/message-pruning";
import { writeStatus } from "@/lib/streaming";
import type {
    JobExecutionTrace,
    JobExecutionStep,
    JobErrorDetails,
    JobTokenUsage,
} from "@/lib/db/schema";
import type { ModelMessage } from "ai";

/**
 * Fallback chain for employee execution
 * Sonnet for balanced cost/capability, with fallbacks
 */
const EMPLOYEE_FALLBACK_CHAIN = [
    "anthropic/claude-sonnet-4.5",
    "google/gemini-3-pro-preview",
    "openai/gpt-5.2",
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

    /** Full execution trace with tool calls and outputs */
    executionTrace?: JobExecutionTrace;
    /** Structured error details for failed runs */
    errorDetails?: JobErrorDetails;
    /** Token usage metrics */
    tokenUsage?: JobTokenUsage;
    /** Model ID used for execution */
    modelId?: string;
    /** Total execution time in ms */
    durationMs?: number;
    /** Sentry trace ID for linking to dashboard */
    sentryTraceId?: string;
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
 * Extract execution trace from Vercel AI SDK result.steps
 * Converts SDK format into our JobExecutionTrace schema
 */
function extractExecutionTrace(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps: any[],
    finalText?: string
): JobExecutionTrace {
    // Log what we received for debugging
    logger.debug(
        {
            stepCount: steps?.length ?? 0,
            hasSteps: Array.isArray(steps) && steps.length > 0,
            finalTextLength: finalText?.length ?? 0,
            stepSummary: steps?.map((s, i) => ({
                index: i,
                hasText: !!s.text,
                hasReasoning: !!s.reasoningText,
                toolCallCount: s.toolCalls?.length ?? 0,
                toolResultCount: s.toolResults?.length ?? 0,
            })),
        },
        "📊 Extracting execution trace from steps"
    );

    const traceSteps: JobExecutionStep[] = steps.map((step, index) => {
        const stepStart = new Date().toISOString(); // Approximation - SDK doesn't provide timing

        const executionStep: JobExecutionStep = {
            stepIndex: index,
            startedAt: stepStart,
            completedAt: stepStart, // Will be overwritten with actual timing if available
            text: step.text || undefined,
            reasoningContent: step.reasoningText || undefined,
        };

        // Extract tool calls if present
        if (step.toolCalls && step.toolCalls.length > 0) {
            executionStep.toolCalls = step.toolCalls.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (tc: any, tcIndex: number) => {
                    // Find matching result
                    const result = step.toolResults?.find(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (tr: any) => tr.toolCallId === tc.toolCallId
                    );

                    return {
                        toolCallId: tc.toolCallId || `tool-${index}-${tcIndex}`,
                        toolName: tc.toolName,
                        input: tc.input || {},
                        output: result?.output,
                        // Tool errors appear in step.content as 'tool-error' parts, not on results
                        durationMs: 0, // SDK doesn't track per-tool timing
                    };
                }
            );
        }

        return executionStep;
    });

    return {
        steps: traceSteps,
        finalText: finalText || undefined,
    };
}

/**
 * Extract token usage from SDK response
 */
function extractTokenUsage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage: any
): JobTokenUsage | undefined {
    if (!usage) return undefined;

    return {
        inputTokens: usage.promptTokens ?? 0,
        outputTokens: usage.completionTokens ?? 0,
        cachedInputTokens: usage.cachedPromptTokens,
    };
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

    const startTime = Date.now();

    // Wrap in Sentry span for trace linking and observability
    return Sentry.startSpan(
        {
            op: "job.execute",
            name: `Job: ${jobId}`,
            attributes: {
                jobId,
                userEmail,
                promptLength: prompt.length,
                memoryKeys: Object.keys(memory).length,
            },
        },
        async (span) => {
            const sentryTraceId = span?.spanContext()?.traceId;

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
                const prunedMessages = pruneModelMessages(messages, {
                    mode: "employee",
                });

                // Prepare messages with system prompt
                const allMessages: ModelMessage[] = [
                    { role: "system", content: systemPrompt },
                    ...prunedMessages,
                    // Add a user message to trigger execution if no messages provided
                    ...(prunedMessages.length === 0
                        ? [
                              {
                                  role: "user" as const,
                                  content: "Please execute the task.",
                              },
                          ]
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

                const durationMs = Date.now() - startTime;

                // Count tool calls
                const toolCallsExecuted = result.steps.reduce(
                    (count, step) => count + (step.toolCalls?.length ?? 0),
                    0
                );

                // Extract completion data from tool call
                const completeCall = result.steps
                    .flatMap((step) => step.toolCalls ?? [])
                    .find((call) => call.toolName === "complete");

                // Extract completion args (may be undefined if tool call exists but args missing)
                const completion = completeCall
                    ? (completeCall as unknown as { args: CompleteToolParams }).args
                    : undefined;

                // Extract observability data
                const executionTrace = extractExecutionTrace(result.steps, result.text);
                const tokenUsage = extractTokenUsage(result.usage);

                // Add span attributes for observability
                span?.setAttributes({
                    "job.toolCallsExecuted": toolCallsExecuted,
                    "job.durationMs": durationMs,
                    "job.completedExplicitly": !!completion?.summary,
                });

                // Require summary to be present - empty args object should fall back to text
                if (completion?.summary) {
                    employeeLogger.info(
                        {
                            summary: completion.summary,
                            notificationCount: completion.notifications?.length ?? 0,
                            toolCallsExecuted,
                            durationMs,
                        },
                        "✅ Employee completed task"
                    );

                    return {
                        success: true,
                        summary: completion.summary,
                        notifications: completion.notifications ?? [],
                        updatedMemory: { ...memory, ...completion.memoryUpdates },
                        toolCallsExecuted,
                        executionTrace,
                        tokenUsage,
                        modelId: primaryModel,
                        durationMs,
                        sentryTraceId,
                    };
                }

                // No explicit completion - use last text response (|| catches empty strings too)
                const lastText =
                    result.text || "Task completed without explicit summary.";

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
                    executionTrace,
                    tokenUsage,
                    modelId: primaryModel,
                    durationMs,
                    sentryTraceId,
                };
            } catch (error) {
                const durationMs = Date.now() - startTime;

                employeeLogger.error({ error }, "❌ Employee execution failed");
                Sentry.captureException(error, {
                    tags: { component: "ai-team", agent: "employee" },
                    extra: { jobId, userEmail },
                });

                // Build structured error details
                const errorDetails: JobErrorDetails = {
                    message: error instanceof Error ? error.message : "Unknown error",
                    code: (error as { code?: string })?.code,
                    stack: error instanceof Error ? error.stack : undefined,
                    context: { jobId, userEmail },
                };

                span?.setAttributes({
                    "job.success": false,
                    "job.error": errorDetails.message,
                });

                return {
                    success: false,
                    summary: `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    notifications: [],
                    updatedMemory: memory,
                    toolCallsExecuted: 0,
                    errorDetails,
                    modelId: EMPLOYEE_FALLBACK_CHAIN[0],
                    durationMs,
                    sentryTraceId,
                };
            }
        }
    );
}

/**
 * Run an AI employee with streaming output for live progress viewing.
 *
 * Same logic as runEmployee but streams progress to a UIMessageStreamWriter,
 * allowing users to "tap in" and watch the agent work in real-time.
 *
 * @param input - Job context and user information
 * @param writer - Stream writer for emitting progress
 * @returns Execution result with summary, notifications, and updated memory
 */
export async function runEmployeeStreaming(
    input: EmployeeInput,
    writer: UIMessageStreamWriter
): Promise<EmployeeResult> {
    const { jobId, userEmail, prompt, memory, messages = [] } = input;
    const startTime = Date.now();

    const employeeLogger = logger.child({ jobId, userEmail });
    employeeLogger.info(
        { prompt: prompt.slice(0, 100) },
        "🤖 Starting streaming employee execution"
    );

    // Emit starting status
    writeStatus(writer, `job-${jobId}-start`, "Starting task...", "🚀");

    // Wrap in Sentry span for trace linking
    return Sentry.startSpan(
        {
            op: "job.execute",
            name: `Job: ${jobId}`,
            attributes: { jobId, userEmail },
        },
        async (span) => {
            const sentryTraceId = span?.spanContext()?.traceId;
            let toolCallsExecuted = 0;

            try {
                // Load tools available to this user
                const integrationTools = await getIntegrationTools(userEmail);
                const completeTool = createCompleteTool();

                const allTools = {
                    ...builtInTools,
                    ...integrationTools,
                    complete: completeTool,
                };

                writeStatus(writer, `job-${jobId}-tools`, "Tools ready", "🔧");

                // Build system prompt and prepare messages
                const systemPrompt = buildEmployeePrompt(prompt, memory);
                const prunedMessages = pruneModelMessages(messages, {
                    mode: "employee",
                });
                const allMessages: ModelMessage[] = [
                    { role: "system", content: systemPrompt },
                    ...prunedMessages,
                    ...(prunedMessages.length === 0
                        ? [
                              {
                                  role: "user" as const,
                                  content: "Please execute the task.",
                              },
                          ]
                        : []),
                ];

                const gateway = getGatewayClient();
                const primaryModel = EMPLOYEE_FALLBACK_CHAIN[0];
                let completeCallData: Partial<CompleteToolParams> | null = null;

                // Stream execution
                const result = streamText({
                    model: gateway(translateModelId(primaryModel)),
                    messages: allMessages,
                    tools: allTools,
                    stopWhen: [hasToolCall("complete"), stepCountIs(MAX_STEPS)],
                    providerOptions: {
                        gateway: {
                            models: EMPLOYEE_FALLBACK_CHAIN.map(translateModelId),
                        },
                    },
                    onChunk: ({ chunk }) => {
                        // Emit tool call status
                        if (chunk.type === "tool-call") {
                            toolCallsExecuted++;
                            const toolName =
                                chunk.toolName === "complete"
                                    ? "Finishing up"
                                    : chunk.toolName;
                            writeStatus(
                                writer,
                                `tool-${chunk.toolCallId}`,
                                `Using ${toolName}...`,
                                "🔧"
                            );
                        }
                        if (chunk.type === "tool-result") {
                            // Clear tool status when result received
                            writeStatus(writer, `tool-${chunk.toolCallId}`, "");
                        }
                    },
                    onFinish: async ({ toolCalls }) => {
                        // Extract complete tool data
                        const completeCall = toolCalls.find(
                            (tc) => tc.toolName === "complete"
                        );
                        if (completeCall) {
                            completeCallData = (
                                completeCall as unknown as {
                                    args: CompleteToolParams;
                                }
                            ).args;
                        }
                    },
                });

                // Merge stream into writer (client sees progress)
                writer.merge(result.toUIMessageStream({ sendReasoning: false }));

                // Wait for stream to complete and get full result
                employeeLogger.debug(
                    {},
                    "⏳ Waiting for stream response to complete..."
                );

                // Wait for the full text to ensure stream is consumed
                const fullText = await result.text;
                employeeLogger.debug(
                    { textLength: fullText?.length ?? 0 },
                    "✅ Full text received from stream"
                );

                const steps = await result.steps;

                // Log the raw structure for debugging
                employeeLogger.info(
                    {
                        stepsCount: steps?.length ?? 0,
                        stepsType: typeof steps,
                        isArray: Array.isArray(steps),
                        rawSteps: JSON.stringify(
                            steps?.map((s, i) => ({
                                index: i,
                                text: s.text?.slice(0, 50),
                                reasoningText: s.reasoningText?.slice(0, 50),
                                toolCallsCount: s.toolCalls?.length ?? 0,
                                toolResultsCount: s.toolResults?.length ?? 0,
                                finishReason: s.finishReason,
                            })) ?? []
                        ),
                    },
                    "📋 Raw steps from Vercel AI SDK"
                );
                const usage = await result.usage;

                // Extract observability data
                const durationMs = Date.now() - startTime;
                // Use fullText from awaited result, not the onFinish callback
                const executionTrace = extractExecutionTrace(steps, fullText);
                const tokenUsage = extractTokenUsage(usage);

                employeeLogger.info(
                    {
                        traceStepCount: executionTrace.steps.length,
                        hasFinalText: !!executionTrace.finalText,
                        tokenUsage: tokenUsage
                            ? {
                                  input: tokenUsage.inputTokens,
                                  output: tokenUsage.outputTokens,
                              }
                            : null,
                    },
                    "📊 Execution trace extracted"
                );

                // Process completion - require summary to be present
                const completion = completeCallData as CompleteToolParams | null;
                if (completion?.summary) {
                    writeStatus(
                        writer,
                        `job-${jobId}-complete`,
                        "Task completed!",
                        "✅"
                    );

                    employeeLogger.info(
                        {
                            summary: completion.summary,
                            notificationCount: completion.notifications?.length ?? 0,
                            toolCallsExecuted,
                            durationMs,
                        },
                        "✅ Streaming employee completed task"
                    );

                    return {
                        success: true,
                        summary: completion.summary,
                        notifications: completion.notifications ?? [],
                        updatedMemory: { ...memory, ...completion.memoryUpdates },
                        toolCallsExecuted,
                        executionTrace,
                        tokenUsage,
                        modelId: primaryModel,
                        durationMs,
                        sentryTraceId,
                    };
                }

                // No explicit completion
                writeStatus(writer, `job-${jobId}-complete`, "Task finished", "✅");

                employeeLogger.warn(
                    { text: fullText.slice(0, 200) },
                    "⚠️ Streaming employee finished without calling complete tool"
                );

                return {
                    success: true,
                    summary: fullText || "Task completed without explicit summary.",
                    notifications: [],
                    updatedMemory: memory,
                    toolCallsExecuted,
                    executionTrace,
                    tokenUsage,
                    modelId: primaryModel,
                    durationMs,
                    sentryTraceId,
                };
            } catch (error) {
                const durationMs = Date.now() - startTime;

                writeStatus(
                    writer,
                    `job-${jobId}-error`,
                    `Error: ${error instanceof Error ? error.message : "Unknown"}`,
                    "❌"
                );

                employeeLogger.error(
                    { error },
                    "❌ Streaming employee execution failed"
                );
                Sentry.captureException(error, {
                    tags: { component: "ai-team", agent: "employee-stream" },
                    extra: { jobId, userEmail, toolCallsExecuted },
                });

                // Build structured error details - include stack in all environments for observability
                const errorDetails: JobErrorDetails = {
                    message: error instanceof Error ? error.message : "Unknown error",
                    code: (error as { code?: string })?.code,
                    stack: error instanceof Error ? error.stack : undefined,
                    context: { jobId, userEmail },
                };

                return {
                    success: false,
                    summary: `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    notifications: [],
                    updatedMemory: memory,
                    toolCallsExecuted,
                    errorDetails,
                    modelId: EMPLOYEE_FALLBACK_CHAIN[0],
                    durationMs,
                    sentryTraceId,
                };
            }
        }
    );
}

/**
 * Re-export types for consumers
 */
export type { ModelMessage };
