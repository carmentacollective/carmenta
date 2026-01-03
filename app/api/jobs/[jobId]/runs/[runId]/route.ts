/**
 * Job Run Detail API
 *
 * GET /api/jobs/:jobId/runs/:runId - Get detailed run information
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs, jobRuns, jobNotifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors";
import { buildExternalLinks } from "@/lib/observability/external-links";

type RouteContext = {
    params: Promise<{ jobId: string; runId: string }>;
};

/**
 * GET /api/jobs/:jobId/runs/:runId - Get run with full execution trace
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const { jobId, runId } = await context.params;
    const { userId: clerkId } = await auth();

    if (!clerkId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByClerkId(clerkId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify job belongs to user
    const job = await db.query.scheduledJobs.findFirst({
        where: and(eq(scheduledJobs.id, jobId), eq(scheduledJobs.userId, user.id)),
    });

    if (!job) {
        throw new NotFoundError("Job");
    }

    // Get the run with all observability data
    const run = await db.query.jobRuns.findFirst({
        where: and(eq(jobRuns.id, runId), eq(jobRuns.jobId, jobId)),
    });

    if (!run) {
        throw new NotFoundError("Run");
    }

    // Get notifications generated during this run
    const notifications = await db.query.jobNotifications.findMany({
        where: eq(jobNotifications.runId, runId),
    });

    // Build external service links
    const externalLinks = buildExternalLinks({
        sentryTraceId: run.sentryTraceId,
        temporalWorkflowId: run.temporalWorkflowId,
    });

    return NextResponse.json({
        run: {
            id: run.id,
            status: run.status,
            summary: run.summary,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            durationMs: run.durationMs,
            executionTrace: run.executionTrace,
            errorDetails: run.errorDetails,
            tokenUsage: run.tokenUsage,
            modelId: run.modelId,
            toolCallsExecuted: run.toolCallsExecuted,
            notificationsSent: run.notificationsSent,
            temporalWorkflowId: run.temporalWorkflowId,
            sentryTraceId: run.sentryTraceId,
            externalLinks,
            notifications: notifications.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                priority: n.priority,
                createdAt: n.createdAt,
            })),
        },
        job: {
            id: job.id,
            name: job.name,
            prompt: job.prompt,
        },
    });
}
