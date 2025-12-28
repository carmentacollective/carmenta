/**
 * Resumable Stream Context
 *
 * Singleton for creating and resuming streams that survive connection drops.
 * Uses Redis to store stream chunks, enabling clients to resume from where they left off.
 *
 * Gracefully degrades when Redis is unavailable - streaming still works, just not resumable.
 */

import {
    createResumableStreamContext,
    type ResumableStreamContext,
} from "resumable-stream";
import { after } from "next/server";

import { logger } from "@/lib/logger";

let globalStreamContext: ResumableStreamContext | null = null;

/**
 * Get the global resumable stream context singleton.
 *
 * Creates the context on first call, reuses on subsequent calls.
 * Returns null if Redis is not configured (graceful degradation).
 */
export function getStreamContext(): ResumableStreamContext | null {
    if (globalStreamContext) {
        return globalStreamContext;
    }

    try {
        globalStreamContext = createResumableStreamContext({
            waitUntil: after,
        });
        logger.info({}, "Resumable stream context initialized");
        return globalStreamContext;
    } catch (error) {
        // Graceful degradation - streaming works, just not resumable
        if (error instanceof Error && error.message.includes("REDIS_URL")) {
            logger.info({}, "Resumable streams disabled (Redis not configured)");
        } else {
            logger.error({ error }, "Failed to create resumable stream context");
        }
        return null;
    }
}
