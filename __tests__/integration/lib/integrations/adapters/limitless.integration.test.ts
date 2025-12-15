/**
 * Integration tests for Limitless Adapter - Real API Calls
 *
 * These tests make actual API calls to Limitless and are skipped unless LIMITLESS_API_KEY is set.
 * To run: LIMITLESS_API_KEY=your_key_here pnpm test limitless.integration
 *
 * Note: Destructive operations (delete_lifelog, delete_chat) only test parameter validation
 * to avoid accidentally deleting real user data. Use caution if modifying these tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { LimitlessAdapter } from "@/lib/integrations/adapters/limitless";
import {
    createTestUser,
    createTestApiKeyIntegration,
} from "@/__tests__/fixtures/integration-fixtures";

// Skip these tests unless LIMITLESS_API_KEY environment variable is set
const LIMITLESS_API_KEY = process.env.LIMITLESS_API_KEY;
const describeIf = LIMITLESS_API_KEY ? describe : describe.skip;

setupTestDb();

describeIf("LimitlessAdapter - Real API Integration", () => {
    let adapter: LimitlessAdapter;
    const testUserEmail = "limitless-integration-test@carmenta.ai";
    // TypeScript narrowing: Inside this block, LIMITLESS_API_KEY is guaranteed to be defined
    // because describeIf skips the entire suite when it's undefined
    const apiKey = LIMITLESS_API_KEY as string;

    beforeEach(async () => {
        adapter = new LimitlessAdapter();

        // Create test user and integration with real API key
        const user = await createTestUser({ email: testUserEmail });
        await createTestApiKeyIntegration(user.email, "limitless", apiKey, {
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
            expect(result.error).toMatch(/invalid|unauthorized|forbidden/i);
        });
    });

    describe("search operation", () => {
        it("searches lifelogs by query successfully", async () => {
            const result = await adapter.execute(
                "search",
                { query: "meeting", limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");

            // Parse the JSON response
            const response = JSON.parse(result.content[0].text!);

            expect(response.query).toBe("meeting");
            expect(response.totalCount).toBeDefined();
            expect(response.results).toBeDefined();
            expect(Array.isArray(response.results)).toBe(true);

            // If there are results, verify structure
            if (response.results.length > 0) {
                const firstResult = response.results[0];
                expect(firstResult).toHaveProperty("id");
                expect(firstResult).toHaveProperty("title");
                expect(firstResult).toHaveProperty("startedAt");
                expect(firstResult).toHaveProperty("endedAt");
            }
        });

        it("respects limit parameter", async () => {
            const result = await adapter.execute(
                "search",
                { query: "conversation", limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results.length).toBeLessThanOrEqual(3);
        });

        it("filters by date", async () => {
            // Use today's date for filtering
            const today = new Date().toISOString().split("T")[0];

            const result = await adapter.execute(
                "search",
                { query: "test", date: today, limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results).toBeDefined();
            expect(Array.isArray(response.results)).toBe(true);
        });

        it("handles empty search results gracefully", async () => {
            const result = await adapter.execute(
                "search",
                {
                    query: "xyzabc123456789impossiblequerythatwontmatchanything",
                    limit: 5,
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.results).toEqual([]);
            expect(response.totalCount).toBe(0);
            expect(response.message).toContain("No Lifelogs found");
        });

        it("validates required query parameter", async () => {
            const result = await adapter.execute(
                "search",
                {}, // Missing required 'query' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/Missing required parameter: query/);
        });
    });

    describe("list_recordings operation", () => {
        it("lists lifelogs successfully", async () => {
            const result = await adapter.execute(
                "list_recordings",
                { limit: 5 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.totalCount).toBeDefined();
            expect(response.lifelogs).toBeDefined();
            expect(Array.isArray(response.lifelogs)).toBe(true);

            // If there are results, verify structure
            if (response.lifelogs.length > 0) {
                const firstLifelog = response.lifelogs[0];
                expect(firstLifelog).toHaveProperty("id");
                expect(firstLifelog).toHaveProperty("title");
                expect(firstLifelog).toHaveProperty("startedAt");
                expect(firstLifelog).toHaveProperty("endedAt");
            }
        });

        it("filters by specific date", async () => {
            const today = new Date().toISOString().split("T")[0];

            const result = await adapter.execute(
                "list_recordings",
                { date: today, limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.lifelogs).toBeDefined();
            expect(Array.isArray(response.lifelogs)).toBe(true);
        });

        it("supports start and end datetime filters", async () => {
            // Use a recent time range
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const result = await adapter.execute(
                "list_recordings",
                {
                    start: oneWeekAgo.toISOString().split("T")[0],
                    end: now.toISOString().split("T")[0],
                    limit: 5,
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.lifelogs).toBeDefined();
        });

        it("respects limit parameter", async () => {
            const result = await adapter.execute(
                "list_recordings",
                { limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.lifelogs.length).toBeLessThanOrEqual(3);
        });
    });

    describe("get_lifelog operation", () => {
        // We need to first get a valid lifelog ID from list_recordings
        let validLifelogId: string | null = null;

        beforeEach(async () => {
            // Try to get a valid lifelog ID for testing
            const listResult = await adapter.execute(
                "list_recordings",
                { limit: 1 },
                testUserEmail
            );

            if (!listResult.isError) {
                const response = JSON.parse(listResult.content[0].text!);
                if (response.lifelogs && response.lifelogs.length > 0) {
                    validLifelogId = response.lifelogs[0].id;
                }
            }
        });

        it("retrieves full lifelog details when valid ID exists", async () => {
            if (!validLifelogId) {
                // Skip if no lifelogs exist - this is not a test failure
                console.log(
                    "Skipping get_lifelog test: No lifelogs available in account"
                );
                return;
            }

            const result = await adapter.execute(
                "get_lifelog",
                { lifelogId: validLifelogId },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response).toHaveProperty("id");
            expect(response).toHaveProperty("summary");
            expect(response).toHaveProperty("startedAt");
            expect(response).toHaveProperty("endedAt");
        });

        it("validates required lifelogId parameter", async () => {
            const result = await adapter.execute(
                "get_lifelog",
                {}, // Missing required 'lifelogId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: lifelogId/
            );
        });

        it("handles invalid lifelog ID gracefully", async () => {
            const result = await adapter.execute(
                "get_lifelog",
                { lifelogId: "invalid-lifelog-id-12345" },
                testUserEmail
            );

            // Should return an error for invalid ID
            expect(result.isError).toBe(true);
        });
    });

    describe("get_transcript operation", () => {
        let validLifelogId: string | null = null;

        beforeEach(async () => {
            const listResult = await adapter.execute(
                "list_recordings",
                { limit: 1 },
                testUserEmail
            );

            if (!listResult.isError) {
                const response = JSON.parse(listResult.content[0].text!);
                if (response.lifelogs && response.lifelogs.length > 0) {
                    validLifelogId = response.lifelogs[0].id;
                }
            }
        });

        it("retrieves transcript when valid ID exists", async () => {
            if (!validLifelogId) {
                console.log(
                    "Skipping get_transcript test: No lifelogs available in account"
                );
                return;
            }

            const result = await adapter.execute(
                "get_transcript",
                { lifelogId: validLifelogId },
                testUserEmail
            );

            // May succeed with transcript or fail if transcript not ready
            if (!result.isError) {
                expect(result.content[0].type).toBe("text");
                expect(result.content[0].text).toContain("Lifelog Transcript");
            } else {
                // Transcript may not be available - this is acceptable
                expect(result.content[0].text).toMatch(
                    /transcript|processing|not available/i
                );
            }
        });

        it("validates required lifelogId parameter", async () => {
            const result = await adapter.execute(
                "get_transcript",
                {}, // Missing required 'lifelogId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: lifelogId/
            );
        });
    });

    describe("list_chats operation", () => {
        it("lists AI chat conversations", async () => {
            const result = await adapter.execute(
                "list_chats",
                { limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.totalCount).toBeDefined();
            expect(response.chats).toBeDefined();
            expect(Array.isArray(response.chats)).toBe(true);

            // If there are chats, verify structure
            if (response.chats.length > 0) {
                const firstChat = response.chats[0];
                expect(firstChat).toHaveProperty("id");
                expect(firstChat).toHaveProperty("title");
                expect(firstChat).toHaveProperty("createdAt");
                expect(firstChat).toHaveProperty("updatedAt");
            }
        });

        it("supports pagination with cursor", async () => {
            // First request to get a cursor
            const firstResult = await adapter.execute(
                "list_chats",
                { limit: 5 },
                testUserEmail
            );

            expect(firstResult.isError).toBe(false);

            const firstResponse = JSON.parse(firstResult.content[0].text!);

            // If there's a next cursor, test pagination
            if (firstResponse.nextCursor) {
                const secondResult = await adapter.execute(
                    "list_chats",
                    { limit: 5, cursor: firstResponse.nextCursor },
                    testUserEmail
                );

                expect(secondResult.isError).toBe(false);

                const secondResponse = JSON.parse(secondResult.content[0].text!);
                expect(secondResponse.chats).toBeDefined();
            }
        });

        it("respects limit parameter", async () => {
            const result = await adapter.execute(
                "list_chats",
                { limit: 3 },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.chats.length).toBeLessThanOrEqual(3);
        });
    });

    describe("get_chat operation", () => {
        let validChatId: string | null = null;

        beforeEach(async () => {
            const listResult = await adapter.execute(
                "list_chats",
                { limit: 1 },
                testUserEmail
            );

            if (!listResult.isError) {
                const response = JSON.parse(listResult.content[0].text!);
                if (response.chats && response.chats.length > 0) {
                    validChatId = response.chats[0].id;
                }
            }
        });

        it("retrieves chat details when valid ID exists", async () => {
            if (!validChatId) {
                console.log("Skipping get_chat test: No chats available in account");
                return;
            }

            const result = await adapter.execute(
                "get_chat",
                { chatId: validChatId },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response).toHaveProperty("id");
            expect(response).toHaveProperty("title");
            expect(response).toHaveProperty("createdAt");
            expect(response).toHaveProperty("messages");
        });

        it("validates required chatId parameter", async () => {
            const result = await adapter.execute(
                "get_chat",
                {}, // Missing required 'chatId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: chatId/
            );
        });

        it("handles invalid chat ID gracefully", async () => {
            const result = await adapter.execute(
                "get_chat",
                { chatId: "invalid-chat-id-12345" },
                testUserEmail
            );

            // Should return an error for invalid ID
            expect(result.isError).toBe(true);
        });
    });

    describe("download_audio operation", () => {
        it("generates download URL for valid time range", async () => {
            // Use a recent time range (last hour)
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const result = await adapter.execute(
                "download_audio",
                {
                    startTime: oneHourAgo.toISOString(),
                    endTime: now.toISOString(),
                },
                testUserEmail
            );

            // May succeed with URL or fail if no audio in time range
            if (!result.isError) {
                const response = JSON.parse(result.content[0].text!);
                expect(response).toHaveProperty("downloadUrl");
                expect(response).toHaveProperty("format");
                expect(response.downloadUrl).toMatch(/^https?:\/\//);
            } else {
                // No audio available - this is acceptable
                expect(result.content[0].text).toMatch(
                    /no audio|not available|time range/i
                );
            }
        });

        it("validates ISO 8601 timestamp format requirement", async () => {
            // Use proper ISO 8601 format
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const result = await adapter.execute(
                "download_audio",
                {
                    startTime: oneHourAgo.toISOString(), // e.g., 2024-01-15T09:00:00.000Z
                    endTime: now.toISOString(),
                },
                testUserEmail
            );

            // Should not fail due to format issues
            if (result.isError) {
                expect(result.content[0].text).not.toMatch(/invalid.*format/i);
            }
        });

        it("validates required startTime parameter", async () => {
            const result = await adapter.execute(
                "download_audio",
                {
                    endTime: new Date().toISOString(),
                    // Missing startTime
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: startTime/
            );
        });

        it("validates required endTime parameter", async () => {
            const result = await adapter.execute(
                "download_audio",
                {
                    startTime: new Date().toISOString(),
                    // Missing endTime
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: endTime/
            );
        });
    });

    describe("delete_lifelog operation (validation only)", () => {
        // IMPORTANT: These tests only validate parameters, they do NOT actually delete data
        // to avoid accidentally destroying real user recordings

        it("validates required lifelogId parameter", async () => {
            const result = await adapter.execute(
                "delete_lifelog",
                {}, // Missing required 'lifelogId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: lifelogId/
            );
        });

        // Note: We intentionally do NOT test actual deletion to protect user data
        // To test actual deletion, create a test recording first via the Limitless app
    });

    describe("delete_chat operation (validation only)", () => {
        // IMPORTANT: These tests only validate parameters, they do NOT actually delete data

        it("validates required chatId parameter", async () => {
            const result = await adapter.execute(
                "delete_chat",
                {}, // Missing required 'chatId' parameter
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: chatId/
            );
        });

        // Note: We intentionally do NOT test actual deletion to protect user data
    });

    describe("raw_api operation", () => {
        it("executes raw API calls successfully", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/lifelogs",
                    method: "GET",
                    query: { limit: "3" },
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
        });

        it("validates endpoint starts with /v1/", async () => {
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

        it("validates required endpoint parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    method: "GET", // Missing endpoint
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: endpoint/
            );
        });

        it("validates required method parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/lifelogs", // Missing method
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /Missing required parameter: method/
            );
        });

        it("supports query parameters in raw API calls", async () => {
            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/v1/lifelogs",
                    method: "GET",
                    query: { limit: "1", direction: "desc" },
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const response = JSON.parse(result.content[0].text!);
            expect(response.data).toBeDefined();
        });
    });

    describe("Error Handling", () => {
        it("returns error when service not connected", async () => {
            const nonExistentUser = "no-limitless-connection@example.com";
            await createTestUser({ email: nonExistentUser });

            const result = await adapter.execute(
                "search",
                { query: "test" },
                nonExistentUser
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/connect.*limitless/i);
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
