/**
 * Temporal Worker - Executes scheduled agent workflows
 *
 * This worker connects to the Temporal server and polls for tasks.
 * When a scheduled job fires, Temporal dispatches the workflow to this worker.
 */

import { NativeConnection, Worker } from "@temporalio/worker";
import { logger } from "../lib/logger";
import * as activities from "./activities";

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

run().catch((err) => {
    logger.error({ error: err }, "Worker failed");
    process.exit(1);
});
