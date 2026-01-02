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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Default model for scheduled jobs (see lib/model-config.ts for full list)
const SCHEDULED_JOB_MODEL = "anthropic/claude-sonnet-4.5";

// Types
export interface JobContext {
    prompt: string;
    memory: Record<string, unknown>;
}

export interface LLMRequest {
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    memory: Record<string, unknown>;
}

export interface LLMResponse {
    content: string;
}

export interface NotificationRequest {
    userId: string;
    jobId: string;
    title: string;
    body: string;
    priority: string;
}

export interface JobRunRecord {
    jobId: string;
    status: string;
    summary: string;
    messages: Array<{ role: string; content: string }>;
}

/**
 * Load job configuration and memory from database
 */
export async function loadJobContext(jobId: string): Promise<JobContext> {
    const job = await db.query.scheduledJobs.findFirst({
        where: eq(scheduledJobs.id, jobId),
    });

    if (!job) {
        throw new Error(`Job not found: ${jobId}`);
    }

    return {
        prompt: job.prompt,
        memory: (job.memory as Record<string, unknown>) || {},
    };
}

/**
 * Call LLM via OpenRouter
 *
 * Simple completion - no tools. Tool support will be added
 * when we wire up internal integrations.
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY not configured");
    }

    const { systemPrompt, messages, memory } = request;

    // Include memory context in system prompt
    const memoryContext =
        Object.keys(memory).length > 0
            ? `\n\nPrevious run memory:\n${JSON.stringify(memory, null, 2)}`
            : "";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://carmenta.ai",
            "X-Title": "Carmenta Scheduled Agent",
        },
        body: JSON.stringify({
            model: SCHEDULED_JOB_MODEL,
            messages: [
                { role: "system", content: systemPrompt + memoryContext },
                ...messages,
            ],
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM call failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    return { content };
}

/**
 * Update job memory for future runs
 */
export async function updateJobMemory(
    jobId: string,
    updates: Record<string, unknown>
): Promise<void> {
    const job = await db.query.scheduledJobs.findFirst({
        where: eq(scheduledJobs.id, jobId),
    });

    if (!job) {
        throw new Error(`Job not found: ${jobId}`);
    }

    const currentMemory = (job.memory as Record<string, unknown>) || {};
    const newMemory = { ...currentMemory, ...updates };

    await db
        .update(scheduledJobs)
        .set({ memory: newMemory, updatedAt: new Date() })
        .where(eq(scheduledJobs.id, jobId));
}

/**
 * Create a notification for the user
 */
export async function createNotification(request: NotificationRequest): Promise<void> {
    const { userId, jobId, title, body, priority } = request;

    const priorityEnum = priority as "low" | "normal" | "high" | "urgent";

    await db.insert(jobNotifications).values({
        userId,
        jobId,
        title,
        body,
        priority: priorityEnum,
    });
}

/**
 * Record job run in database for visibility
 */
export async function recordJobRun(record: JobRunRecord): Promise<void> {
    const { jobId, status, summary, messages } = record;

    const statusEnum = status as "pending" | "running" | "completed" | "failed";

    await db.insert(jobRuns).values({
        jobId,
        status: statusEnum,
        summary,
        messages,
        toolCallsExecuted: 0,
        notificationsSent: 0,
        completedAt: new Date(),
    });

    // Update last run time on job
    await db
        .update(scheduledJobs)
        .set({ lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduledJobs.id, jobId));
}

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
    // Insert job run record
    await db.insert(jobRuns).values({
        jobId,
        status: result.success ? "completed" : "failed",
        summary: result.summary,
        messages: [],
        toolCallsExecuted: result.toolCallsExecuted,
        notificationsSent: result.notifications.length,
        completedAt: new Date(),
    });

    // Create notifications
    for (const notification of result.notifications) {
        await db.insert(jobNotifications).values({
            userId,
            jobId,
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
