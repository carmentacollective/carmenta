import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { cleanupExpiredStates } from "@/lib/integrations/oauth/state";

/**
 * Cron job to clean up expired OAuth state tokens.
 *
 * Runs hourly via Vercel Cron to prevent oauth_states table bloat.
 * Expired states (> 5 minutes old) are automatically deleted.
 *
 * Security: Protected by Vercel Cron secret header in production.
 */
export async function GET(request: NextRequest) {
    // Verify Vercel Cron secret in production
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" && cronSecret) {
        if (authHeader !== `Bearer ${cronSecret}`) {
            logger.warn(
                { endpoint: "cleanup-oauth-states" },
                "Unauthorized cron request"
            );
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const deletedCount = await cleanupExpiredStates();

        logger.info({ deletedCount }, "OAuth states cleanup completed");

        return NextResponse.json({
            success: true,
            deletedCount,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({ error }, "Failed to clean up OAuth states");

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
