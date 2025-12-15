/**
 * Integration tests for Fireflies Adapter - Real API Calls
 *
 * These tests make actual API calls to Fireflies.ai and are skipped unless FIREFLIES_API_KEY is set.
 * To run: FIREFLIES_API_KEY=your_key_here pnpm test fireflies.integration
 *
 * Note: Fireflies uses a GraphQL API (not REST). Free plan has 50 calls/day limit.
 * Tests are designed to be conservative with API calls.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { FirefliesAdapter } from "@/lib/integrations/adapters/fireflies";
import {
    createTestUser,
    createTestApiKeyIntegration,
} from "@/__tests__/fixtures/integration-fixtures";

// Skip these tests unless FIREFLIES_API_KEY environment variable is set
const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;
const describeIf = FIREFLIES_API_KEY ? describe : describe.skip;

setupTestDb();

describeIf("FirefliesAdapter - Real API Integration", () => {
    let adapter: FirefliesAdapter;
    const testUserEmail = "fireflies-integration-test@carmenta.ai";
    // TypeScript narrowing: Inside this block, FIREFLIES_API_KEY is guaranteed to be defined
    // because describeIf skips the entire suite when it's undefined
    const apiKey = FIREFLIES_API_KEY as string;

    beforeEach(async () => {
        adapter = new FirefliesAdapter();

        // Create test user and integration with real API key
        const user = await createTestUser({ email: testUserEmail });
        await createTestApiKeyIntegration(user.email, "fireflies", apiKey, {
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
        }, 15000); // Longer timeout - invalid key validation can be slow
    });

    describe("list_transcripts operation", () => {
        it("lists recent meetings successfully", async () => {
            const result = await adapter.execute(
                "list_transcripts",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");

            // Parse the JSON response
            const response = JSON.parse(result.content[0].text!);

            expect(response.totalCount).toBeDefined();
            expect(response.transcripts).toBeDefined();
            expect(Array.isArray(response.transcripts)).toBe(true);

            // If there are results, verify structure
            if (response.transcripts.length > 0) {
                const firstTranscript = response.transcripts[0];
                expect(firstTranscript).toHaveProperty("id");
                expect(firstTranscript).toHaveProperty("title");
                expect(firstTranscript).toHaveProperty("date");
                expect(firstTranscript).toHaveProperty("duration");
                expect(firstTranscript).toHaveProperty("organizer");
                expect(firstTranscript).toHaveProperty("overview");
            }
        }, 15000); // Longer timeout for API calls

        it("respects limit parameter", async () => {
            const result = await adapter.execute(
                "list_transcripts",
                { limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.transcripts.length).toBeLessThanOrEqual(3);
        }, 15000); // Longer timeout for API calls

        it("handles empty results gracefully", async () => {
            // If the account has no transcripts, should return empty array
            const result = await adapter.execute(
                "list_transcripts",
                { limit: 1 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.transcripts).toBeDefined();
            expect(Array.isArray(response.transcripts)).toBe(true);
        });

        it("returns summary data including action items and keywords", async () => {
            const result = await adapter.execute(
                "list_transcripts",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);

            // If there are transcripts, verify summary fields exist
            if (response.transcripts.length > 0) {
                const transcript = response.transcripts[0];
                // These fields should be present (may be empty strings)
                expect(transcript).toHaveProperty("overview");
                expect(transcript).toHaveProperty("actionItems");
                expect(transcript).toHaveProperty("keywords");
            }
        });
    });

    describe("get_transcript operation", () => {
        let validTranscriptId: string | null = null;

        beforeEach(async () => {
            // Try to get a valid transcript ID for testing
            const listResult = await adapter.execute(
                "list_transcripts",
                { limit: 1 },
                testUserEmail
            );

            if (!listResult.isError) {
                const response = JSON.parse(listResult.content[0].text!);
                if (response.transcripts && response.transcripts.length > 0) {
                    validTranscriptId = response.transcripts[0].id;
                }
            }
        });

        it("retrieves full transcript when valid ID exists", async () => {
            if (!validTranscriptId) {
                console.log(
                    "Skipping get_transcript test: No transcripts available in account"
                );
                return;
            }

            const result = await adapter.execute(
                "get_transcript",
                { transcriptId: validTranscriptId },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].type).toBe("text");

            // The response is formatted markdown text, not JSON
            const text = result.content[0].text!;
            expect(text).toContain("**"); // Contains markdown formatting
        });

        it("validates required transcriptId parameter", async () => {
            const result = await adapter.execute(
                "get_transcript",
                {}, // Missing required 'transcriptId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: transcriptId/
            );
        });

        it("handles invalid transcript ID gracefully", async () => {
            const result = await adapter.execute(
                "get_transcript",
                { transcriptId: "invalid-transcript-id-12345" },
                testUserEmail
            );

            // Should return an error for invalid ID
            expect(result.isError).toBe(true);
        });
    });

    describe("search_transcripts operation", () => {
        // Note: search_transcripts uses the keyword filter in Fireflies GraphQL API
        // The API may return 400 if the scope parameter isn't supported in your plan
        // Tests gracefully handle both success and API limitations

        it("searches transcripts by query or handles API limitations", async () => {
            const result = await adapter.execute(
                "search_transcripts",
                { query: "meeting", limit: 5 },
                testUserEmail
            );

            // Search might fail due to API plan limitations (scope param)
            // Accept either success or a clear error message
            if (result.isError) {
                // API limitation is acceptable - verify error is informative
                expect(result.content[0].text).toMatch(/search|400|bad request/i);
            } else {
                expect(result.content).toHaveLength(1);
                expect(result.content[0].type).toBe("text");

                const response = JSON.parse(result.content[0].text!);
                expect(response.query).toBe("meeting");
                expect(response.totalCount).toBeDefined();
                expect(response.results).toBeDefined();
                expect(Array.isArray(response.results)).toBe(true);
            }
        });

        it("respects limit parameter when search succeeds", async () => {
            const result = await adapter.execute(
                "search_transcripts",
                { query: "test", limit: 3 },
                testUserEmail
            );

            // Skip assertion if API returns error (plan limitations)
            if (!result.isError) {
                const response = JSON.parse(result.content[0].text!);
                expect(response.results.length).toBeLessThanOrEqual(3);
            }
        });

        it("handles empty search results or API limitations gracefully", async () => {
            const result = await adapter.execute(
                "search_transcripts",
                {
                    query: "xyzabc123456789impossiblequerythatwontmatchanything",
                    limit: 5,
                },
                testUserEmail
            );

            // Accept either empty results or API error
            if (!result.isError) {
                const response = JSON.parse(result.content[0].text!);
                expect(response.results).toEqual([]);
                expect(response.totalCount).toBe(0);
            }
        });

        it("validates required query parameter", async () => {
            const result = await adapter.execute(
                "search_transcripts",
                {}, // Missing required 'query' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/Missing required parameter: query/);
        });
    });

    describe("generate_summary operation", () => {
        let validTranscriptId: string | null = null;

        beforeEach(async () => {
            const listResult = await adapter.execute(
                "list_transcripts",
                { limit: 1 },
                testUserEmail
            );

            if (!listResult.isError) {
                const response = JSON.parse(listResult.content[0].text!);
                if (response.transcripts && response.transcripts.length > 0) {
                    validTranscriptId = response.transcripts[0].id;
                }
            }
        });

        it("generates summary for transcript when valid ID exists", async () => {
            if (!validTranscriptId) {
                console.log(
                    "Skipping generate_summary test: No transcripts available in account"
                );
                return;
            }

            const result = await adapter.execute(
                "generate_summary",
                { transcriptId: validTranscriptId },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].type).toBe("text");

            // Summary is formatted markdown text
            const text = result.content[0].text!;
            expect(text).toContain("Summary");
        });

        it("supports format parameter (bullet_points)", async () => {
            if (!validTranscriptId) {
                console.log(
                    "Skipping generate_summary format test: No transcripts available"
                );
                return;
            }

            const result = await adapter.execute(
                "generate_summary",
                { transcriptId: validTranscriptId, format: "bullet_points" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
        });

        it("supports format parameter (paragraph)", async () => {
            if (!validTranscriptId) {
                console.log(
                    "Skipping generate_summary format test: No transcripts available"
                );
                return;
            }

            const result = await adapter.execute(
                "generate_summary",
                { transcriptId: validTranscriptId, format: "paragraph" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
        });

        it("validates required transcriptId parameter", async () => {
            const result = await adapter.execute(
                "generate_summary",
                {}, // Missing required 'transcriptId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: transcriptId/
            );
        });
    });

    describe("raw_api operation", () => {
        it("executes GraphQL queries successfully", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    query: "{ user { user_id name email } }",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.user).toBeDefined();
            expect(response.user.user_id).toBeDefined();
        });

        it("validates required query parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                {}, // Missing required 'query' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            // Error message format: "Missing required parameter: query"
            expect(result.content[0].text).toMatch(/missing.*query|query.*required/i);
        });

        it("handles GraphQL variables", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    query: `
                        query ListTranscripts($limit: Int!) {
                            transcripts(limit: $limit) {
                                id
                                title
                            }
                        }
                    `,
                    variables: { limit: 2 },
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.transcripts).toBeDefined();
        });
    });

    describe("Error Handling", () => {
        it("returns error when service not connected", async () => {
            const nonExistentUser = "no-fireflies-connection@example.com";
            await createTestUser({ email: nonExistentUser });

            const result = await adapter.execute(
                "list_transcripts",
                { limit: 5 },
                nonExistentUser
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/connect.*fireflies/i);
        });

        it("handles unknown operation gracefully", async () => {
            const result = await adapter.execute(
                "unknown_operation",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/unknown action/i);
        });
    });
});
