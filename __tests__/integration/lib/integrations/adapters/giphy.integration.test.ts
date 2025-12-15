/**
 * Integration tests for Giphy Adapter - Real API Calls
 *
 * These tests make actual API calls to Giphy and are skipped unless GIPHY_API_KEY is set.
 * To run: GIPHY_API_KEY=your_key_here pnpm test giphy.integration
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { GiphyAdapter } from "@/lib/integrations/adapters/giphy";
import {
    createTestUser,
    createTestApiKeyIntegration,
} from "@/__tests__/fixtures/integration-fixtures";

// Skip these tests unless GIPHY_API_KEY environment variable is set
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const describeIf = GIPHY_API_KEY ? describe : describe.skip;

setupTestDb();

describeIf("GiphyAdapter - Real API Integration", () => {
    let adapter: GiphyAdapter;
    const testUserEmail = "giphy-integration-test@carmenta.ai";
    // TypeScript narrowing: Inside this block, GIPHY_API_KEY is guaranteed to be defined
    // because describeIf skips the entire suite when it's undefined
    const apiKey = GIPHY_API_KEY as string;

    beforeEach(async () => {
        adapter = new GiphyAdapter();

        // Create test user and integration with real API key
        const user = await createTestUser({ email: testUserEmail });
        await createTestApiKeyIntegration(user.email, "giphy", apiKey, {
            accountId: "test-account",
        });
    });

    describe("Connection Testing", () => {
        it("validates API key successfully", async () => {
            const result = await adapter.testConnection(apiKey);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("rejects invalid API key", async () => {
            const result = await adapter.testConnection("invalid-api-key-12345");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toMatch(/invalid.*api.*key/i);
        });
    });

    describe("search operation", () => {
        it("searches for GIFs successfully", async () => {
            const result = await adapter.execute(
                "search",
                { query: "celebration", limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");

            // Parse the JSON response
            const response = JSON.parse(result.content[0].text!);

            expect(response.query).toBe("celebration");
            expect(response.results).toBeDefined();
            expect(Array.isArray(response.results)).toBe(true);
            expect(response.results.length).toBeGreaterThan(0);
            expect(response.results.length).toBeLessThanOrEqual(5);

            // Verify GIF structure
            const firstGif = response.results[0];
            expect(firstGif).toHaveProperty("id");
            expect(firstGif).toHaveProperty("title");
            expect(firstGif).toHaveProperty("url");
            expect(firstGif).toHaveProperty("rating");
            expect(firstGif).toHaveProperty("images");

            // Verify image URLs are valid
            expect(firstGif.images.original.url).toMatch(/^https?:\/\//);
            expect(firstGif.images.fixed_height.url).toMatch(/^https?:\/\//);
            expect(firstGif.images.fixed_width.url).toMatch(/^https?:\/\//);
        });

        it("handles empty search results gracefully", async () => {
            const result = await adapter.execute(
                "search",
                { query: "xyzabc123456789impossiblequery", limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results).toEqual([]);
            expect(response.totalCount).toBe(0);
            expect(response.message).toContain("No GIFs found");
        });

        it("respects limit parameter", async () => {
            const result = await adapter.execute(
                "search",
                { query: "cat", limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results.length).toBeLessThanOrEqual(3);
        });

        it("applies rating filter correctly", async () => {
            const result = await adapter.execute(
                "search",
                { query: "funny", limit: 5, rating: "g" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results).toBeDefined();

            // All results should have rating 'g'
            response.results.forEach((gif: { rating: string }) => {
                expect(gif.rating).toBe("g");
            });
        });
    });

    describe("get_random operation", () => {
        it("retrieves a random GIF", async () => {
            const result = await adapter.execute("get_random", {}, testUserEmail);

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.result).toBeDefined();
            expect(response.result).toHaveProperty("id");
            expect(response.result).toHaveProperty("title");
            expect(response.result).toHaveProperty("url");
            expect(response.result).toHaveProperty("images");
        });

        it("retrieves random GIF with tag filter", async () => {
            const result = await adapter.execute(
                "get_random",
                { tag: "dog" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.result).toBeDefined();
            expect(response.result.id).toBeDefined();
        });

        it("applies rating filter to random GIF", async () => {
            const result = await adapter.execute(
                "get_random",
                { rating: "g" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.result.rating).toBe("g");
        });
    });

    describe("get_trending operation", () => {
        it("retrieves trending GIFs", async () => {
            const result = await adapter.execute(
                "get_trending",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results).toBeDefined();
            expect(Array.isArray(response.results)).toBe(true);
            expect(response.results.length).toBeGreaterThan(0);
            expect(response.results.length).toBeLessThanOrEqual(5);

            // Verify trending GIF structure
            const firstGif = response.results[0];
            expect(firstGif).toHaveProperty("id");
            expect(firstGif).toHaveProperty("title");
            expect(firstGif).toHaveProperty("images");
        });

        it("respects limit parameter for trending", async () => {
            const result = await adapter.execute(
                "get_trending",
                { limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results.length).toBeLessThanOrEqual(3);
        });
    });

    describe("Error Handling", () => {
        it("returns error when service not connected", async () => {
            const nonExistentUser = "no-connection@example.com";
            await createTestUser({ email: nonExistentUser });

            const result = await adapter.execute(
                "search",
                { query: "test" },
                nonExistentUser
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/connect.*giphy/i);
        });

        it("validates required parameters", async () => {
            const result = await adapter.execute(
                "search",
                {}, // Missing required 'query' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("query");
        });
    });

    describe("Raw API operation", () => {
        it("executes raw API calls successfully", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/gifs/search",
                    method: "GET",
                    query: { q: "excited", limit: "3" },
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
            expect(Array.isArray(response.data)).toBe(true);
        });

        it("validates endpoint format", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "invalid-endpoint", // Should start with /v1/
                    method: "GET",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("must start with '/v1/'");
        });
    });
});
