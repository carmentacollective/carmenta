/**
 * Twitter/X Adapter Tests
 *
 * Tests authentication and core operations for the Twitter adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { TwitterAdapter } from "@/lib/integrations/adapters/twitter";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
        NANGO_API_URL: "https://api.nango.dev",
        NANGO_SECRET_KEY: "test-nango-secret",
    },
}));

describe("TwitterAdapter", () => {
    let adapter: TwitterAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new TwitterAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("twitter");
            expect(adapter.serviceDisplayName).toBe("X (Twitter)");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("X (Twitter)");
            expect(help.description).toContain("tweet");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
            expect(help.docsUrl).toBe(
                "https://developer.twitter.com/en/docs/twitter-api"
            );
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("post_tweet");
            expect(operationNames).toContain("get_user_timeline");
            expect(operationNames).toContain("search_tweets");
            expect(operationNames).toContain("get_user_profile");
            expect(operationNames).toContain("get_mentions");
            expect(operationNames).toContain("like_tweet");
            expect(operationNames).toContain("unlike_tweet");
            expect(operationNames).toContain("retweet");
            expect(operationNames).toContain("unretweet");
            expect(operationNames).toContain("get_followers");
            expect(operationNames).toContain("get_following");
            expect(operationNames).toContain("raw_api");
        });

        it("marks read-only operations with readOnlyHint annotation", () => {
            const help = adapter.getHelp();

            const readOnlyOps = help.operations.filter(
                (op) => op.annotations?.readOnlyHint
            );

            expect(readOnlyOps.length).toBeGreaterThan(0);
            expect(readOnlyOps.map((op) => op.name)).toContain("get_user_timeline");
            expect(readOnlyOps.map((op) => op.name)).toContain("search_tweets");
            expect(readOnlyOps.map((op) => op.name)).toContain("get_user_profile");
        });

        it("defines common operations", () => {
            const help = adapter.getHelp();

            expect(help.commonOperations).toBeDefined();
            expect(help.commonOperations).toContain("post_tweet");
            expect(help.commonOperations).toContain("search_tweets");
        });
    });

    describe("Connection Testing", () => {
        it("validates connection using /2/users/me endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        id: "12345",
                        name: "Test User",
                        username: "testuser",
                    },
                }),
            } as never);

            const result = await adapter.testConnection("nango-connection-id");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalled();
        });

        it("returns error for connection failure", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.testConnection("invalid-connection");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("twitter is not connected")
            );

            const result = await adapter.execute(
                "post_tweet",
                { text: "Hello" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringMatching(/connect.*twitter/i),
            });
        });

        it("returns error when accessToken is missing", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: null, // Missing accessToken
            });

            const result = await adapter.execute(
                "post_tweet",
                { text: "Hello" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Invalid credentials");
        });
    });

    describe("post_tweet operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires text parameter", async () => {
            const result = await adapter.execute("post_tweet", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("text"),
            });
        });

        it("returns error when tweet is too long", async () => {
            const { httpClient } = await import("@/lib/http-client");
            // Mock the user ID fetch (happens before validation in this case)
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { id: "12345" },
                }),
            } as never);

            const longText = "a".repeat(281);
            const result = await adapter.execute(
                "post_tweet",
                { text: longText },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("too long");
            expect(result.content[0].text).toContain("280");
        });

        it("successfully posts a tweet", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { id: "12345" },
                }),
            } as never);

            // Mock posting tweet
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        id: "tweet_123",
                        text: "Hello World!",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "post_tweet",
                { text: "Hello World!" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"success": true');
            expect(result.content[0].text).toContain('"tweet_id": "tweet_123"');
        });
    });

    describe("search_tweets operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires query parameter", async () => {
            const result = await adapter.execute("search_tweets", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("query");
        });

        it("successfully searches tweets", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: "tweet_1",
                            text: "AI tools are amazing!",
                            author_id: "author_123",
                            created_at: "2024-01-15T10:00:00Z",
                        },
                    ],
                    meta: { result_count: 1 },
                }),
            } as never);

            const result = await adapter.execute(
                "search_tweets",
                { query: "AI tools" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"query": "AI tools"');
            expect(result.content[0].text).toContain('"count": 1');
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("2/tweets/search/recent"),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        query: "AI tools",
                    }),
                })
            );
        });

        it("caps max_results at 100", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [],
                    meta: { result_count: 0 },
                }),
            } as never);

            await adapter.execute(
                "search_tweets",
                { query: "test", max_results: 500 },
                testUserEmail
            );

            expect(httpClient.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        max_results: "100", // Capped at 100
                    }),
                })
            );
        });
    });

    describe("get_user_profile operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires username parameter", async () => {
            const result = await adapter.execute("get_user_profile", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("username");
        });

        it("successfully gets user profile", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        id: "user_123",
                        name: "Elon Musk",
                        username: "elonmusk",
                        description: "CEO of Tesla and SpaceX",
                        verified: true,
                        public_metrics: {
                            followers_count: 150000000,
                            following_count: 500,
                        },
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_user_profile",
                { username: "elonmusk" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"username": "elonmusk"');
            expect(result.content[0].text).toContain('"verified": true');
        });
    });

    describe("get_user_timeline operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("successfully gets user timeline", async () => {
            const { httpClient } = await import("@/lib/http-client");

            let callCount = 0;
            (httpClient.get as Mock).mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call: get user ID
                    return {
                        json: vi.fn().mockResolvedValue({
                            data: { id: "user_123" },
                        }),
                    };
                }
                // Second call: get timeline
                return {
                    json: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: "tweet_1",
                                text: "My latest tweet!",
                                created_at: "2024-01-15T10:00:00Z",
                            },
                        ],
                        meta: { result_count: 1 },
                    }),
                };
            });

            const result = await adapter.execute(
                "get_user_timeline",
                { max_results: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"count": 1');
        });
    });

    describe("like_tweet operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires tweet_id parameter", async () => {
            const result = await adapter.execute("like_tweet", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("tweet_id");
        });

        it("successfully likes a tweet", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { id: "12345" },
                }),
            } as never);

            // Mock liking tweet
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { liked: true },
                }),
            } as never);

            const result = await adapter.execute(
                "like_tweet",
                { tweet_id: "tweet_123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"liked": true');
        });
    });

    describe("unlike_tweet operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("successfully unlikes a tweet", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { id: "12345" },
                }),
            } as never);

            // Mock unliking tweet
            (httpClient.delete as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({}),
            } as never);

            const result = await adapter.execute(
                "unlike_tweet",
                { tweet_id: "tweet_123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"liked": false');
        });
    });

    describe("retweet operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("successfully retweets a tweet", async () => {
            const { httpClient } = await import("@/lib/http-client");

            // Mock getting user ID
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { id: "12345" },
                }),
            } as never);

            // Mock retweet
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { retweeted: true },
                }),
            } as never);

            const result = await adapter.execute(
                "retweet",
                { tweet_id: "tweet_123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"retweeted": true');
        });
    });

    describe("raw_api operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("requires endpoint parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                { method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("endpoint");
        });

        it("requires method parameter", async () => {
            const result = await adapter.execute(
                "raw_api",
                { endpoint: "2/users/me" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("method");
        });

        it("validates endpoint starts with 2/", async () => {
            const result = await adapter.execute(
                "raw_api",
                { endpoint: "invalid/endpoint", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("2/");
        });

        it("successfully executes raw API call", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: { id: "user_123", name: "Test User" },
                }),
            } as never);

            const result = await adapter.execute(
                "raw_api",
                { endpoint: "2/users/me", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('"id": "user_123"');
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "@testuser",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "search_tweets",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Authentication failed");
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute(
                "search_tweets",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("rate limit hit");
        });

        it("handles connection reset errors gracefully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("socket hang up")),
            } as never);

            const result = await adapter.execute(
                "search_tweets",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("connection");
        });
    });

    describe("Validation", () => {
        it("validates required parameters", () => {
            const validation = adapter.validate("post_tweet", {});

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toMatch(/We need the text parameter/);
        });

        it("accepts valid parameters", () => {
            const validation = adapter.validate("post_tweet", {
                text: "Hello World",
            });

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it("returns error for unknown action", () => {
            const validation = adapter.validate("unknown_action", {});

            expect(validation.valid).toBe(false);
            expect(validation.errors[0]).toContain("We don't recognize");
        });
    });
});
