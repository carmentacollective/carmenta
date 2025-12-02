/**
 * Tests for web-intelligence module
 *
 * Tests the getWebIntelligenceProvider singleton factory.
 * Note: Most functionality is tested via the parallel.test.ts file.
 * This test focuses on the singleton pattern and env validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getWebIntelligenceProvider", () => {
    // Store original env value
    const originalEnv = process.env.PARALLEL_API_KEY;

    beforeEach(() => {
        // Clear any cached modules
        vi.resetModules();
    });

    afterEach(() => {
        vi.clearAllMocks();
        // Restore original env
        if (originalEnv !== undefined) {
            process.env.PARALLEL_API_KEY = originalEnv;
        } else {
            delete process.env.PARALLEL_API_KEY;
        }
    });

    it("throws error when PARALLEL_API_KEY is missing", async () => {
        // The vitest.setup.ts sets PARALLEL_API_KEY to undefined
        // which triggers the assertEnv error
        const { getWebIntelligenceProvider } =
            await import("@/lib/web-intelligence/index");

        expect(() => getWebIntelligenceProvider()).toThrow(
            "Missing required environment variable: PARALLEL_API_KEY"
        );
    });

    // Note: Testing the successful case requires mocking env.PARALLEL_API_KEY
    // before the module loads, which conflicts with the global mock in vitest.setup.ts.
    // The provider functionality is tested via parallel.test.ts which mocks
    // the provider directly rather than going through the singleton factory.
});
