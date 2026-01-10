/**
 * Extraction Job Status API
 *
 * GET - Get job status
 */

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { getOrCreateUser } from "@/lib/db";
import { getJobStatus } from "@/lib/import/extraction";
import { logger } from "@/lib/logger";

/**
 * Get the database user for the current request
 */
async function getDbUser() {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
        return null;
    }

    return getOrCreateUser(user.id, email, {
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
    });
}

/**
 * GET /api/import/extract/:jobId
 *
 * Returns the status of an extraction job
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ jobId: string }> }
) {
    const dbUser = await getDbUser();

    if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;

    try {
        const status = await getJobStatus(jobId, dbUser.id);

        if (!status) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json(status);
    } catch (error) {
        logger.error({ error, jobId }, "Failed to get job status");
        return NextResponse.json(
            { error: "Failed to get job status" },
            { status: 500 }
        );
    }
}
