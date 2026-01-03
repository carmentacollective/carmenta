/**
 * Trigger Job API - Run a job immediately
 *
 * POST /api/jobs/:jobId/trigger - Trigger immediate execution
 *
 * Gracefully handles Temporal unavailability - returns 503 with clear message
 * rather than throwing a 500 that masks the real issue.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { isBackgroundModeEnabled, startAgentWorkflow } from "@/lib/temporal/client";
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

    // Check if background mode is available before attempting to trigger
    if (!isBackgroundModeEnabled()) {
        logger.warn(
            { jobId },
            "Job trigger attempted but background mode is not configured"
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

    // Attempt to start the workflow with graceful error handling
    try {
        const workflowId = await startAgentWorkflow({
            jobId: job.id,
        });
        logger.info({ jobId, workflowId }, "Started manual workflow");

        return NextResponse.json({ success: true, workflowId });
    } catch (error) {
        // Temporal is configured but unavailable (DNS, network, service down)
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(
            { error: errorMessage, jobId },
            "Failed to trigger job - Temporal unavailable"
        );

        Sentry.captureException(error, {
            tags: { component: "jobs", action: "trigger" },
            extra: { jobId, userId: user.id },
        });

        return NextResponse.json(
            {
                error: "Unable to run job",
                message:
                    "Background processing is temporarily unavailable. Please try again in a few minutes.",
            },
            { status: 503 }
        );
    }
}
