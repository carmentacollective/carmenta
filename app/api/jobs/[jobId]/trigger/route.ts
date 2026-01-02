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
import { startAgentWorkflow } from "@/lib/temporal/client";
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

    // Always start a manual workflow for trigger requests
    // This ensures we get a real workflow ID for status tracking
    const workflowId = await startAgentWorkflow({
        jobId: job.id,
    });
    logger.info({ jobId, workflowId }, "Started manual workflow");

    return NextResponse.json({ success: true, workflowId });
}
