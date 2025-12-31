/**
 * Temporal Worker - Executes scheduled agent workflows
 *
 * This worker connects to the Temporal server and polls for tasks.
 * When a scheduled job fires, Temporal dispatches the workflow to this worker.
 */

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";

async function run() {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost";
    const temporalPort = process.env.TEMPORAL_PORT || "7233";

    console.log(`Connecting to Temporal at ${temporalAddress}:${temporalPort}`);

    const connection = await NativeConnection.connect({
        address: `${temporalAddress}:${temporalPort}`,
    });

    const worker = await Worker.create({
        connection,
        namespace: "default",
        taskQueue: "scheduled-agents",
        workflowsPath: require.resolve("./workflows"),
        activities,
    });

    console.log("Worker started, polling for tasks...");
    await worker.run();
}

run().catch((err) => {
    console.error("Worker failed:", err);
    process.exit(1);
});
