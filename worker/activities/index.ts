/**
 * Temporal Activities - External operations with retry logic
 *
 * Activities are where non-deterministic work happens:
 * - API calls (LLM, integrations)
 * - Database operations
 * - External service communication
 *
 * Each activity can fail and be automatically retried by Temporal.
 */

import { db } from "../../lib/db";
import { scheduledJobs, jobRuns, jobNotifications } from "../../lib/db/schema";
import { eq } from "drizzle-orm";

// Environment configuration
const MCP_HUBBY_URL = process.env.MCP_HUBBY_URL || "http://localhost:8787";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Types
export interface JobContext {
    prompt: string;
    integrations: string[];
    memory: Record<string, unknown>;
}

export interface LLMRequest {
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    memory: Record<string, unknown>;
    availableTools: string[];
}

export interface LLMResponse {
    type: "text" | "tool_call";
    content?: string;
    isComplete?: boolean;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
}

export interface IntegrationRequest {
    userId: string;
    service: string;
    action: string;
    params: Record<string, unknown>;
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
    toolCallsExecuted: number;
    notificationsSent: number;
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
        integrations: job.integrations || [],
        memory: (job.memory as Record<string, unknown>) || {},
    };
}

/**
 * Call LLM via OpenRouter
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY not configured");
    }

    const { systemPrompt, messages, memory, availableTools } = request;

    // Build tools array for function calling
    const tools = [
        {
            type: "function",
            function: {
                name: "notify_user",
                description: "Send a notification to the user",
                parameters: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "Notification title" },
                        body: { type: "string", description: "Notification body" },
                        priority: {
                            type: "string",
                            enum: ["low", "normal", "high", "urgent"],
                            description: "Notification priority",
                        },
                    },
                    required: ["title", "body"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "update_memory",
                description: "Store information for future runs",
                parameters: {
                    type: "object",
                    properties: {
                        updates: {
                            type: "object",
                            description: "Key-value pairs to store in memory",
                        },
                    },
                    required: ["updates"],
                },
            },
        },
        // Add integration tools dynamically
        ...availableTools.map((service) => ({
            type: "function",
            function: {
                name: service,
                description: `Execute an action on ${service}. Use action="describe" to see available operations.`,
                parameters: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            description: "The action to perform",
                        },
                        params: {
                            type: "object",
                            description: "Parameters for the action",
                        },
                    },
                    required: ["action"],
                },
            },
        })),
    ];

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
            tools,
            tool_choice: "auto",
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM call failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        return {
            type: "tool_call",
            toolName: toolCall.function.name,
            toolArgs: JSON.parse(toolCall.function.arguments),
        };
    }

    // Text response
    const content = message.content || "";
    const isComplete = content.includes("TASK_COMPLETE");

    return {
        type: "text",
        content: content.replace("TASK_COMPLETE", "").trim(),
        isComplete,
    };
}

/**
 * Execute integration via MCP-Hubby gateway
 */
export async function executeIntegration(
    request: IntegrationRequest
): Promise<unknown> {
    const { userId, service, action, params } = request;

    const response = await fetch(`${MCP_HUBBY_URL}/api/execute`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-User-Email": userId, // MCP-Hubby uses email for auth
        },
        body: JSON.stringify({
            service,
            action,
            params,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Integration call failed: ${response.status} ${error}`);
    }

    return response.json();
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

    // Map priority string to enum value
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
    const { jobId, status, summary, messages, toolCallsExecuted, notificationsSent } =
        record;

    // Map status string to enum value
    const statusEnum = status as "pending" | "running" | "completed" | "failed";

    await db.insert(jobRuns).values({
        jobId,
        status: statusEnum,
        summary,
        messages,
        toolCallsExecuted,
        notificationsSent,
        completedAt: new Date(),
    });

    // Update last run time on job
    await db
        .update(scheduledJobs)
        .set({ lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduledJobs.id, jobId));
}
