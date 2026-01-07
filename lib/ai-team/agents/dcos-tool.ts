/**
 * DCOS Tool for Carmenta
 *
 * Digital Chief of Staff - manages AI team members (automations users create).
 * Uses progressive disclosure pattern - action='describe' returns full docs.
 *
 * Actions:
 * - describe: Returns full operation documentation
 * - list: List all automations for the user
 * - get: Get details of a specific automation by ID or name
 * - update: Update prompt, name, or integrations
 * - runs: Get run history for an automation
 * - run: Get details of a specific run including execution trace
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { eq, and, desc, ilike } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { scheduledJobs, jobRuns } from "@/lib/db/schema";
import { encodeJobId, decodeJobId, isValidJobId } from "@/lib/sqids";
import {
    type SubagentResult,
    type SubagentDescription,
    type SubagentContext,
    successResult,
    errorResult,
} from "@/lib/ai-team/dcos/types";
import { safeInvoke } from "@/lib/ai-team/dcos/utils";

/**
 * DCOS subagent ID
 */
const DCOS_ID = "dcos";

/**
 * Maximum runs to return in a single query
 * Prevents unbounded memory usage from large limit values
 */
const MAX_RUNS_LIMIT = 100;

/**
 * Describe DCOS operations for progressive disclosure
 */
function describeOperations(): SubagentDescription {
    return {
        id: DCOS_ID,
        name: "Digital Chief of Staff",
        summary:
            "Manages AI team members (automations) - list, view details, update prompts, and view run history.",
        operations: [
            {
                name: "list",
                description:
                    "List all AI team members (automations) for the user. Returns name, status, schedule, and last run.",
                params: [],
            },
            {
                name: "get",
                description:
                    "Get details of a specific automation by encoded ID or by name (fuzzy match).",
                params: [
                    {
                        name: "id",
                        type: "string",
                        description: "Encoded job ID (from URL or list results)",
                        required: false,
                    },
                    {
                        name: "name",
                        type: "string",
                        description: "Automation name (case-insensitive partial match)",
                        required: false,
                    },
                ],
            },
            {
                name: "update",
                description:
                    "Update an automation's prompt, name, or integrations. Cannot change schedule (use UI for that).",
                params: [
                    {
                        name: "id",
                        type: "string",
                        description: "Encoded job ID to update",
                        required: true,
                    },
                    {
                        name: "prompt",
                        type: "string",
                        description: "New prompt/instructions (omit to keep existing)",
                        required: false,
                    },
                    {
                        name: "name",
                        type: "string",
                        description: "New name (omit to keep existing)",
                        required: false,
                    },
                    {
                        name: "integrations",
                        type: "string[]",
                        description: "New integrations list (omit to keep existing)",
                        required: false,
                    },
                ],
            },
            {
                name: "runs",
                description:
                    "Get run history for an automation. Returns recent runs with status and summary.",
                params: [
                    {
                        name: "id",
                        type: "string",
                        description: "Encoded job ID",
                        required: true,
                    },
                    {
                        name: "limit",
                        type: "number",
                        description: "Max runs to return (default: 10)",
                        required: false,
                    },
                ],
            },
            {
                name: "run",
                description:
                    "Get details of a specific run including execution trace, tool calls, and errors.",
                params: [
                    {
                        name: "runId",
                        type: "string",
                        description: "Run UUID",
                        required: true,
                    },
                ],
            },
        ],
    };
}

// ============================================================================
// Data Types
// ============================================================================

interface AutomationSummary {
    id: string; // Encoded seqId
    name: string;
    isActive: boolean;
    schedule: string | null;
    timezone: string;
    integrations: string[];
    lastRunAt: Date | null;
    nextRunAt: Date | null;
}

interface AutomationDetail extends AutomationSummary {
    prompt: string;
    createdAt: Date;
}

interface RunSummary {
    id: string;
    status: string;
    summary: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    durationMs: number | null;
    toolCallsExecuted: number;
    notificationsSent: number;
}

interface RunDetail extends RunSummary {
    error: string | null;
    executionTrace: unknown;
    errorDetails: unknown;
    modelId: string | null;
    sentryTraceId: string | null;
}

// ============================================================================
// Action Implementations
// ============================================================================

/**
 * List all automations for the user
 */
async function executeList(
    context: SubagentContext
): Promise<SubagentResult<{ automations: AutomationSummary[]; total: number }>> {
    try {
        const jobs = await db.query.scheduledJobs.findMany({
            where: eq(scheduledJobs.userId, context.userId),
            orderBy: [desc(scheduledJobs.createdAt)],
        });

        const automations: AutomationSummary[] = jobs.map((job) => ({
            id: encodeJobId(job.seqId),
            name: job.name,
            isActive: job.isActive,
            schedule: job.scheduleDisplayText,
            timezone: job.timezone,
            integrations: job.integrations,
            lastRunAt: job.lastRunAt,
            nextRunAt: job.nextRunAt,
        }));

        logger.info(
            { userId: context.userId, count: automations.length },
            "📋 DCOS list completed"
        );

        return successResult({ automations, total: automations.length });
    } catch (error) {
        logger.error({ error, userId: context.userId }, "📋 DCOS list failed");

        Sentry.captureException(error, {
            tags: { component: "dcos", action: "list" },
            extra: { userId: context.userId },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to list automations"
        );
    }
}

/**
 * Get details of a specific automation
 */
async function executeGet(
    params: { id?: string; name?: string },
    context: SubagentContext
): Promise<SubagentResult<{ automation: AutomationDetail | null; found: boolean }>> {
    try {
        let job;

        if (params.id) {
            // Look up by encoded ID
            if (!isValidJobId(params.id)) {
                return errorResult("VALIDATION", `Invalid job ID format: ${params.id}`);
            }

            const seqId = decodeJobId(params.id);
            if (seqId === null) {
                return errorResult(
                    "VALIDATION",
                    `Failed to decode job ID: ${params.id}`
                );
            }

            job = await db.query.scheduledJobs.findFirst({
                where: and(
                    eq(scheduledJobs.seqId, seqId),
                    eq(scheduledJobs.userId, context.userId)
                ),
            });
        } else if (params.name) {
            // Look up by name (case-insensitive partial match)
            // Escape SQL wildcards to prevent unexpected pattern matching
            const escapedName = params.name.replace(/[%_]/g, "\\$&");
            job = await db.query.scheduledJobs.findFirst({
                where: and(
                    ilike(scheduledJobs.name, `%${escapedName}%`),
                    eq(scheduledJobs.userId, context.userId)
                ),
            });
        } else {
            return errorResult("VALIDATION", "Either id or name is required for get");
        }

        if (!job) {
            return successResult({ automation: null, found: false });
        }

        const automation: AutomationDetail = {
            id: encodeJobId(job.seqId),
            name: job.name,
            prompt: job.prompt,
            isActive: job.isActive,
            schedule: job.scheduleDisplayText,
            timezone: job.timezone,
            integrations: job.integrations,
            lastRunAt: job.lastRunAt,
            nextRunAt: job.nextRunAt,
            createdAt: job.createdAt,
        };

        logger.info(
            { userId: context.userId, jobId: job.id, name: job.name },
            "📋 DCOS get completed"
        );

        return successResult({ automation, found: true });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, id: params.id, name: params.name },
            "📋 DCOS get failed"
        );

        Sentry.captureException(error, {
            tags: { component: "dcos", action: "get" },
            extra: { userId: context.userId, ...params },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to get automation"
        );
    }
}

/**
 * Update an automation's prompt, name, or integrations
 */
async function executeUpdate(
    params: { id: string; prompt?: string; name?: string; integrations?: string[] },
    context: SubagentContext
): Promise<SubagentResult<{ updated: boolean; automation: AutomationDetail | null }>> {
    try {
        // Validate ID
        if (!isValidJobId(params.id)) {
            return errorResult("VALIDATION", `Invalid job ID format: ${params.id}`);
        }

        const seqId = decodeJobId(params.id);
        if (seqId === null) {
            return errorResult("VALIDATION", `Failed to decode job ID: ${params.id}`);
        }

        // Find the job first
        // Note: validateParams already ensures at least one update field is present
        const existingJob = await db.query.scheduledJobs.findFirst({
            where: and(
                eq(scheduledJobs.seqId, seqId),
                eq(scheduledJobs.userId, context.userId)
            ),
        });

        if (!existingJob) {
            return successResult({ updated: false, automation: null });
        }

        // Build update object
        const updates: Partial<{
            prompt: string;
            name: string;
            integrations: string[];
        }> = {};

        if (params.prompt !== undefined) updates.prompt = params.prompt;
        if (params.name !== undefined) updates.name = params.name;
        if (params.integrations !== undefined)
            updates.integrations = params.integrations;

        // Perform update
        const [updatedJob] = await db
            .update(scheduledJobs)
            .set(updates)
            .where(
                and(
                    eq(scheduledJobs.seqId, seqId),
                    eq(scheduledJobs.userId, context.userId)
                )
            )
            .returning();

        if (!updatedJob) {
            return successResult({ updated: false, automation: null });
        }

        const automation: AutomationDetail = {
            id: encodeJobId(updatedJob.seqId),
            name: updatedJob.name,
            prompt: updatedJob.prompt,
            isActive: updatedJob.isActive,
            schedule: updatedJob.scheduleDisplayText,
            timezone: updatedJob.timezone,
            integrations: updatedJob.integrations,
            lastRunAt: updatedJob.lastRunAt,
            nextRunAt: updatedJob.nextRunAt,
            createdAt: updatedJob.createdAt,
        };

        logger.info(
            {
                userId: context.userId,
                jobId: updatedJob.id,
                name: updatedJob.name,
                fieldsUpdated: Object.keys(updates),
            },
            "✅ DCOS update completed"
        );

        return successResult({ updated: true, automation });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, id: params.id },
            "📋 DCOS update failed"
        );

        Sentry.captureException(error, {
            tags: { component: "dcos", action: "update" },
            extra: { userId: context.userId, id: params.id },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to update automation"
        );
    }
}

/**
 * Get run history for an automation
 */
async function executeRuns(
    params: { id: string; limit?: number },
    context: SubagentContext
): Promise<SubagentResult<{ runs: RunSummary[]; total: number }>> {
    try {
        // Validate ID
        if (!isValidJobId(params.id)) {
            return errorResult("VALIDATION", `Invalid job ID format: ${params.id}`);
        }

        const seqId = decodeJobId(params.id);
        if (seqId === null) {
            return errorResult("VALIDATION", `Failed to decode job ID: ${params.id}`);
        }

        // Find the job first to get internal ID
        const job = await db.query.scheduledJobs.findFirst({
            where: and(
                eq(scheduledJobs.seqId, seqId),
                eq(scheduledJobs.userId, context.userId)
            ),
        });

        if (!job) {
            return errorResult("VALIDATION", `Automation not found: ${params.id}`);
        }

        // Get runs with bounds checking
        // Clamp to [1, MAX_RUNS_LIMIT] - negative values would remove LIMIT in Postgres
        const limit = Math.min(Math.max(params.limit ?? 10, 1), MAX_RUNS_LIMIT);
        const runs = await db.query.jobRuns.findMany({
            where: eq(jobRuns.jobId, job.id),
            orderBy: [desc(jobRuns.createdAt)],
            limit,
        });

        const runSummaries: RunSummary[] = runs.map((run) => ({
            id: run.id,
            status: run.status,
            summary: run.summary,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            durationMs: run.durationMs,
            toolCallsExecuted: run.toolCallsExecuted,
            notificationsSent: run.notificationsSent,
        }));

        logger.info(
            { userId: context.userId, jobId: job.id, runCount: runSummaries.length },
            "📋 DCOS runs completed"
        );

        return successResult({ runs: runSummaries, total: runSummaries.length });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, id: params.id },
            "📋 DCOS runs failed"
        );

        Sentry.captureException(error, {
            tags: { component: "dcos", action: "runs" },
            extra: { userId: context.userId, id: params.id },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to get run history"
        );
    }
}

/**
 * Get details of a specific run
 */
async function executeRun(
    params: { runId: string },
    context: SubagentContext
): Promise<SubagentResult<{ run: RunDetail | null; found: boolean }>> {
    try {
        // Get the run with its job for authorization
        const run = await db.query.jobRuns.findFirst({
            where: eq(jobRuns.id, params.runId),
            with: {
                job: true,
            },
        });

        if (!run) {
            return successResult({ run: null, found: false });
        }

        // Authorization check - user must own the job
        if (run.job.userId !== context.userId) {
            return successResult({ run: null, found: false });
        }

        const runDetail: RunDetail = {
            id: run.id,
            status: run.status,
            summary: run.summary,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            durationMs: run.durationMs,
            toolCallsExecuted: run.toolCallsExecuted,
            notificationsSent: run.notificationsSent,
            error: run.error,
            executionTrace: run.executionTrace,
            errorDetails: run.errorDetails,
            modelId: run.modelId,
            sentryTraceId: run.sentryTraceId,
        };

        logger.info(
            { userId: context.userId, runId: params.runId, status: run.status },
            "📋 DCOS run completed"
        );

        return successResult({ run: runDetail, found: true });
    } catch (error) {
        logger.error(
            { error, userId: context.userId, runId: params.runId },
            "📋 DCOS run failed"
        );

        Sentry.captureException(error, {
            tags: { component: "dcos", action: "run" },
            extra: { userId: context.userId, runId: params.runId },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to get run details"
        );
    }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * DCOS action parameter schema
 *
 * Flat object schema because discriminatedUnion produces oneOf which
 * AWS Bedrock doesn't support. All fields except action are optional;
 * validation happens in execute based on action type.
 */
const dcosActionSchema = z.object({
    action: z
        .enum(["describe", "list", "get", "update", "runs", "run"])
        .describe(
            "Operation to perform. Use 'describe' to see all available operations."
        ),
    // get, update, runs
    id: z.string().optional().describe("Encoded job ID"),
    // get
    name: z.string().optional().describe("Automation name for lookup"),
    // update
    prompt: z.string().optional().describe("New prompt/instructions"),
    integrations: z.array(z.string()).optional().describe("New integrations list"),
    // runs
    limit: z.number().optional().describe("Max results to return"),
    // run
    runId: z.string().optional().describe("Run UUID"),
});

type DCOSAction = z.infer<typeof dcosActionSchema>;

/**
 * Validate required fields for each action
 */
function validateParams(
    params: DCOSAction
): { valid: true } | { valid: false; error: string } {
    switch (params.action) {
        case "describe":
        case "list":
            return { valid: true };
        case "get":
            if (!params.id && !params.name) {
                return { valid: false, error: "Either id or name is required for get" };
            }
            return { valid: true };
        case "update":
            if (!params.id) {
                return { valid: false, error: "id is required for update" };
            }
            if (!params.prompt && !params.name && !params.integrations) {
                return {
                    valid: false,
                    error: "At least one of prompt, name, or integrations is required for update",
                };
            }
            return { valid: true };
        case "runs":
            if (!params.id) {
                return { valid: false, error: "id is required for runs" };
            }
            return { valid: true };
        case "run":
            if (!params.runId) {
                return { valid: false, error: "runId is required for run" };
            }
            return { valid: true };
        default:
            return { valid: false, error: `Unknown action: ${params.action}` };
    }
}

/**
 * Create the DCOS tool for Carmenta orchestrator
 *
 * Short description for tool list - use action='describe' for full docs.
 */
export function createDcosTool(context: SubagentContext) {
    return tool({
        description:
            "AI team management - list, view, update automations and their run history. Use action='describe' for operations.",
        inputSchema: dcosActionSchema,
        execute: async (params: DCOSAction) => {
            if (params.action === "describe") {
                return describeOperations();
            }

            // Validate required params for this action
            const validation = validateParams(params);
            if (!validation.valid) {
                logger.warn(
                    {
                        userId: context.userId,
                        action: params.action,
                        error: validation.error,
                    },
                    "📋 DCOS validation failed"
                );
                return errorResult("VALIDATION", validation.error);
            }

            // Wrap all executions with safety utilities
            const result = await safeInvoke(
                DCOS_ID,
                params.action,
                async (ctx) => {
                    switch (params.action) {
                        case "list":
                            return executeList(ctx);
                        case "get":
                            return executeGet(
                                { id: params.id, name: params.name },
                                ctx
                            );
                        case "update":
                            return executeUpdate(
                                {
                                    id: params.id!,
                                    prompt: params.prompt,
                                    name: params.name,
                                    integrations: params.integrations,
                                },
                                ctx
                            );
                        case "runs":
                            return executeRuns(
                                { id: params.id!, limit: params.limit },
                                ctx
                            );
                        case "run":
                            return executeRun({ runId: params.runId! }, ctx);
                        default:
                            return errorResult(
                                "VALIDATION",
                                `Unknown action: ${(params as { action: string }).action}`
                            );
                    }
                },
                context
            );

            return result;
        },
    });
}
