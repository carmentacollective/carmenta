/**
 * AI Team Member Agent
 *
 * Executes scheduled jobs using the same tools and patterns as the main chat.
 * Uses Vercel AI SDK with ToolLoopAgent for agentic execution.
 *
 * Key differences from main concierge:
 * - Focused on completing a specific task (defined by job prompt)
 * - More aggressive message pruning (less history needed)
 * - Explicit completion signal via tool call
 * - Streaming optional (supports background worker)
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
import { AI_TEAM_SYSTEM_PROMPT } from "./ai-team-system-prompt";
import type {
    JobExecutionTrace,
    JobExecutionStep,
    JobErrorDetails,
    JobTokenUsage,
} from "@/lib/db/schema";
import type { ModelMessage } from "ai";
import { getFallbackChain } from "@/lib/model-config";

/**
 * Fallback chain for AI Team member execution
 * Sonnet for balanced cost/capability, with fallbacks from model-config
 */
const AI_TEAM_MODEL_CHAIN = getFallbackChain("anthropic/claude-sonnet-4.5");

/**
 * Maximum steps per job execution
 * AI Team members should complete focused tasks efficiently
 */
const MAX_STEPS = 15;

/**
 * Job context for AI Team member execution
 */
export interface AITeamJobContext {
    jobId: string;
    jobName: string;
    scheduleDisplay: string;
    totalRuns: number;
    totalSuccesses: number;
    lastRunAt: string | null;
    lastRunOutcome: string | null;
    agentNotes: string;
    userConfig: Record<string, unknown>;
    task: string;
}

/**
 * Input for AI Team member execution
 */
export interface AITeamMemberInput {
    jobId: string;
    userId: string;
    userEmail: string;
    prompt: string;
    messages?: ModelMessage[];

    /** New AI Team job context (when available) */
    jobContext?: AITeamJobContext;
}

/**
 * Completion status from AI Team member
 */
export type AITeamStatus = "success" | "partial" | "failed" | "blocked";

/**
 * Result from AI Team member execution
 */
export interface AITeamMemberResult {
    success: boolean;
    summary: string;
    notifications: Array<{
        title: string;
        body: string;
        priority: "low" | "normal" | "high" | "urgent";
    }>;
    toolCallsExecuted: number;

    /** Completion status (new AI Team framework) */
    status?: AITeamStatus;
    /** Updated agent notes (markdown) */
    updatedNotes?: string;
    /** Reason for blocked status */
    blockedReason?: string;

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
    summary: z.string().describe("Outcomes for the user—what changed, what matters"),

    notes: z
        .string()
        .optional()
        .describe(
            "Full updated notes document (markdown). Replaces previous notes entirely."
        ),

    status: z
        .enum(["success", "partial", "failed", "blocked"])
        .default("success")
        .describe(
            "success=completed, partial=some work done, failed=couldn't complete, blocked=needs user action"
        ),

    blockedReason: z
        .string()
        .optional()
        .describe("If blocked, explain what user action is needed"),

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
        .describe("For time-sensitive items only"),

    // Legacy field - still supported for backward compatibility
    memoryUpdates: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("DEPRECATED: Use notes field instead"),
});

type CompleteToolParams = z.infer<typeof completeToolSchema>;

function createCompleteTool() {
    return tool({
        description: "Call when done. Provide summary, updated notes, and status.",
        inputSchema: completeToolSchema,
        execute: async ({
            summary,
            notes,
            status,
            blockedReason,
            notifications,
            memoryUpdates,
        }: CompleteToolParams) => {
            // This tool signals completion - the agent loop will stop
            return {
                completed: true,
                summary,
                notes: notes ?? null,
                status: status ?? "success",
                blockedReason: blockedReason ?? null,
                notifications: notifications ?? [],
                memoryUpdates: memoryUpdates ?? {},
            };
        },
    });
}

/**
 * Format user config for display in prompt.
 * Excludes userNotes since it's shown separately.
 */
function formatUserConfig(config: Record<string, unknown>): string {
    // Filter out userNotes - it's displayed in its own section
    const { userNotes: _, ...configWithoutNotes } = config;
    if (Object.keys(configWithoutNotes).length === 0) {
        return "_No configuration set._";
    }
    return JSON.stringify(configWithoutNotes, null, 2);
}

/**
 * Build the dynamic user prompt for AI Team member execution.
 * Contains all job-specific context: identity, notes, config, task.
 */
function buildAITeamUserPrompt(context: AITeamJobContext): string {
    const lastRunDisplay = context.lastRunAt
        ? `${context.lastRunAt} (${context.lastRunOutcome})`
        : "First run";

    const userNotes = (context.userConfig?.userNotes as string | undefined) || null;

    return `## Your Job

**${context.jobName}**
Schedule: ${context.scheduleDisplay}
Runs: ${context.totalRuns} total, ${context.totalSuccesses} successful
Last run: ${lastRunDisplay}

## Your Notes

${context.agentNotes || "_No notes yet. This is your first run._"}

## User Configuration

${formatUserConfig(context.userConfig)}

## User's Notes to You

${userNotes || "_No specific guidance provided._"}

## Task

${context.task}`;
}

/**
 * Build legacy system prompt for AI Team member execution (backward compatibility).
 * Used when jobContext is not provided.
 */
function buildLegacyAITeamMemberPrompt(jobPrompt: string): string {
    return `You are an AI employee executing a scheduled task. Complete the task thoroughly but efficiently.

<task>
${jobPrompt}
</task>

<guidelines>
- Focus on the specific task - don't go beyond what's asked
- Use available tools to accomplish the task
- When done, call the 'complete' tool with a summary
- Include notifications for anything the user should know about
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
 * @returns Execution result with summary and notifications
 *
 * @example
 * ```ts
 * const result = await runAITeamMember({
 *   jobId: "123",
 *   userId: "user-456",
 *   userEmail: "user@example.com",
 *   prompt: "Check my email and summarize important messages",
 * });
 * ```
 */
export async function runAITeamMember(
    input: AITeamMemberInput
): Promise<AITeamMemberResult> {
    const { jobId, userEmail, prompt, messages = [], jobContext } = input;

    const aiTeamLogger = logger.child({ jobId, userEmail });
    aiTeamLogger.info(
        { prompt: prompt.slice(0, 100) },
        "🤖 Starting AI Team member execution"
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

                aiTeamLogger.debug(
                    { tools: Object.keys(allTools) },
                    "Loaded tools for AI Team member"
                );

                // Prune messages for employee context
                const prunedMessages = pruneModelMessages(messages, {
                    mode: "employee",
                });

                // Build messages based on whether we have new AI Team context
                let allMessages: ModelMessage[];

                if (jobContext) {
                    // New AI Team framework: static system + dynamic user prompt
                    allMessages = [
                        { role: "system", content: AI_TEAM_SYSTEM_PROMPT },
                        ...prunedMessages,
                        {
                            role: "user" as const,
                            content: buildAITeamUserPrompt(jobContext),
                        },
                    ];
                } else {
                    // Legacy: combined system prompt
                    const systemPrompt = buildLegacyAITeamMemberPrompt(prompt);
                    allMessages = [
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
                }

                // Get gateway client
                const gateway = getGatewayClient();
                const primaryModel = AI_TEAM_MODEL_CHAIN[0];

                // Execute with tool loop
                const result = await generateText({
                    model: gateway(translateModelId(primaryModel)),
                    messages: allMessages,
                    tools: allTools,
                    stopWhen: [hasToolCall("complete"), stepCountIs(MAX_STEPS)],
                    providerOptions: {
                        gateway: {
                            models: AI_TEAM_MODEL_CHAIN.map(translateModelId),
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
                    aiTeamLogger.info(
                        {
                            summary: completion.summary,
                            notificationCount: completion.notifications?.length ?? 0,
                            toolCallsExecuted,
                            durationMs,
                        },
                        "✅ AI Team member completed task"
                    );

                    // Map status to success boolean for backward compatibility
                    const status = (completion.status ?? "success") as AITeamStatus;
                    const isSuccess = status === "success" || status === "partial";

                    return {
                        success: isSuccess,
                        summary: completion.summary,
                        notifications: completion.notifications ?? [],
                        toolCallsExecuted,
                        status,
                        updatedNotes: completion.notes ?? undefined,
                        blockedReason: completion.blockedReason ?? undefined,
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

                aiTeamLogger.warn(
                    { text: lastText.slice(0, 200), steps: result.steps.length },
                    "⚠️ AI Team member finished without calling complete tool"
                );

                return {
                    success: true,
                    summary: lastText,
                    notifications: [],
                    toolCallsExecuted,
                    status: "success" as AITeamStatus,
                    executionTrace,
                    tokenUsage,
                    modelId: primaryModel,
                    durationMs,
                    sentryTraceId,
                };
            } catch (error) {
                const durationMs = Date.now() - startTime;

                aiTeamLogger.error({ error }, "❌ AI Team member execution failed");
                Sentry.captureException(error, {
                    tags: { component: "ai-team", agent: "ai-team-member" },
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
                    toolCallsExecuted: 0,
                    errorDetails,
                    modelId: AI_TEAM_MODEL_CHAIN[0],
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
 * Same logic as runAITeamMember but streams progress to a UIMessageStreamWriter,
 * allowing users to "tap in" and watch the agent work in real-time.
 *
 * @param input - Job context and user information
 * @param writer - Stream writer for emitting progress
 * @returns Execution result with summary and notifications
 */
export async function runAITeamMemberStreaming(
    input: AITeamMemberInput,
    writer: UIMessageStreamWriter
): Promise<AITeamMemberResult> {
    const { jobId, userEmail, prompt, messages = [], jobContext } = input;
    const startTime = Date.now();

    const aiTeamLogger = logger.child({ jobId, userEmail });
    aiTeamLogger.info(
        { prompt: prompt.slice(0, 100) },
        "🤖 Starting streaming AI Team member execution"
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

                // Prepare messages
                const prunedMessages = pruneModelMessages(messages, {
                    mode: "employee",
                });

                // Build messages based on whether we have new AI Team context
                let allMessages: ModelMessage[];

                if (jobContext) {
                    // New AI Team framework: static system + dynamic user prompt
                    allMessages = [
                        { role: "system", content: AI_TEAM_SYSTEM_PROMPT },
                        ...prunedMessages,
                        {
                            role: "user" as const,
                            content: buildAITeamUserPrompt(jobContext),
                        },
                    ];
                } else {
                    // Legacy: combined system prompt
                    const systemPrompt = buildLegacyAITeamMemberPrompt(prompt);
                    allMessages = [
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
                }

                const gateway = getGatewayClient();
                const primaryModel = AI_TEAM_MODEL_CHAIN[0];
                let completeCallData: Partial<CompleteToolParams> | null = null;

                // Stream execution
                const result = streamText({
                    model: gateway(translateModelId(primaryModel)),
                    messages: allMessages,
                    tools: allTools,
                    stopWhen: [hasToolCall("complete"), stepCountIs(MAX_STEPS)],
                    providerOptions: {
                        gateway: {
                            models: AI_TEAM_MODEL_CHAIN.map(translateModelId),
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
                aiTeamLogger.debug({}, "⏳ Waiting for stream response to complete...");

                // Wait for the full text to ensure stream is consumed
                const fullText = await result.text;
                aiTeamLogger.debug(
                    { textLength: fullText?.length ?? 0 },
                    "✅ Full text received from stream"
                );

                const steps = await result.steps;

                // Log the raw structure for debugging
                aiTeamLogger.info(
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

                aiTeamLogger.info(
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

                    aiTeamLogger.info(
                        {
                            summary: completion.summary,
                            notificationCount: completion.notifications?.length ?? 0,
                            toolCallsExecuted,
                            durationMs,
                        },
                        "✅ Streaming employee completed task"
                    );

                    // Map status to success boolean for backward compatibility
                    const status = (completion.status ?? "success") as AITeamStatus;
                    const isSuccess = status === "success" || status === "partial";

                    return {
                        success: isSuccess,
                        summary: completion.summary,
                        notifications: completion.notifications ?? [],
                        toolCallsExecuted,
                        status,
                        updatedNotes: completion.notes ?? undefined,
                        blockedReason: completion.blockedReason ?? undefined,
                        executionTrace,
                        tokenUsage,
                        modelId: primaryModel,
                        durationMs,
                        sentryTraceId,
                    };
                }

                // No explicit completion
                writeStatus(writer, `job-${jobId}-complete`, "Task finished", "✅");

                aiTeamLogger.warn(
                    { text: fullText.slice(0, 200) },
                    "⚠️ Streaming employee finished without calling complete tool"
                );

                return {
                    success: true,
                    summary: fullText || "Task completed without explicit summary.",
                    notifications: [],
                    toolCallsExecuted,
                    status: "success" as AITeamStatus,
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

                aiTeamLogger.error(
                    { error },
                    "❌ Streaming AI Team member execution failed"
                );
                Sentry.captureException(error, {
                    tags: { component: "ai-team", agent: "ai-team-member-stream" },
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
                    toolCallsExecuted,
                    errorDetails,
                    modelId: AI_TEAM_MODEL_CHAIN[0],
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
