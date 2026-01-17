/**
 * Temporal Client
 *
 * Provides functions to interact with Temporal for:
 * - Creating/managing schedules for jobs
 * - Starting workflows manually
 * - Querying workflow status
 *
 * Background mode is DISABLED when TEMPORAL_ADDRESS env var is not set.
 * This allows deployments without Temporal infrastructure.
 */

import * as Sentry from "@sentry/nextjs";
import { Client, Connection, ScheduleAlreadyRunning } from "@temporalio/client";
import { logger } from "@/lib/logger";

// Singleton connection and client
let connection: Connection | null = null;
let client: Client | null = null;

const TASK_QUEUE = "scheduled-agents";

/**
 * Check if background mode is enabled (Temporal OR eager mode)
 *
 * - TEMPORAL_ADDRESS: Full Temporal infrastructure (durable, survives restarts)
 * - BACKGROUND_MODE_EAGER: Runs workflow logic inline (same process, no durability)
 *
 * Eager mode is like Celery's ALWAYS_EAGER - great for dev, but work is lost on restart.
 */
export function isBackgroundModeEnabled(): boolean {
    return !!process.env.TEMPORAL_ADDRESS || !!process.env.BACKGROUND_MODE_EAGER;
}

/**
 * Check if we're in eager mode (inline execution, no Temporal)
 */
export function isEagerMode(): boolean {
    return !process.env.TEMPORAL_ADDRESS && !!process.env.BACKGROUND_MODE_EAGER;
}

/**
 * Get or create the Temporal client
 * Throws if TEMPORAL_ADDRESS is not configured
 */
export async function getTemporalClient(): Promise<Client> {
    const address = process.env.TEMPORAL_ADDRESS;

    if (!address) {
        throw new Error(
            "Temporal not configured: TEMPORAL_ADDRESS environment variable is not set. " +
                "Background mode is disabled."
        );
    }

    if (client) {
        return client;
    }

    logger.info({ address }, "Connecting to Temporal");

    connection = await Connection.connect({ address });
    client = new Client({ connection });

    return client;
}

/**
 * Create a schedule for a job
 */
export async function createJobSchedule(params: {
    scheduleId: string;
    jobId: string;
    userId: string;
    cronExpression: string;
    timezone: string;
}): Promise<void> {
    const { scheduleId, jobId, userId, cronExpression, timezone } = params;
    const temporalClient = await getTemporalClient();

    try {
        await temporalClient.schedule.create({
            scheduleId,
            spec: {
                cronExpressions: [cronExpression],
                timezone,
            },
            action: {
                type: "startWorkflow",
                workflowType: "agentJobWorkflow",
                taskQueue: TASK_QUEUE,
                args: [{ jobId }],
            },
            policies: {
                // Skip if previous run is still in progress
                overlap: "SKIP",
                // Catch up missed runs within 1 hour (handles brief outages)
                catchupWindow: "1h",
            },
        });

        logger.info({ scheduleId, jobId, cronExpression }, "Created job schedule");
    } catch (error) {
        if (error instanceof ScheduleAlreadyRunning) {
            logger.warn({ scheduleId }, "Schedule already exists, updating instead");
            await updateJobSchedule({ scheduleId, cronExpression, timezone });
        } else {
            throw error;
        }
    }
}

/**
 * Update an existing schedule
 */
export async function updateJobSchedule(params: {
    scheduleId: string;
    cronExpression: string;
    timezone: string;
}): Promise<void> {
    const { scheduleId, cronExpression, timezone } = params;
    const temporalClient = await getTemporalClient();

    const handle = temporalClient.schedule.getHandle(scheduleId);
    await handle.update((prev) => ({
        ...prev,
        spec: {
            ...prev.spec,
            calendars: [],
            intervals: [],
            cronExpressions: [cronExpression],
            timezone,
        },
    }));

    logger.info({ scheduleId, cronExpression }, "Updated job schedule");
}

/**
 * Pause a schedule
 */
export async function pauseJobSchedule(scheduleId: string): Promise<void> {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.schedule.getHandle(scheduleId);
    await handle.pause("Paused by user");

    logger.info({ scheduleId }, "Paused job schedule");
}

/**
 * Resume a schedule
 */
export async function resumeJobSchedule(scheduleId: string): Promise<void> {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.schedule.getHandle(scheduleId);
    await handle.unpause("Resumed by user");

    logger.info({ scheduleId }, "Resumed job schedule");
}

/**
 * Delete a schedule
 */
export async function deleteJobSchedule(scheduleId: string): Promise<void> {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.schedule.getHandle(scheduleId);
    await handle.delete();

    logger.info({ scheduleId }, "Deleted job schedule");
}

/**
 * Trigger a schedule to run immediately
 */
export async function triggerJobSchedule(scheduleId: string): Promise<void> {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.schedule.getHandle(scheduleId);
    await handle.trigger();

    logger.info({ scheduleId }, "Triggered job schedule");
}

/**
 * Get schedule info
 */
export async function getJobScheduleInfo(scheduleId: string): Promise<{
    isPaused: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
}> {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.schedule.getHandle(scheduleId);
    const desc = await handle.describe();

    const lastAction = desc.info.recentActions?.[0];

    return {
        isPaused: desc.state?.paused ?? false,
        lastRunAt: lastAction?.scheduledAt ?? null,
        nextRunAt: desc.info.nextActionTimes?.[0] ?? null,
    };
}

/**
 * Start a workflow manually (for testing or one-off runs)
 */
export async function startAgentWorkflow(params: { jobId: string }): Promise<string> {
    const { jobId } = params;
    const temporalClient = await getTemporalClient();

    const handle = await temporalClient.workflow.start("agentJobWorkflow", {
        taskQueue: TASK_QUEUE,
        workflowId: `job-${jobId}-${Date.now()}`,
        args: [{ jobId }],
    });

    logger.info({ jobId, workflowId: handle.workflowId }, "Started agent workflow");

    return handle.workflowId;
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    result?: unknown;
}> {
    const temporalClient = await getTemporalClient();
    const handle = temporalClient.workflow.getHandle(workflowId);
    const desc = await handle.describe();

    return {
        status: desc.status.name,
        result: desc.status.name === "COMPLETED" ? await handle.result() : undefined,
    };
}

/**
 * Start a background response workflow
 *
 * Used when the concierge determines a task needs durable background execution.
 * The workflow streams to Redis for real-time client updates.
 *
 * In eager mode: runs activities inline (fire-and-forget, no durability)
 * In Temporal mode: dispatches to Temporal worker (durable, survives restarts)
 */
export async function startBackgroundResponse(params: {
    connectionId: number;
    userId: string;
    streamId: string;
    modelId: string;
    temperature: number;
    reasoning: {
        enabled: boolean;
        effort?: "high" | "medium" | "low" | "none";
        maxTokens?: number;
    };
}): Promise<string> {
    const { connectionId, streamId } = params;

    // Eager mode: run activities inline without Temporal
    if (isEagerMode()) {
        const workflowId = `eager-${connectionId}-${streamId}`;

        logger.info(
            { connectionId, workflowId, streamId },
            "Starting background response in eager mode (no durability)"
        );

        // Fire and forget - don't await, let it run in background
        // Errors are captured at activity level; this captures orchestration failures
        void runEagerBackgroundResponse(params).catch((error) => {
            logger.error(
                {
                    connectionId,
                    streamId,
                    error: error instanceof Error ? error.message : error,
                },
                "Eager background response failed"
            );

            // Capture orchestration-level errors with distinct fingerprint from activity errors
            Sentry.captureException(error, {
                fingerprint: ["eager-orchestration", "background-response"],
                tags: {
                    component: "eager-mode",
                    action: "background-response",
                },
                extra: {
                    connectionId,
                    streamId,
                    modelId: params.modelId,
                },
            });
        });

        return workflowId;
    }

    // Temporal mode: dispatch to worker
    const temporalClient = await getTemporalClient();

    const handle = await temporalClient.workflow.start("backgroundResponseWorkflow", {
        taskQueue: TASK_QUEUE,
        workflowId: `bg-${connectionId}-${streamId}`,
        args: [params],
    });

    logger.info(
        { connectionId, workflowId: handle.workflowId, streamId },
        "Started background response workflow"
    );

    return handle.workflowId;
}

/**
 * Start an extraction job workflow
 *
 * Processes imported conversations to learn about the user.
 * Supports both Temporal mode (durable) and eager mode (inline).
 */
export async function startImportLibrarianWorkflow(params: {
    jobId: string;
    userId: string;
    connectionIds?: number[];
}): Promise<string> {
    const { jobId } = params;

    // Eager mode: run activities inline without Temporal
    if (isEagerMode()) {
        const workflowId = `eager-import-librarian-${jobId}`;

        logger.info(
            { jobId, workflowId },
            "Starting import librarian workflow in eager mode (no durability)"
        );

        // Fire and forget - don't await
        void runEagerImportLibrarianWorkflow(params).catch((error) => {
            logger.error(
                {
                    jobId,
                    error: error instanceof Error ? error.message : error,
                },
                "Eager import librarian workflow failed"
            );

            Sentry.captureException(error, {
                fingerprint: ["eager-orchestration", "import-librarian"],
                tags: {
                    component: "eager-mode",
                    action: "import-librarian",
                },
                extra: { jobId },
            });
        });

        return workflowId;
    }

    // Temporal mode: dispatch to worker
    const temporalClient = await getTemporalClient();

    const handle = await temporalClient.workflow.start("importLibrarianJobWorkflow", {
        taskQueue: TASK_QUEUE,
        workflowId: `import-librarian-${jobId}`,
        args: [params],
    });

    logger.info(
        { jobId, workflowId: handle.workflowId },
        "Started import librarian workflow"
    );

    return handle.workflowId;
}

/**
 * Run import librarian workflow activities inline (eager mode)
 *
 * Processes each conversation one at a time with immediate progress updates.
 */
async function runEagerImportLibrarianWorkflow(params: {
    jobId: string;
    userId: string;
    connectionIds?: number[];
}): Promise<void> {
    const { jobId } = params;

    logger.info(
        { jobId, connectionIds: params.connectionIds?.length },
        "🚀 Starting eager import librarian workflow"
    );

    // Dynamic import to avoid loading worker deps at startup
    const activities = await import("../../worker/activities/import-librarian");

    try {
        // Step 1: Load context
        logger.info({ jobId }, "📋 Loading context...");
        const context = await activities.loadImportLibrarianContext(params);
        logger.info(
            { jobId, connectionCount: context.connectionIds.length },
            "📋 Context loaded"
        );

        if (context.connectionIds.length === 0) {
            logger.info({ jobId }, "⏭️ No connections to process, finalizing");
            await activities.finalizeImportLibrarianJob(jobId, true);
            return;
        }

        // Step 2: Process each conversation one at a time
        let totalProcessed = 0;
        let totalExtracted = 0;

        for (const connectionId of context.connectionIds) {
            const result = await activities.processConversation(context, connectionId);

            if (result.processed) {
                totalProcessed++;
                totalExtracted += result.extractedCount;
            }

            // Update progress immediately after each conversation
            await activities.updateJobProgress(jobId, totalProcessed, totalExtracted);
        }

        // Step 3: Finalize
        await activities.finalizeImportLibrarianJob(jobId, true);

        logger.info(
            { jobId, totalProcessed, totalExtracted },
            "✅ Eager import librarian workflow completed"
        );
    } catch (error) {
        // Mark as failed
        try {
            const activities = await import("../../worker/activities/import-librarian");
            await activities.finalizeImportLibrarianJob(
                jobId,
                false,
                error instanceof Error ? error.message : String(error)
            );
        } catch {
            // Ignore finalization errors
        }
        throw error;
    }
}

/**
 * Run background response activities inline (eager mode)
 *
 * Mirrors the Temporal workflow but runs in the same process.
 * No durability - if the process crashes, work is lost.
 */
async function runEagerBackgroundResponse(params: {
    connectionId: number;
    userId: string;
    streamId: string;
    modelId: string;
    temperature: number;
    reasoning: {
        enabled: boolean;
        effort?: "high" | "medium" | "low" | "none";
        maxTokens?: number;
    };
}): Promise<void> {
    const { connectionId, streamId } = params;

    // Dynamic import to avoid loading worker deps at startup
    const activities = await import("../../worker/activities/background-response");

    try {
        // Step 1: Load connection context
        const context = await activities.loadConnectionContext(params);

        // Step 2: Generate response (streams to Redis)
        const result = await activities.generateBackgroundResponse(params, context);

        // Step 3: Save to database
        await activities.saveBackgroundResponse(connectionId, streamId, result.parts);

        // Step 4: Update status to completed
        await activities.updateConnectionStatus(connectionId, "completed");

        logger.info(
            { connectionId, streamId, partCount: result.parts.length },
            "Eager background response completed"
        );
    } catch (error) {
        // Mark as failed - capture secondary error if status update fails
        try {
            const activities =
                await import("../../worker/activities/background-response");
            await activities.updateConnectionStatus(connectionId, "failed");
        } catch (statusError) {
            // Status update failed - log so we know, but don't mask primary error
            logger.error(
                {
                    connectionId,
                    streamId,
                    statusError:
                        statusError instanceof Error
                            ? statusError.message
                            : statusError,
                    primaryError: error instanceof Error ? error.message : error,
                },
                "Failed to update connection status after error"
            );
        }
        throw error;
    }
}
