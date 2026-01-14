/**
 * Temporal Activities - External operations with retry logic
 *
 * Activities are where non-deterministic work happens:
 * - API calls (LLM)
 * - Database operations
 *
 * Each activity can fail and be automatically retried by Temporal.
 * Errors are captured in Sentry BEFORE Temporal wraps them in ActivityFailure.
 */

import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { eq, count, and, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "../../lib/db";
import { scheduledJobs, jobRuns, jobNotifications, users } from "../../lib/db/schema";
import {
    runAITeamMember,
    runAITeamMemberStreaming,
    type AITeamMemberResult,
    type AITeamJobContext,
} from "../../lib/agents/ai-team-member";
import { getBackgroundStreamContext } from "../../lib/streaming/stream-context";
import { logger } from "../../lib/logger";
import { captureActivityError } from "../lib/activity-sentry";

/**
 * Extended job context including user information for employee agent
 */
export interface FullJobContext {
    jobId: string;
    userId: string;
    userEmail: string;
    prompt: string;
    memory: Record<string, unknown>;

    /** New AI Team framework context */
    jobContext?: AITeamJobContext;
}

/**
 * Load full job context including user email for employee execution
 */
export async function loadFullJobContext(jobId: string): Promise<FullJobContext> {
    try {
        const job = await db.query.scheduledJobs.findFirst({
            where: eq(scheduledJobs.id, jobId),
        });

        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }

        // Get user email for integration access
        const user = await db.query.users.findFirst({
            where: eq(users.id, job.userId),
        });

        if (!user) {
            throw new Error(`User not found for job: ${jobId}`);
        }

        // Get run stats for AI Team context
        const [totalRunsResult, successRunsResult] = await Promise.all([
            db.select({ count: count() }).from(jobRuns).where(eq(jobRuns.jobId, jobId)),
            db
                .select({ count: count() })
                .from(jobRuns)
                .where(
                    and(
                        eq(jobRuns.jobId, jobId),
                        inArray(jobRuns.status, ["completed", "partial"])
                    )
                ),
        ]);

        const totalRuns = totalRunsResult[0]?.count ?? 0;
        const totalSuccesses = successRunsResult[0]?.count ?? 0;

        // Get last run info
        const lastRun = await db.query.jobRuns.findFirst({
            where: eq(jobRuns.jobId, jobId),
            orderBy: [desc(jobRuns.startedAt)],
        });

        // Build AI Team job context (new framework)
        const jobContext: AITeamJobContext = {
            jobId: job.id,
            jobName: job.name,
            scheduleDisplay: job.scheduleDisplayText || job.scheduleCron,
            totalRuns,
            totalSuccesses,
            lastRunAt: lastRun?.completedAt?.toISOString() ?? null,
            lastRunOutcome: lastRun?.status ?? null,
            agentNotes: job.agentNotes ?? "",
            userConfig: (job.userConfig as Record<string, unknown>) ?? {},
            task: job.prompt,
        };

        return {
            jobId: job.id,
            userId: job.userId,
            userEmail: user.email,
            prompt: job.prompt,
            memory: (job.memory as Record<string, unknown>) || {},
            jobContext,
        };
    } catch (error) {
        captureActivityError(error, {
            activityName: "loadFullJobContext",
            jobId,
        });
        throw error;
    }
}

/**
 * Execute job using the AI employee agent with full tool support
 *
 * This is the new execution path that uses Vercel AI SDK with
 * the same tools available to the main chat interface.
 */
export async function executeAITeamMember(
    context: FullJobContext
): Promise<AITeamMemberResult> {
    return runAITeamMember({
        jobId: context.jobId,
        userId: context.userId,
        userEmail: context.userEmail,
        prompt: context.prompt,
        memory: context.memory,
        jobContext: context.jobContext,
    });
}

/**
 * Generate a unique stream ID for a job run.
 * Called in workflow before execution so we can save it to DB first.
 */
export async function generateJobStreamId(jobId: string): Promise<string> {
    return `job-${jobId}-${nanoid(8)}`;
}

/**
 * Execute job using the AI employee agent with streaming to Redis.
 *
 * This is the streaming execution path that allows users to "tap in"
 * and watch the agent work in real-time.
 *
 * @param context - Job context with prompt, user info, memory
 * @param streamId - Pre-generated stream ID (already saved to DB)
 */
export async function executeStreamingAITeamMember(
    context: FullJobContext,
    streamId: string
): Promise<AITeamMemberResult> {
    const activityLogger = logger.child({
        jobId: context.jobId,
        streamId,
        activity: "executeStreamingAITeamMember",
    });

    try {
        // Infrastructure setup - let Temporal retry these if they fail
        const streamContext = getBackgroundStreamContext();

        if (!streamContext) {
            throw new Error("Redis not configured - cannot run streaming job");
        }

        activityLogger.info({}, "🚀 Starting streaming employee execution");

        let employeeResult: AITeamMemberResult | null = null;

        // Create UI message stream that wraps employee execution
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                employeeResult = await runAITeamMemberStreaming(
                    {
                        jobId: context.jobId,
                        userId: context.userId,
                        userEmail: context.userEmail,
                        prompt: context.prompt,
                        memory: context.memory,
                        jobContext: context.jobContext,
                    },
                    writer
                );
            },
        });

        // Pipe through resumable stream to Redis - let Temporal retry if this fails
        const resumableStream = await streamContext.createNewResumableStream(
            streamId,
            () => stream.pipeThrough(new JsonToSseTransformStream())
        );

        if (!resumableStream) {
            throw new Error("Failed to create resumable stream");
        }

        // Consume the stream to completion
        const reader = resumableStream.getReader();
        while (true) {
            const { done } = await reader.read();
            if (done) break;
        }

        // Verify we got a result
        if (!employeeResult) {
            throw new Error("Failed to capture employee result from stream");
        }

        // TypeScript narrowing doesn't work after async callbacks - use explicit type
        const result = employeeResult as AITeamMemberResult;

        activityLogger.info(
            {
                success: result.success,
                toolCalls: result.toolCallsExecuted,
                hasExecutionTrace: !!result.executionTrace,
                traceStepCount: result.executionTrace?.steps?.length ?? 0,
                hasTokenUsage: !!result.tokenUsage,
                modelId: result.modelId,
                durationMs: result.durationMs,
            },
            "✅ Streaming employee execution complete"
        );

        // Return the result (may be success or failure from employee execution)
        // Employee failures are permanent and should not be retried
        // Infrastructure failures above this point will throw and trigger Temporal retry
        return result;
    } catch (error) {
        captureActivityError(error, {
            activityName: "executeStreamingAITeamMember",
            jobId: context.jobId,
            userId: context.userId,
            streamId,
        });
        throw error;
    }
}

/**
 * Record employee run results to database
 */
export async function recordEmployeeRun(
    jobId: string,
    userId: string,
    result: AITeamMemberResult
): Promise<void> {
    // Insert job run record and capture the ID
    const [jobRun] = await db
        .insert(jobRuns)
        .values({
            jobId,
            status: result.success ? "completed" : "failed",
            summary: result.summary,
            messages: [],
            toolCallsExecuted: result.toolCallsExecuted,
            notificationsSent: result.notifications.length,
            completedAt: new Date(),
        })
        .returning();

    // Create notifications linked to this run
    for (const notification of result.notifications) {
        await db.insert(jobNotifications).values({
            userId,
            jobId,
            runId: jobRun.id,
            title: notification.title,
            body: notification.body,
            priority: notification.priority,
        });
    }

    // Update job with new memory and last run time
    await db
        .update(scheduledJobs)
        .set({
            memory: result.updatedMemory,
            lastRunAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.id, jobId));
}

/**
 * Create a job run record before execution starts.
 * This allows the UI to show "running" state immediately.
 */
export async function createJobRun(jobId: string): Promise<string> {
    try {
        const [run] = await db
            .insert(jobRuns)
            .values({
                jobId,
                status: "running",
                startedAt: new Date(),
            })
            .returning();

        return run.id;
    } catch (error) {
        captureActivityError(error, {
            activityName: "createJobRun",
            jobId,
        });
        throw error;
    }
}

/**
 * Update job run with stream ID for live progress viewing.
 */
export async function updateJobRunStreamId(
    runId: string,
    streamId: string
): Promise<void> {
    await db
        .update(jobRuns)
        .set({ activeStreamId: streamId })
        .where(eq(jobRuns.id, runId));
}

/**
 * Clear job run stream ID when execution completes.
 */
export async function clearJobRunStreamId(runId: string): Promise<void> {
    await db.update(jobRuns).set({ activeStreamId: null }).where(eq(jobRuns.id, runId));
}

/**
 * Update job run with final results including observability data.
 */
export async function finalizeJobRun(
    runId: string,
    jobId: string,
    userId: string,
    result: AITeamMemberResult
): Promise<void> {
    const activityLogger = logger.child({
        runId,
        jobId,
        activity: "finalizeJobRun",
    });

    activityLogger.info(
        {
            resultSuccess: result.success,
            hasExecutionTrace: !!result.executionTrace,
            executionTraceSteps: result.executionTrace?.steps?.length ?? 0,
            hasFinalText: !!result.executionTrace?.finalText,
            hasTokenUsage: !!result.tokenUsage,
            hasErrorDetails: !!result.errorDetails,
            modelId: result.modelId,
            durationMs: result.durationMs,
        },
        "📝 Finalizing job run with results"
    );

    try {
        // Map AI Team status to database status
        // "success" → "completed", others map directly with validation
        const mapStatusToDb = (
            status: string | undefined,
            success: boolean
        ): "completed" | "partial" | "failed" | "blocked" => {
            if (!status) return success ? "completed" : "failed";
            if (status === "success") return "completed";
            const validStatuses = ["partial", "failed", "blocked"] as const;
            if (validStatuses.includes(status as (typeof validStatuses)[number])) {
                return status as "partial" | "failed" | "blocked";
            }
            // Unknown status - fall back to success/failed based on boolean
            return success ? "completed" : "failed";
        };
        const dbStatus = mapStatusToDb(result.status, result.success);

        // Update the run record with results and observability data
        await db
            .update(jobRuns)
            .set({
                status: dbStatus,
                summary: result.summary,
                toolCallsExecuted: result.toolCallsExecuted,
                notificationsSent: result.notifications.length,
                completedAt: new Date(),
                activeStreamId: null,
                // Observability fields
                executionTrace: result.executionTrace,
                errorDetails: result.errorDetails,
                tokenUsage: result.tokenUsage,
                modelId: result.modelId,
                durationMs: result.durationMs,
                sentryTraceId: result.sentryTraceId,
            })
            .where(eq(jobRuns.id, runId));

        // Create notifications linked to this run
        for (const notification of result.notifications) {
            await db.insert(jobNotifications).values({
                userId,
                jobId,
                runId,
                title: notification.title,
                body: notification.body,
                priority: notification.priority,
            });
        }

        // Build job update - always update memory and lastRunAt
        const jobUpdate: Record<string, unknown> = {
            memory: result.updatedMemory,
            lastRunAt: new Date(),
            updatedAt: new Date(),
        };

        // Save agent notes if provided (new AI Team framework)
        if (result.updatedNotes !== undefined) {
            jobUpdate.agentNotes = result.updatedNotes;
        }

        // Update job with new memory, notes, and last run time
        await db
            .update(scheduledJobs)
            .set(jobUpdate)
            .where(eq(scheduledJobs.id, jobId));
    } catch (error) {
        captureActivityError(error, {
            activityName: "finalizeJobRun",
            runId,
            jobId,
            userId,
            resultSuccess: result.success,
        });
        throw error;
    }
}

// Re-export background response activities
export * from "./background-response";

// Re-export import librarian activities
export * from "./import-librarian";
