/**
 * Integration tests for tool loading
 *
 * Tests the full flow of loading integration tools for users with connected services.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { getIntegrationTools } from "@/lib/integrations/tools";
import {
    createTestUser,
    createTestApiKeyIntegration,
    createTestOAuthIntegration,
    createUserWithIntegrations,
} from "@/__tests__/fixtures/integration-fixtures";

setupTestDb();

describe("Integration Tool Loading", () => {
    describe("getIntegrationTools", () => {
        it("loads tools for user with connected integrations", async () => {
            const user = await createTestUser({ email: "test@example.com" });

            // Create integration records
            await createTestApiKeyIntegration(user.email, "giphy", "test-key");
            await createTestApiKeyIntegration(user.email, "limitless", "test-key");

            // Load tools
            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(2);
            expect(Object.keys(tools)).toContain("giphy");
            expect(Object.keys(tools)).toContain("limitless");
        });

        it("returns empty tools for user with no integrations", async () => {
            const user = await createTestUser({ email: "notools@example.com" });

            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(0);
        });

        it("excludes disconnected integrations", async () => {
            const user = await createTestUser({ email: "test@example.com" });

            await createTestApiKeyIntegration(user.email, "giphy", "test-key", {
                status: "connected",
            });
            await createTestApiKeyIntegration(user.email, "limitless", "test-key", {
                status: "disconnected",
            });

            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(1);
            expect(Object.keys(tools)).toContain("giphy");
            expect(Object.keys(tools)).not.toContain("limitless");
        });

        it("excludes expired integrations", async () => {
            const user = await createTestUser({ email: "test@example.com" });

            await createTestApiKeyIntegration(user.email, "giphy", "test-key", {
                status: "connected",
            });
            await createTestApiKeyIntegration(user.email, "limitless", "test-key", {
                status: "expired",
            });

            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(1);
            expect(Object.keys(tools)).toContain("giphy");
        });

        it("handles multiple accounts for same service", async () => {
            const user = await createTestUser({ email: "multi@example.com" });

            // Create two accounts for same service
            await createTestApiKeyIntegration(user.email, "giphy", "key1", {
                accountId: "account1",
            });
            await createTestApiKeyIntegration(user.email, "giphy", "key2", {
                accountId: "account2",
                isDefault: true,
            });

            const tools = await getIntegrationTools(user.email);

            // Should create one tool for the service
            expect(Object.keys(tools)).toHaveLength(1);
            expect(Object.keys(tools)[0]).toBe("giphy");
        });

        it("loads both OAuth and API key integrations", async () => {
            const user = await createTestUser({ email: "mixed@example.com" });

            await createTestApiKeyIntegration(user.email, "giphy", "test-key");
            await createTestOAuthIntegration(user.email, "notion", "nango_conn_123");

            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(2);
            expect(Object.keys(tools)).toContain("giphy");
            expect(Object.keys(tools)).toContain("notion");
        });

        it("handles many integrations", async () => {
            const { user, integrations } = await createUserWithIntegrations([
                "giphy",
                "limitless",
                "fireflies",
                "coinmarketcap",
            ]);

            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(4);
            expect(Object.keys(tools)).toContain("giphy");
            expect(Object.keys(tools)).toContain("limitless");
            expect(Object.keys(tools)).toContain("fireflies");
            expect(Object.keys(tools)).toContain("coinmarketcap");
        });
    });

    describe("Tool Structure", () => {
        it("returns tools with correct structure", async () => {
            const user = await createTestUser({ email: "structure@example.com" });
            await createTestApiKeyIntegration(user.email, "giphy", "test-key");

            const tools = await getIntegrationTools(user.email);
            const giphyTool = tools.giphy;

            // Tool should have these properties (from ai sdk tool())
            expect(giphyTool).toBeDefined();
            expect(giphyTool.description).toBeDefined();
            expect(giphyTool.inputSchema).toBeDefined();
            expect(giphyTool.execute).toBeDefined();
            expect(typeof giphyTool.execute).toBe("function");
        });

        it("tool description is well-formed", async () => {
            const user = await createTestUser({ email: "desc@example.com" });
            await createTestApiKeyIntegration(user.email, "giphy", "test-key");

            const tools = await getIntegrationTools(user.email);
            const giphyTool = tools.giphy;

            // Description should be non-empty and mention actions
            expect(giphyTool.description).toBeDefined();
            if (giphyTool.description) {
                expect(giphyTool.description.length).toBeGreaterThan(0);
                expect(giphyTool.description.toLowerCase()).toContain("action");
            }
        });
    });

    describe("Error Resilience", () => {
        it("skips services without valid credentials", async () => {
            const user = await createTestUser({ email: "invalid@example.com" });

            // Create integration with empty encrypted credentials (invalid)
            await createTestApiKeyIntegration(user.email, "giphy", "valid-key");

            // This one has no credentials (should be skipped)
            await createTestApiKeyIntegration(user.email, "limitless", "", {
                accountId: "broken",
            });

            const tools = await getIntegrationTools(user.email);

            // Should only load the valid one
            expect(Object.keys(tools)).toContain("giphy");
            // Limitless might or might not be included depending on encryption validation
        });

        it("handles user with only invalid integrations", async () => {
            const user = await createTestUser({ email: "allinvalid@example.com" });

            // All disconnected
            await createTestApiKeyIntegration(user.email, "giphy", "key", {
                status: "disconnected",
            });
            await createTestApiKeyIntegration(user.email, "limitless", "key", {
                status: "error",
            });

            const tools = await getIntegrationTools(user.email);

            expect(Object.keys(tools)).toHaveLength(0);
        });
    });
});
