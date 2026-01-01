/**
 * Temporal Client
 *
 * Provides functions to interact with Temporal for:
 * - Creating/managing schedules for jobs
 * - Starting workflows manually
 * - Querying workflow status
 */

import { Client, Connection, ScheduleAlreadyRunning } from "@temporalio/client";
import { logger } from "@/lib/logger";

// Singleton connection and client
let connection: Connection | null = null;
let client: Client | null = null;

const TASK_QUEUE = "scheduled-agents";

/**
 * Get or create the Temporal client
 */
export async function getTemporalClient(): Promise<Client> {
    if (client) {
        return client;
    }

    const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";

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
    userEmail: string;
    cronExpression: string;
    timezone: string;
}): Promise<void> {
    const { scheduleId, jobId, userId, userEmail, cronExpression, timezone } = params;
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
                args: [{ jobId, userId, userEmail }],
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
export async function startAgentWorkflow(params: {
    jobId: string;
    userId: string;
    userEmail: string;
}): Promise<string> {
    const { jobId, userId, userEmail } = params;
    const temporalClient = await getTemporalClient();

    const handle = await temporalClient.workflow.start("agentJobWorkflow", {
        taskQueue: TASK_QUEUE,
        workflowId: `job-${jobId}-${Date.now()}`,
        args: [{ jobId, userId, userEmail }],
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
