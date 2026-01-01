/**
 * Trigger Job API - Run a job immediately
 *
 * POST /api/jobs/:jobId/trigger - Trigger immediate execution
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { triggerJobSchedule, startAgentWorkflow } from "@/lib/temporal/client";
import { logger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";

type RouteContext = {
    params: Promise<{ jobId: string }>;
};

/**
 * POST /api/jobs/:jobId/trigger - Run job now
 */
export async function POST(_request: NextRequest, context: RouteContext) {
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

    let workflowId: string;

    // If job has a schedule, trigger it. Otherwise, start a one-off workflow.
    if (job.temporalScheduleId) {
        try {
            await triggerJobSchedule(job.temporalScheduleId);
            workflowId = `triggered-${job.temporalScheduleId}`;
            logger.info({ jobId }, "Triggered scheduled job");
        } catch (error) {
            // Schedule might not exist yet, start manually
            workflowId = await startAgentWorkflow({
                jobId: job.id,
                userId: user.id,
                userEmail: user.email,
            });
            logger.info(
                { jobId, workflowId },
                "Started manual workflow (schedule trigger failed)"
            );
        }
    } else {
        workflowId = await startAgentWorkflow({
            jobId: job.id,
            userId: user.id,
            userEmail: user.email,
        });
        logger.info({ jobId, workflowId }, "Started manual workflow");
    }

    return NextResponse.json({ success: true, workflowId });
}
