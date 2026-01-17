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

// Set DISABLE_RESUMABLE_STREAMS=true to force fallback path for debugging
// This helps isolate whether streaming issues are in the resumable-stream layer
const DISABLE_RESUMABLE_STREAMS = process.env.DISABLE_RESUMABLE_STREAMS === "true";

let globalStreamContext: ResumableStreamContext | null = null;
let backgroundStreamContext: ResumableStreamContext | null = null;

/**
 * Get the global resumable stream context singleton.
 *
 * Creates the context on first call, reuses on subsequent calls.
 * Returns null if Redis is not configured (graceful degradation).
 */
export function getStreamContext(): ResumableStreamContext | null {
    // Debug flag to force non-resumable path
    if (DISABLE_RESUMABLE_STREAMS) {
        logger.warn({}, "Resumable streams disabled via DISABLE_RESUMABLE_STREAMS");
        return null;
    }

    if (globalStreamContext) {
        return globalStreamContext;
    }

    try {
        const context = createResumableStreamContext({
            waitUntil: after,
        });

        // Wrap createNewResumableStream to add timing diagnostics
        const originalCreate = context.createNewResumableStream.bind(context);
        context.createNewResumableStream = async (streamId, makeStream, skipChars) => {
            const startTime = Date.now();
            logger.debug({ streamId }, "createNewResumableStream: starting");

            const result = await originalCreate(streamId, makeStream, skipChars);

            logger.debug(
                { streamId, duration: Date.now() - startTime },
                "createNewResumableStream: returning stream"
            );

            return result;
        };

        globalStreamContext = context;
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

/**
 * Get stream context for background/Inngest use.
 *
 * Unlike getStreamContext(), this doesn't use next/server's `after` function,
 * making it suitable for use in Inngest functions and other background workers.
 * The function runs to completion naturally, so waitUntil is a no-op.
 */
export function getBackgroundStreamContext(): ResumableStreamContext | null {
    if (backgroundStreamContext) {
        return backgroundStreamContext;
    }

    try {
        // For background workers, waitUntil is a no-op since the function
        // runs to completion anyway (Inngest manages the lifecycle)
        backgroundStreamContext = createResumableStreamContext({
            waitUntil: async () => {
                // No-op: Inngest functions run to completion
            },
        });
        logger.info({}, "Background stream context initialized");
        return backgroundStreamContext;
    } catch (error) {
        if (error instanceof Error && error.message.includes("REDIS_URL")) {
            logger.info({}, "Background streams disabled (Redis not configured)");
        } else {
            logger.error({ error }, "Failed to create background stream context");
        }
        return null;
    }
}
