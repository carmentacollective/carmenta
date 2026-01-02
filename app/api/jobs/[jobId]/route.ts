/**
 * Job API - Get, Update, Delete a specific job
 *
 * GET /api/jobs/:jobId - Get job details
 * PATCH /api/jobs/:jobId - Update job
 * DELETE /api/jobs/:jobId - Delete job
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs, jobRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
    updateJobSchedule,
    pauseJobSchedule,
    resumeJobSchedule,
    deleteJobSchedule,
} from "@/lib/temporal/client";
import { logger } from "@/lib/logger";
import { NotFoundError, ValidationError } from "@/lib/errors";

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
    const [minute] = parts;
    if (minute === "*") {
        return false;
    }

    // Basic validation: each part should be *, number, range, or list
    const cronPartRegex = /^(\*|[0-9,-/]+)$/;
    return parts.every((part) => cronPartRegex.test(part));
}

const updateJobSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    prompt: z.string().min(1).max(10000).optional(),
    scheduleCron: z
        .string()
        .min(1)
        .refine(validateCronExpression, {
            message:
                "Invalid cron expression. Format: 'minute hour day month weekday'. Minimum frequency: once per minute.",
        })
        .optional(),
    timezone: z.string().optional(),
    integrations: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

type RouteContext = {
    params: Promise<{ jobId: string }>;
};

/**
 * GET /api/jobs/:jobId - Get job with recent runs
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const { jobId } = await context.params;
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await db.query.scheduledJobs.findFirst({
        where: and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.userId, user.id)),
        with: {
            runs: {
                limit: 20,
                orderBy: [desc(jobRuns.createdAt)],
            },
            notifications: {
                limit: 10,
                orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
            },
        },
    });

    if (!job) {
        throw new NotFoundError("Job");
    }

    return NextResponse.json({ job });
}

/**
 * PATCH /api/jobs/:jobId - Update job configuration
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const { jobId } = await context.params;
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await db.query.scheduledJobs.findFirst({
        where: and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.userId, user.id)),
    });

    if (!job) {
        throw new NotFoundError("Job");
    }

    const body = await request.json();
    const parsed = updateJobSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError(parsed.error.message);
    }

    const updates = parsed.data;

    // Handle schedule changes
    if (updates.scheduleCron || updates.timezone) {
        const newCron = updates.scheduleCron || job.scheduleCron;
        const newTimezone = updates.timezone || job.timezone;

        if (job.temporalScheduleId) {
            try {
                await updateJobSchedule({
                    scheduleId: job.temporalScheduleId,
                    cronExpression: newCron,
                    timezone: newTimezone,
                });
            } catch (error) {
                logger.error({ error, jobId }, "Failed to update Temporal schedule");
            }
        }
    }

    // Handle pause/resume
    if (updates.isActive !== undefined && updates.isActive !== job.isActive) {
        if (job.temporalScheduleId) {
            try {
                if (updates.isActive) {
                    await resumeJobSchedule(job.temporalScheduleId);
                } else {
                    await pauseJobSchedule(job.temporalScheduleId);
                }
            } catch (error) {
                logger.error(
                    { error, jobId },
                    "Failed to pause/resume Temporal schedule"
                );
            }
        }
    }

    // Update database
    const [updatedJob] = await db
        .update(scheduledJobs)
        .set({
            ...updates,
            updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.id, jobId))
        .returning();

    logger.info({ jobId, updates: Object.keys(updates) }, "Updated job");

    return NextResponse.json({ job: updatedJob });
}

/**
 * DELETE /api/jobs/:jobId - Delete job and its schedule
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
    const { jobId } = await context.params;
    const { userId: clerkId } = await auth();
    if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await db.query.scheduledJobs.findFirst({
        where: and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.userId, user.id)),
    });

    if (!job) {
        throw new NotFoundError("Job");
    }

    // Delete Temporal schedule first - fail if this fails to prevent orphaned schedules
    if (job.temporalScheduleId) {
        try {
            await deleteJobSchedule(job.temporalScheduleId);
        } catch (error) {
            logger.error({ error, jobId }, "Failed to delete Temporal schedule");
            // Don't proceed with DB deletion - would leave orphaned schedule
            return NextResponse.json(
                { error: "Failed to delete schedule. Please try again." },
                { status: 500 }
            );
        }
    }

    // Delete job (cascades to runs and notifications)
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, jobId));

    logger.info({ jobId }, "Deleted job");

    return NextResponse.json({ success: true });
}
