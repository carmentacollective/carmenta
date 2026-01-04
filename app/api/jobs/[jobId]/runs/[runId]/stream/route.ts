/**
 * Job Run Stream Resume Endpoint
 *
 * Resumes an active job run stream so users can "tap in"
 * and watch the AI employee work in real-time.
 *
 * Security: Validates user owns the job before resuming.
 */

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { scheduledJobs, jobRuns, users } from "@/lib/db/schema";
import { getStreamContext } from "@/lib/streaming/stream-context";
import { logger } from "@/lib/logger";
import { unauthorizedResponse } from "@/lib/api/responses";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ jobId: string; runId: string }> }
) {
    const { jobId, runId } = await params;

    // Validate authentication
    const user = await currentUser();
    if (!user && process.env.NODE_ENV === "production") {
        return unauthorizedResponse();
    }

    // Get user from database
    const dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, user?.id ?? "dev-user-id"),
    });

    if (!dbUser) {
        return new Response(null, { status: 403 });
    }

    // Get job and verify ownership
    const job = await db.query.scheduledJobs.findFirst({
        where: eq(scheduledJobs.id, jobId),
    });

    if (!job) {
        return new Response(null, { status: 404 });
    }

    if (job.userId !== dbUser.id) {
        logger.warn(
            { jobId, runId, userId: dbUser.id, ownerId: job.userId },
            "Unauthorized job stream resume attempt"
        );
        return new Response(null, { status: 403 });
    }

    // Get the run and its stream ID
    const run = await db.query.jobRuns.findFirst({
        where: and(eq(jobRuns.id, runId), eq(jobRuns.jobId, jobId)),
    });

    if (!run) {
        return new Response(null, { status: 404 });
    }

    if (!run.activeStreamId) {
        // No active stream - job not running or already completed
        return new Response(null, { status: 204 });
    }

    // Try to resume the stream from Redis
    const streamContext = getStreamContext();
    if (!streamContext) {
        logger.debug({ jobId, runId }, "Cannot resume stream - Redis not configured");
        return new Response(null, { status: 204 });
    }

    try {
        const resumedStream = await streamContext.resumeExistingStream(
            run.activeStreamId
        );

        if (!resumedStream) {
            // Stream has expired or completed in Redis
            logger.debug(
                { jobId, runId, streamId: run.activeStreamId },
                "Stream not found in Redis (expired or completed)"
            );
            return new Response(null, { status: 204 });
        }

        logger.info(
            { jobId, runId, streamId: run.activeStreamId },
            "📺 Tapped into job stream"
        );

        return new Response(resumedStream, {
            status: 200,
            headers: UI_MESSAGE_STREAM_HEADERS,
        });
    } catch (error) {
        logger.error(
            { error, jobId, runId, streamId: run.activeStreamId },
            "Failed to resume job stream"
        );
        Sentry.captureException(error, {
            tags: { component: "jobs", route: "/api/jobs/[jobId]/runs/[runId]/stream" },
            extra: { jobId, runId, streamId: run.activeStreamId },
        });
        return new Response(null, { status: 204 });
    }
}
