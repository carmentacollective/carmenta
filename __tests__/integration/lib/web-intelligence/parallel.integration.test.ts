/**
 * Integration tests for Parallel Web Intelligence Provider
 *
 * These tests make REAL API calls to Parallel's API.
 * They only run when PARALLEL_API_KEY is set in the environment.
 *
 * Run with: PARALLEL_API_KEY=your_key pnpm test -- --testPathPattern="integration"
 *
 * WARNING: These tests will consume API credits!
 */

import { describe, it, expect, beforeAll } from "vitest";

import { ParallelProvider } from "@/lib/web-intelligence/parallel";

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;

// Skip all tests if no API key is provided
const describeIfApiKey = PARALLEL_API_KEY ? describe : describe.skip;

describeIfApiKey("ParallelProvider Integration Tests", () => {
    let provider: ParallelProvider;

    beforeAll(() => {
        if (!PARALLEL_API_KEY) {
            throw new Error("PARALLEL_API_KEY must be set for integration tests");
        }
        provider = new ParallelProvider(PARALLEL_API_KEY);
    });

    describe("search", () => {
        it("returns real search results", async () => {
            const result = await provider.search("What is TypeScript?", {
                maxResults: 3,
            });

            console.log("Search result:", JSON.stringify(result, null, 2));

            expect(result).not.toBeNull();
            expect(result!.results).toBeInstanceOf(Array);
            expect(result!.results.length).toBeGreaterThan(0);
            expect(result!.results.length).toBeLessThanOrEqual(3);

            // Verify result structure
            const firstResult = result!.results[0];
            expect(firstResult).toHaveProperty("title");
            expect(firstResult).toHaveProperty("url");
            expect(firstResult).toHaveProperty("snippet");
            expect(typeof firstResult.title).toBe("string");
            expect(typeof firstResult.url).toBe("string");
            expect(firstResult.url).toMatch(/^https?:\/\//);

            // Verify metadata
            expect(result!.provider).toBe("parallel");
            expect(result!.query).toBe("What is TypeScript?");
            expect(typeof result!.latencyMs).toBe("number");
        }, 30000); // 30s timeout for API call
    });

    describe("extract", () => {
        it("extracts content from a real URL", async () => {
            // Use a stable, well-known URL
            const result = await provider.extract(
                "https://www.typescriptlang.org/docs/handbook/intro.html",
                { maxLength: 5000 }
            );

            console.log(
                "Extract result:",
                JSON.stringify(
                    {
                        ...result,
                        content: result?.content?.slice(0, 500) + "...",
                    },
                    null,
                    2
                )
            );

            expect(result).not.toBeNull();
            expect(result!.title).toBeTruthy();
            expect(result!.content).toBeTruthy();
            expect(result!.content.length).toBeGreaterThan(100);
            expect(result!.content.length).toBeLessThanOrEqual(5000 + 50); // Allow for truncation message

            // Verify metadata
            expect(result!.provider).toBe("parallel");
            expect(result!.url).toContain("typescriptlang.org");
            expect(typeof result!.latencyMs).toBe("number");
        }, 30000);

        it("handles non-existent URLs gracefully", async () => {
            const result = await provider.extract(
                "https://this-domain-definitely-does-not-exist-12345.com/page"
            );

            console.log("Extract non-existent result:", result);

            // Should return null or empty result, not throw
            // The exact behavior depends on Parallel's API
            expect(result === null || result?.content === "").toBe(true);
        }, 30000);
    });

    describe("research", () => {
        it("conducts quick research and returns structured results", async () => {
            // Use "quick" depth to minimize API costs and time
            console.log("Starting research test...");

            const result = await provider.research(
                "What are the main benefits of TypeScript over JavaScript?",
                { depth: "quick" }
            );

            console.log("Research result:", result);
            console.log(
                "Research result (stringified):",
                JSON.stringify(result, null, 2)
            );

            expect(result).not.toBeNull();
            expect(result!.summary).toBeTruthy();
            expect(typeof result!.summary).toBe("string");
            expect(result!.summary.length).toBeGreaterThan(50);

            // Verify structure
            expect(result!.findings).toBeInstanceOf(Array);
            expect(result!.sources).toBeInstanceOf(Array);

            // Should have at least some sources
            expect(result!.sources.length).toBeGreaterThan(0);

            // Verify source structure
            if (result!.sources.length > 0) {
                const firstSource = result!.sources[0];
                expect(firstSource).toHaveProperty("url");
                expect(firstSource).toHaveProperty("title");
                expect(firstSource.url).toMatch(/^https?:\/\//);
            }

            // Verify metadata
            expect(result!.provider).toBe("parallel");
            expect(result!.objective).toContain("TypeScript");
            expect(typeof result!.latencyMs).toBe("number");
        }, 90000); // 90s timeout for research (can take a while)
    });

    describe("API response validation", () => {
        it("validates that Zod schemas match actual API responses", async () => {
            // This test specifically verifies our Zod schemas work with real responses
            // If this fails, our schemas are out of sync with Parallel's API

            const searchResult = await provider.search("test query", { maxResults: 1 });
            expect(searchResult).not.toBeNull();
            // If we got here without throwing, Zod validation passed

            const extractResult = await provider.extract("https://example.com");
            // extract might return null for example.com, that's fine
            // the point is it shouldn't throw a Zod validation error
            expect(
                extractResult === null || typeof extractResult.content === "string"
            ).toBe(true);
        }, 30000);
    });
});
