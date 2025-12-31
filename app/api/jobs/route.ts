/**
 * Jobs API - List and Create scheduled jobs
 *
 * GET /api/jobs - List all jobs for the current user
 * POST /api/jobs - Create a new job
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createJobSchedule } from "@/lib/temporal/client";
import { logger } from "@/lib/logger";
import { ValidationError } from "@/lib/errors";

const createJobSchema = z.object({
    name: z.string().min(1).max(100),
    prompt: z.string().min(1).max(10000),
    scheduleCron: z.string().min(1), // TODO: Validate cron expression
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
        },
    });

    return NextResponse.json({ jobs });
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

        // Update job with schedule ID
        await db
            .update(scheduledJobs)
            .set({ temporalScheduleId: scheduleId })
            .where(eq(scheduledJobs.id, job.id));

        logger.info({ jobId: job.id, scheduleId }, "Created scheduled job");
    } catch (error) {
        // If Temporal fails, still return the job but log the error
        logger.error({ error, jobId: job.id }, "Failed to create Temporal schedule");
    }

    return NextResponse.json({ job }, { status: 201 });
}
