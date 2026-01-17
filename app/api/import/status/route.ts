/**
 * Import Status API
 *
 * GET - Check for active import job and unprocessed imports
 */

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq, and, inArray, desc } from "drizzle-orm";

import { db, getOrCreateUser } from "@/lib/db";
import { extractionJobs } from "@/lib/db/schema";
import { getUnprocessedImports } from "@/lib/import/extraction";

/**
 * Get the database user from Clerk auth
 */
async function getDbUser() {
    const clerkUser = await currentUser();
    if (!clerkUser?.primaryEmailAddress?.emailAddress) {
        return null;
    }

    return getOrCreateUser(clerkUser.id, clerkUser.primaryEmailAddress.emailAddress, {
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        displayName: clerkUser.fullName ?? null,
        imageUrl: clerkUser.imageUrl ?? null,
    });
}

/**
 * GET - Check import status
 *
 * Returns:
 * - activeJob: Current running/pending job if any
 * - hasUnprocessedImports: Whether there are imports waiting to be processed
 */
export async function GET() {
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for active job (pending or running)
    const [activeJob] = await db
        .select({
            jobId: extractionJobs.id,
            status: extractionJobs.status,
            totalConversations: extractionJobs.totalConversations,
            processedConversations: extractionJobs.processedConversations,
            error: extractionJobs.errorMessage,
        })
        .from(extractionJobs)
        .where(
            and(
                eq(extractionJobs.userId, user.id),
                inArray(extractionJobs.status, ["queued", "processing"])
            )
        )
        .orderBy(desc(extractionJobs.createdAt))
        .limit(1);

    // Check for unprocessed imports
    const unprocessed = await getUnprocessedImports(user.id, 1);
    const hasUnprocessedImports = unprocessed.length > 0;

    // Map internal status to frontend status
    const mapStatus = (status: string) => {
        if (status === "queued") return "pending";
        if (status === "processing") return "running";
        return status;
    };

    return NextResponse.json({
        activeJob: activeJob
            ? {
                  jobId: activeJob.jobId,
                  status: mapStatus(activeJob.status),
                  totalConversations: activeJob.totalConversations,
                  processedConversations: activeJob.processedConversations,
                  error: activeJob.error,
              }
            : null,
        hasUnprocessedImports,
    });
}
