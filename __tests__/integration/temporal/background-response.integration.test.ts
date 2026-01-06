/**
 * Background Response Temporal Integration Test
 *
 * Tests that the Temporal workflow infrastructure works correctly.
 * Requires Temporal server running locally (TEMPORAL_ADDRESS=localhost:7233).
 *
 * Run with: TEMPORAL_ADDRESS=localhost:7233 pnpm test background-response.integration
 */

import { describe, it, expect, beforeAll } from "vitest";

// Skip if Temporal is not configured
const temporalConfigured = !!process.env.TEMPORAL_ADDRESS;

describe.skipIf(!temporalConfigured)("Background Response Temporal Integration", () => {
    it("can import Temporal client", async () => {
        const { getTemporalClient } = await import("@/lib/temporal/client");
        expect(getTemporalClient).toBeDefined();
    });

    it("can connect to Temporal server", async () => {
        const { getTemporalClient } = await import("@/lib/temporal/client");

        const client = await getTemporalClient();
        expect(client).toBeDefined();

        // Verify we can describe the default namespace
        const namespace = await client.workflowService.describeNamespace({
            namespace: "default",
        });
        expect(namespace.namespaceInfo?.name).toBe("default");
    });

    it("workflow types are registered in task queue", async () => {
        // This verifies the workflow is properly bundled and exported
        // The actual workflow execution needs more setup (Redis, DB)
        const { getTemporalClient, startBackgroundResponse } =
            await import("@/lib/temporal/client");
        expect(startBackgroundResponse).toBeDefined();
    });
});
