/**
 * Temporal Activities - External operations with retry logic
 *
 * Activities are where non-deterministic work happens:
 * - API calls (LLM)
 * - Database operations
 *
 * Each activity can fail and be automatically retried by Temporal.
 */

import { db } from "../../lib/db";
import { scheduledJobs, jobRuns, jobNotifications, users } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { runEmployee, type EmployeeResult } from "../../lib/agents/employee";

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

// Re-export background response activities
export * from "./background-response";
