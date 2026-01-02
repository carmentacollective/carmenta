/**
 * Temporal Worker - Executes scheduled agent workflows
 *
 * This worker connects to the Temporal server and polls for tasks.
 * When a scheduled job fires, Temporal dispatches the workflow to this worker.
 */

import * as Sentry from "@sentry/node";
import { NativeConnection, Worker } from "@temporalio/worker";
import { logger } from "../lib/logger";
import * as activities from "./activities";

// Initialize Sentry for error tracking in the worker
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    initialScope: {
        tags: {
            component: "temporal-worker",
        },
    },
});

/**
 * Serialize errors for structured logging
 * gRPC errors and other complex errors don't serialize well with JSON.stringify
 */
function serializeError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
            // Capture gRPC-specific properties if present
            ...(("code" in err && { code: err.code }) || {}),
            ...(("details" in err && { details: err.details }) || {}),
            // Only capture metadata keys, not values (may contain auth tokens)
            ...(("metadata" in err &&
                typeof err.metadata === "object" &&
                err.metadata !== null && { metadataKeys: Object.keys(err.metadata) }) ||
                {}),
        };
    }
    return { raw: String(err) };
}

async function run() {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";

    logger.info({ temporalAddress }, "Connecting to Temporal");

    const connection = await NativeConnection.connect({
        address: temporalAddress,
    });

    const worker = await Worker.create({
        connection,
        namespace: "default",
        taskQueue: "scheduled-agents",
        workflowsPath: require.resolve("./workflows"),
        activities,
    });

    logger.info("Worker started, polling for tasks");
    await worker.run();
}

run().catch(async (err) => {
    const serializedError = serializeError(err);
    logger.error({ error: serializedError }, "Worker failed");

    Sentry.captureException(err, {
        tags: { component: "temporal-worker", action: "startup" },
        extra: { serializedError },
    });

    // Wait for Sentry to flush before exiting
    await Sentry.flush(2000);
    process.exit(1);
});
