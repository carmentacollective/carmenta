/**
 * Jobs API - List and Create scheduled jobs
 *
 * GET /api/jobs - List all jobs for the current user
 * POST /api/jobs - Create a new job
 *
 * Job creation requires Temporal for scheduling. If Temporal is unavailable,
 * we return 503 rather than creating orphaned database entries.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
    isBackgroundModeEnabled,
    createJobSchedule,
    deleteJobSchedule,
    getJobScheduleInfo,
} from "@/lib/temporal/client";
import { logger } from "@/lib/logger";
import { ValidationError } from "@/lib/errors";

/**
 * Validate cron expression format and frequency
 *
 * Accepts standard cron format: "minute hour day month weekday"
 * Rejects expressions that would run more than once per minute.
 */
function validateCronExpression(cron: string): boolean {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
        return false;
    }

    // Reject expressions that run every minute (* * * * *)
    // Minimum frequency is once per minute
    const [minute] = parts;
    if (minute === "*") {
        return false;
    }

    // Basic validation: each part should be *, number, range, or list
    const cronPartRegex = /^(\*|[0-9,-/]+)$/;
    return parts.every((part) => cronPartRegex.test(part));
}

const createJobSchema = z.object({
    name: z.string().min(1).max(100),
    prompt: z.string().min(1).max(10000),
    scheduleCron: z.string().min(1).refine(validateCronExpression, {
        message:
            "Invalid cron expression. Format: 'minute hour day month weekday'. Minimum frequency: once per minute.",
    }),
    timezone: z.string().default("UTC"),
    integrations: z.array(z.string()).default([]),
});

/**
 * GET /api/jobs - List jobs for current user
 */
export async function GET() {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const jobs = await db.query.scheduledJobs.findMany({
        where: eq(scheduledJobs.userId, user.id),
        orderBy: [desc(scheduledJobs.createdAt)],
        with: {
            runs: {
                limit: 5,
                orderBy: (runs, { desc }) => [desc(runs.createdAt)],
            },
            notifications: {
                limit: 10,
                orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
            },
        },
    });

    // Enrich jobs with schedule info from Temporal
    const enrichedJobs = await Promise.all(
        jobs.map(async (job) => {
            if (!job.temporalScheduleId) {
                return { ...job, nextRunAt: null, lastRunAt: null };
            }

            try {
                const scheduleInfo = await getJobScheduleInfo(job.temporalScheduleId);
                return {
                    ...job,
                    nextRunAt: scheduleInfo.nextRunAt,
                    lastRunAt: scheduleInfo.lastRunAt,
                };
            } catch (error) {
                logger.warn(
                    { error, jobId: job.id, scheduleId: job.temporalScheduleId },
                    "Failed to fetch schedule info"
                );
                return { ...job, nextRunAt: null, lastRunAt: null };
            }
        })
    );

    return NextResponse.json({ jobs: enrichedJobs });
}

/**
 * POST /api/jobs - Create a new job
 */
export async function POST(request: NextRequest) {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if background mode is available BEFORE any database writes
    // This prevents creating orphaned job entries when Temporal is unavailable
    if (!isBackgroundModeEnabled()) {
        logger.warn(
            { userId: user.id },
            "Job creation attempted but background mode is not configured"
        );
        return NextResponse.json(
            {
                error: "Scheduled jobs are not available",
                message:
                    "Background processing is not configured for this environment.",
            },
            { status: 503 }
        );
    }

    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError(parsed.error.message);
    }

    const { name, prompt, scheduleCron, timezone, integrations } = parsed.data;

    // Create job in database
    const [job] = await db
        .insert(scheduledJobs)
        .values({
            userId: user.id,
            name,
            prompt,
            scheduleCron,
            timezone,
            integrations,
            memory: {},
            isActive: true,
        })
        .returning();

    // Create schedule in Temporal
    const scheduleId = `job-${job.id}`;
    try {
        await createJobSchedule({
            scheduleId,
            jobId: job.id,
            userId: user.id,
            cronExpression: scheduleCron,
            timezone,
        });
    } catch (error) {
        // Temporal is configured but unavailable (DNS, network, service down)
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
            { error: errorMessage, jobId: job.id },
            "Failed to create Temporal schedule"
        );

        Sentry.captureException(error, {
            tags: { component: "jobs", action: "create_schedule" },
            extra: { jobId: job.id, userId: user.id },
        });

        // Clean up the database entry since the schedule couldn't be created
        await db.delete(scheduledJobs).where(eq(scheduledJobs.id, job.id));

        return NextResponse.json(
            {
                error: "Unable to create scheduled job",
                message:
                    "Background processing is temporarily unavailable. Please try again in a few minutes.",
            },
            { status: 503 }
        );
    }

    // Update job with schedule ID
    // If this fails, we need to clean up both the schedule and job
    try {
        const [updatedJob] = await db
            .update(scheduledJobs)
            .set({ temporalScheduleId: scheduleId })
            .where(eq(scheduledJobs.id, job.id))
            .returning();

        logger.info({ jobId: job.id, scheduleId }, "Created scheduled job");

        return NextResponse.json({ job: updatedJob }, { status: 201 });
    } catch (error) {
        // DB update failed after schedule creation - clean up both
        logger.error(
            { error, jobId: job.id, scheduleId },
            "Failed to update job with schedule ID"
        );

        // Try to clean up the orphaned schedule
        try {
            await deleteJobSchedule(scheduleId);
        } catch (deleteError) {
            logger.error(
                { error: deleteError, scheduleId },
                "Failed to clean up orphaned schedule"
            );
        }

        await db.delete(scheduledJobs).where(eq(scheduledJobs.id, job.id));

        return NextResponse.json(
            { error: "Failed to create job. Please try again." },
            { status: 500 }
        );
    }
}
