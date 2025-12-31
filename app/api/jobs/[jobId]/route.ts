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

const updateJobSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    prompt: z.string().min(1).max(10000).optional(),
    scheduleCron: z.string().min(1).optional(),
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

    // Delete Temporal schedule
    if (job.temporalScheduleId) {
        try {
            await deleteJobSchedule(job.temporalScheduleId);
        } catch (error) {
            logger.error({ error, jobId }, "Failed to delete Temporal schedule");
        }
    }

    // Delete job (cascades to runs and notifications)
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, jobId));

    logger.info({ jobId }, "Deleted job");

    return NextResponse.json({ success: true });
}
