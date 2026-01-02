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
import { scheduledJobs, jobRuns, jobNotifications } from "../../lib/db/schema";
import { eq } from "drizzle-orm";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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
            model: "anthropic/claude-sonnet-4",
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

// Re-export background response activities
export * from "./background-response";
