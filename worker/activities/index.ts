/**
 * Temporal Activities - External operations with retry logic
 *
 * Activities are where non-deterministic work happens:
 * - API calls (LLM)
 * - Database operations
 *
 * Each activity can fail and be automatically retried by Temporal.
 */

import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "../../lib/db";
import { scheduledJobs, jobRuns, jobNotifications, users } from "../../lib/db/schema";
import {
    runEmployee,
    runEmployeeStreaming,
    type EmployeeResult,
} from "../../lib/agents/employee";
import { getBackgroundStreamContext } from "../../lib/streaming/stream-context";
import { logger } from "../../lib/logger";

/**
 * Extended job context including user information for employee agent
 */
export interface FullJobContext {
    jobId: string;
    userId: string;
    userEmail: string;
    prompt: string;
    memory: Record<string, unknown>;
}

/**
 * Load full job context including user email for employee execution
 */
export async function loadFullJobContext(jobId: string): Promise<FullJobContext> {
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

    return {
        jobId: job.id,
        userId: job.userId,
        userEmail: user.email,
        prompt: job.prompt,
        memory: (job.memory as Record<string, unknown>) || {},
    };
}

/**
 * Execute job using the AI employee agent with full tool support
 *
 * This is the new execution path that uses Vercel AI SDK with
 * the same tools available to the main chat interface.
 */
export async function executeEmployee(
    context: FullJobContext
): Promise<EmployeeResult> {
    return runEmployee({
        jobId: context.jobId,
        userId: context.userId,
        userEmail: context.userEmail,
        prompt: context.prompt,
        memory: context.memory,
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
export async function executeStreamingEmployee(
    context: FullJobContext,
    streamId: string
): Promise<EmployeeResult> {
    const streamContext = getBackgroundStreamContext();

    if (!streamContext) {
        throw new Error("Redis not configured - cannot run streaming job");
    }

    const activityLogger = logger.child({
        jobId: context.jobId,
        streamId,
        activity: "executeStreamingEmployee",
    });

    activityLogger.info({}, "🚀 Starting streaming employee execution");

    let employeeResult: EmployeeResult | null = null;

    // Create UI message stream that wraps employee execution
    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            employeeResult = await runEmployeeStreaming(
                {
                    jobId: context.jobId,
                    userId: context.userId,
                    userEmail: context.userEmail,
                    prompt: context.prompt,
                    memory: context.memory,
                },
                writer
            );
        },
    });

    // Pipe through resumable stream to Redis
    const resumableStream = await streamContext.createNewResumableStream(streamId, () =>
        stream.pipeThrough(new JsonToSseTransformStream())
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
    const result = employeeResult as EmployeeResult;

    activityLogger.info(
        { success: result.success, toolCalls: result.toolCallsExecuted },
        "✅ Streaming employee execution complete"
    );

    return result;
}

/**
 * Record employee run results to database
 */
export async function recordEmployeeRun(
    jobId: string,
    userId: string,
    result: EmployeeResult
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
    const [run] = await db
        .insert(jobRuns)
        .values({
            jobId,
            status: "running",
            startedAt: new Date(),
        })
        .returning();

    return run.id;
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
    result: EmployeeResult
): Promise<void> {
    // Update the run record with results and observability data
    await db
        .update(jobRuns)
        .set({
            status: result.success ? "completed" : "failed",
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

// Re-export background response activities
export * from "./background-response";
