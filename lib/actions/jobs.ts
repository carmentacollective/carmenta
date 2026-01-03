"use server";

/**
 * Job Server Actions
 *
 * Server actions for scheduled job operations, callable from client components.
 */

import { currentUser } from "@clerk/nextjs/server";

import { db, findUserByClerkId } from "@/lib/db";
import { scheduledJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { isValidJobId, decodeJobId, encodeJobId } from "@/lib/sqids";

/**
 * Public-facing Job type for UI consumption.
 * Uses encoded seqId as the public ID.
 */
export interface PublicJob {
    id: string; // Sqid-encoded seqId for URLs
    internalId: string; // UUID for API calls
    name: string;
    prompt: string;
    scheduleCron: string;
    timezone: string;
    isActive: boolean;
    integrations: string[];
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    createdAt: Date;
}

/**
 * Get the current authenticated user from database.
 */
async function getDbUser() {
    const clerkUser = await currentUser();
    if (!clerkUser) {
        return null;
    }
    return findUserByClerkId(clerkUser.id);
}

/**
 * Load a job by encoded ID with ownership validation.
 *
 * @param encodedId - Sqid-encoded seqId from the URL
 * @returns Job data or null if not found/not authorized
 */
export async function loadJob(encodedId: string): Promise<PublicJob | null> {
    // Validate ID format
    if (!isValidJobId(encodedId)) {
        logger.debug({ encodedId }, "Invalid job ID format");
        return null;
    }

    // Decode to seqId
    const seqId = decodeJobId(encodedId);
    if (seqId === null) {
        logger.debug({ encodedId }, "Failed to decode job ID");
        return null;
    }

    const dbUser = await getDbUser();
    if (!dbUser) {
        return null;
    }

    const job = await db.query.scheduledJobs.findFirst({
        where: and(eq(scheduledJobs.seqId, seqId), eq(scheduledJobs.userId, dbUser.id)),
    });

    if (!job) {
        return null;
    }

    return {
        id: encodeJobId(job.seqId),
        internalId: job.id,
        name: job.name,
        prompt: job.prompt,
        scheduleCron: job.scheduleCron,
        timezone: job.timezone,
        isActive: job.isActive,
        integrations: job.integrations,
        lastRunAt: job.lastRunAt,
        nextRunAt: job.nextRunAt,
        createdAt: job.createdAt,
    };
}
