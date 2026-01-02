import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { createClient, type RedisClientType } from "redis";
import { Connection } from "@temporalio/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Health Check Endpoint
 *
 * Used by Render for zero-downtime deployments.
 *
 * Basic check (default):
 *   GET /healthz → Returns 200 if server is alive
 *
 * Extended checks (optional):
 *   GET /healthz?checks=db,redis,temporal
 *   GET /healthz?checks=all
 *
 * Available checks: db, redis, temporal
 *
 * Returns 200 if healthy, 503 if any requested check fails.
 * Render restarts service after 60 consecutive seconds of failures.
 *
 * @see https://render.com/docs/health-checks
 */

type CheckResult = "ok" | "failed" | "skipped";

interface HealthChecks {
    db?: CheckResult;
    redis?: CheckResult;
    temporal?: CheckResult;
}

const AVAILABLE_CHECKS = ["db", "redis", "temporal"] as const;
type CheckName = (typeof AVAILABLE_CHECKS)[number];

let redisClient: RedisClientType | null = null;
let redisConnecting: Promise<RedisClientType | null> | null = null;

async function getRedisClient(): Promise<RedisClientType | null> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return null;
    }

    if (redisClient?.isOpen) {
        return redisClient;
    }

    // Prevent race condition: if already connecting, wait for that connection
    if (redisConnecting) {
        return redisConnecting;
    }

    redisConnecting = (async (): Promise<RedisClientType | null> => {
        try {
            const client = createClient({ url: redisUrl });
            await client.connect();
            redisClient = client as RedisClientType;
            return client as RedisClientType;
        } finally {
            redisConnecting = null;
        }
    })();

    return redisConnecting;
}

async function checkDb(): Promise<CheckResult> {
    try {
        const result = await db.execute(sql`SELECT 1 as ok`);
        if (!result || result.length === 0) {
            throw new Error("Database query returned no results");
        }
        return "ok";
    } catch (error) {
        logger.error({ error }, "Database health check failed");
        return "failed";
    }
}

async function checkRedis(): Promise<CheckResult> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return "skipped";
    }

    try {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Redis health check timeout")), 5000)
        );

        const client = await getRedisClient();
        if (!client) {
            return "skipped";
        }

        const pong = await Promise.race([client.ping(), timeoutPromise]);
        if (pong !== "PONG") {
            throw new Error(`Unexpected PING response: ${pong}`);
        }
        return "ok";
    } catch (error) {
        logger.error({ error }, "Redis health check failed");
        return "failed";
    }
}

async function checkTemporal(): Promise<CheckResult> {
    const address = process.env.TEMPORAL_ADDRESS;
    if (!address) {
        return "skipped";
    }

    try {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Temporal health check timeout")), 5000)
        );

        // Creates new connection per check - acceptable overhead since this is only
        // called by Sentry Uptime (5min intervals), not Render's frequent liveness checks
        const connectPromise = (async () => {
            const connection = await Connection.connect({ address });
            await connection.close();
        })();

        await Promise.race([connectPromise, timeoutPromise]);
        return "ok";
    } catch (error) {
        logger.error({ error }, "Temporal health check failed");
        return "failed";
    }
}

function parseChecks(checksParam: string | null): CheckName[] {
    if (!checksParam) {
        return [];
    }

    if (checksParam.toLowerCase() === "all") {
        return [...AVAILABLE_CHECKS];
    }

    return checksParam
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter((c): c is CheckName => AVAILABLE_CHECKS.includes(c as CheckName));
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const checksParam = request.nextUrl.searchParams.get("checks");
    const requestedChecks = parseChecks(checksParam);

    const checks: HealthChecks = {};
    const failures: string[] = [];

    // Run requested checks in parallel
    if (requestedChecks.length > 0) {
        const checkPromises = requestedChecks.map(async (check) => {
            let result: CheckResult;
            switch (check) {
                case "db":
                    result = await checkDb();
                    break;
                case "redis":
                    result = await checkRedis();
                    break;
                case "temporal":
                    result = await checkTemporal();
                    break;
            }
            checks[check] = result;
            if (result === "failed") {
                failures.push(check);
            }
        });

        await Promise.all(checkPromises);
    }

    const responseTime = Date.now() - startTime;
    const isHealthy = failures.length === 0;

    if (isHealthy) {
        logger.debug({ responseTime, checks }, "Health check passed");
    } else {
        logger.error({ responseTime, checks, failures }, "Health check failed");
    }

    return NextResponse.json(
        {
            status: isHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            ...(Object.keys(checks).length > 0 && { checks }),
            ...(failures.length > 0 && { failures }),
            responseTime: `${responseTime}ms`,
        },
        { status: isHealthy ? 200 : 503 }
    );
}
