import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Health Check Endpoint
 *
 * Used by Render for zero-downtime deployments. Verifies:
 * 1. Server is running and responding
 * 2. Database connection is healthy
 *
 * Returns 200 if healthy, 503 if unhealthy.
 * Render only routes traffic to instances that return 2xx/3xx.
 *
 * @see https://render.com/docs/health-checks
 */
export async function GET() {
    const startTime = Date.now();

    try {
        // Check database connectivity with a simple query
        const result = await db.execute(sql`SELECT 1 as ok`);

        if (!result || result.length === 0) {
            throw new Error("Database query returned no results");
        }

        const responseTime = Date.now() - startTime;

        logger.debug({ responseTime }, "Health check passed");

        return NextResponse.json(
            {
                status: "healthy",
                timestamp: new Date().toISOString(),
                checks: {
                    database: "ok",
                },
                responseTime: `${responseTime}ms`,
            },
            { status: 200 }
        );
    } catch (error) {
        const responseTime = Date.now() - startTime;

        logger.error({ error, responseTime }, "Health check failed");

        return NextResponse.json(
            {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                checks: {
                    database: "failed",
                },
                error: error instanceof Error ? error.message : "Unknown error",
                responseTime: `${responseTime}ms`,
            },
            { status: 503 }
        );
    }
}
