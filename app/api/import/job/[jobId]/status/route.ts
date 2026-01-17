/**
 * Import Job Status API
 *
 * GET - Get the current status of an extraction job
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { getOrCreateUser } from "@/lib/db";
import { getJobStatus } from "@/lib/import/extraction";

interface RouteParams {
    params: Promise<{ jobId: string }>;
}

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
 * GET - Get job status
 *
 * Returns status, progress counts, and error if any
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { jobId } = await params;
    const user = await getDbUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobStatus = await getJobStatus(jobId, user.id);

    if (!jobStatus) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Map internal status to frontend status
    const mapStatus = (status: string) => {
        if (status === "queued") return "pending";
        if (status === "processing") return "running";
        return status;
    };

    return NextResponse.json({
        status: mapStatus(jobStatus.status),
        totalConversations: jobStatus.totalConversations,
        processedConversations: jobStatus.processedConversations,
        error: jobStatus.errorMessage,
    });
}
