/**
 * Parallel Web Intelligence Provider - Real API Integration Tests
 *
 * These tests hit the real Parallel API to verify our Zod schemas match
 * the actual API responses. This catches schema drift that mocked tests miss.
 *
 * Run with:
 *   PARALLEL_API_KEY=your_key pnpm test parallel-api.integration
 *
 * Without PARALLEL_API_KEY, tests are automatically skipped.
 */

import { describe, it, expect, beforeAll } from "vitest";

import { ParallelProvider } from "@/lib/web-intelligence/parallel";

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
const describeIf = PARALLEL_API_KEY ? describe : describe.skip;

describeIf("ParallelProvider - Real API Integration", () => {
    let provider: ParallelProvider;

    beforeAll(() => {
        // TypeScript knows this is defined because describeIf skips when undefined
        provider = new ParallelProvider(PARALLEL_API_KEY as string);
    });

    describe("search API schema validation", () => {
        it("validates search response matches Zod schema", async () => {
            // This is the test that would have caught CARMENTA-22
            // Real API returns publish_date: undefined for some results
            const result = await provider.search("What is TypeScript?", {
                maxResults: 3,
            });

            expect(result).not.toBeNull();
            expect(result!.results).toBeInstanceOf(Array);
            expect(result!.results.length).toBeGreaterThan(0);
            expect(result!.provider).toBe("parallel");

            // Verify structure of each result
            for (const r of result!.results) {
                expect(typeof r.title).toBe("string");
                expect(typeof r.url).toBe("string");
                expect(r.url).toMatch(/^https?:\/\//);
                // snippet can be empty string if no excerpts
                expect(typeof r.snippet).toBe("string");
                // publishedDate is optional - may or may not be present
                if (r.publishedDate !== undefined) {
                    expect(typeof r.publishedDate).toBe("string");
                }
            }
        }, 30000);

        it("handles unusual queries without throwing", async () => {
            // Verify the API handles edge cases gracefully
            // Modern search APIs are good at finding something for anything
            const result = await provider.search("xyzzy plugh 12345", {
                maxResults: 1,
            });

            // Should return a valid response structure (even if results found)
            // The point is it doesn't throw a schema validation error
            expect(result === null || Array.isArray(result.results)).toBe(true);
        }, 30000);
    });

    describe("extract API schema validation", () => {
        it("validates extract response matches Zod schema", async () => {
            const result = await provider.extract("https://example.com", {
                maxLength: 5000,
            });

            expect(result).not.toBeNull();
            expect(result!.title).toBeTruthy();
            expect(typeof result!.content).toBe("string");
            expect(result!.provider).toBe("parallel");
            expect(result!.url).toContain("example.com");
        }, 30000);

        it("handles error responses gracefully", async () => {
            // Use a URL that will fail extraction (not a web page)
            const result = await provider.extract(
                "https://example.com/nonexistent-page-404"
            );

            // Should return null or valid response, not throw schema error
            // The API may return an error or empty content for 404 pages
            expect(result === null || typeof result.content === "string").toBe(true);
        }, 30000);
    });

    describe("research API schema validation", () => {
        it("validates research response matches Zod schema", async () => {
            // Use light depth to minimize cost and time
            const result = await provider.research(
                "What are the main benefits of TypeScript?",
                { depth: "light" }
            );

            expect(result).not.toBeNull();
            expect(typeof result!.summary).toBe("string");
            expect(result!.findings).toBeInstanceOf(Array);
            expect(result!.sources).toBeInstanceOf(Array);
            expect(result!.provider).toBe("parallel");

            // Verify source structure
            for (const source of result!.sources) {
                expect(typeof source.url).toBe("string");
                expect(source.url).toMatch(/^https?:\/\//);
                expect(typeof source.title).toBe("string");
            }
        }, 120000); // Research can take up to 2 minutes
    });

    describe("edge cases", () => {
        it("research returns null for instant depth (no external research)", async () => {
            // instant depth signals "answer from memory" - should return null
            const result = await provider.research("What is TypeScript?", {
                depth: "instant",
            });
            expect(result).toBeNull();
        }, 5000);

        it("includes latencyMs in all response types", async () => {
            const searchResult = await provider.search("test", { maxResults: 1 });
            expect(searchResult).not.toBeNull();
            expect(typeof searchResult!.latencyMs).toBe("number");
            expect(searchResult!.latencyMs).toBeGreaterThan(0);

            const extractResult = await provider.extract("https://example.com");
            expect(extractResult).not.toBeNull();
            expect(typeof extractResult!.latencyMs).toBe("number");
            expect(extractResult!.latencyMs).toBeGreaterThan(0);
        }, 60000);
    });
});
