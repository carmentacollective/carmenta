/**
 * Workspace Cleanup Cron Endpoint
 *
 * Cleans up old workspaces to free disk space.
 * Triggered by Render cron job every 6 hours.
 *
 * Security: Protected by CRON_SECRET header with timing-safe comparison
 */

import { timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { cleanupAllWorkspaces, isWorkspaceMode } from "@/lib/code/projects";
import { logger } from "@/lib/logger";

const CLEANUP_MAX_AGE_DAYS = 7;

/**
 * Timing-safe comparison of secrets to prevent timing attacks
 */
function verifySecret(provided: string | null, expected: string): boolean {
    if (!provided) return false;

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
    // Verify cron secret with timing-safe comparison
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        logger.warn({}, "CRON_SECRET not configured");
        return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
    }

    if (!verifySecret(cronSecret, expectedSecret)) {
        logger.warn({}, "Invalid cron secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only run in workspace mode
    if (!isWorkspaceMode()) {
        return NextResponse.json({
            message: "Skipped - not in workspace mode",
            workspaceMode: false,
        });
    }

    logger.info({ maxAgeDays: CLEANUP_MAX_AGE_DAYS }, "Starting workspace cleanup");

    try {
        const results = await cleanupAllWorkspaces({
            maxAgeDays: CLEANUP_MAX_AGE_DAYS,
            dryRun: false,
        });

        // Summarize results
        let totalDeleted = 0;
        let totalSkipped = 0;
        let totalFreedBytes = 0;
        const userSummaries: Record<
            string,
            { deleted: number; skipped: number; freedBytes: number }
        > = {};

        for (const [userId, result] of results) {
            totalDeleted += result.deleted.length;
            totalSkipped += result.skipped.length;
            totalFreedBytes += result.freedBytes;
            userSummaries[userId] = {
                deleted: result.deleted.length,
                skipped: result.skipped.length,
                freedBytes: result.freedBytes,
            };
        }

        logger.info(
            {
                totalDeleted,
                totalSkipped,
                totalFreedBytes,
                totalFreedMB: Math.round(totalFreedBytes / (1024 * 1024)),
                usersProcessed: results.size,
            },
            "Workspace cleanup completed"
        );

        return NextResponse.json({
            success: true,
            summary: {
                deleted: totalDeleted,
                skipped: totalSkipped,
                freedBytes: totalFreedBytes,
                freedMB: Math.round(totalFreedBytes / (1024 * 1024)),
                usersProcessed: results.size,
            },
            users: userSummaries,
        });
    } catch (error) {
        logger.error({ error }, "Workspace cleanup failed");
        // Don't expose error details to prevent information leakage
        return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
    }
}

// Also support GET for manual triggering (with same auth)
export async function GET(request: Request) {
    return POST(request);
}
