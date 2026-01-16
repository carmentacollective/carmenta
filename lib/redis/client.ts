/**
 * Redis Client
 *
 * Shared Redis client singleton for caching across the application.
 * Gracefully degrades when Redis is unavailable.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient, type RedisClientType } from "redis";

import { logger } from "@/lib/logger";

let redisClient: RedisClientType | null = null;
let redisConnecting: Promise<RedisClientType | null> | null = null;

/**
 * Get the Redis client singleton.
 * Returns null if REDIS_URL is not configured (graceful degradation).
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
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
            logger.info({}, "Redis client connected");
            return client as RedisClientType;
        } catch (error) {
            logger.error({ error }, "Failed to connect to Redis");
            Sentry.captureException(error, {
                level: "error",
                tags: { component: "redis", operation: "connect" },
            });
            return null;
        } finally {
            redisConnecting = null;
        }
    })();

    return redisConnecting;
}
