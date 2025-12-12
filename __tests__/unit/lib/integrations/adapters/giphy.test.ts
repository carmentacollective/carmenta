/**
 * Giphy Adapter Tests
 *
 * Tests authentication and core operations for the Giphy adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { GiphyAdapter } from "@/lib/integrations/adapters/giphy";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        get: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.app",
    },
}));

describe("GiphyAdapter", () => {
    let adapter: GiphyAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new GiphyAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("giphy");
            expect(adapter.serviceDisplayName).toBe("Giphy");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Giphy");
            expect(help.description).toContain("GIF");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
            expect(help.docsUrl).toBe("https://developers.giphy.com/docs/api");
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("search");
            expect(operationNames).toContain("get_random");
            expect(operationNames).toContain("get_trending");
            expect(operationNames).toContain("raw_api");
        });

        it("marks read-only operations with readOnlyHint annotation", () => {
            const help = adapter.getHelp();

            const readOnlyOps = help.operations.filter(
                (op) => op.annotations?.readOnlyHint
            );

            // All operations except raw_api should be read-only
            expect(readOnlyOps.length).toBeGreaterThan(0);
            expect(readOnlyOps.map((op) => op.name)).toContain("search");
            expect(readOnlyOps.map((op) => op.name)).toContain("get_random");
        });
    });

    describe("Connection Testing", () => {
        it("validates API key using random endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        id: "test-gif-id",
                        url: "https://giphy.com/gifs/test",
                    },
                }),
            });

            const result = await adapter.testConnection("test-api-key");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.giphy.com/v1/gifs/random"),
                expect.any(Object)
            );
        });

        it("returns error for invalid API key (401)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            });

            const result = await adapter.testConnection("invalid-key");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Invalid API key");
        });

        it("returns error for rate limit (429)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            });

            const result = await adapter.testConnection("rate-limited-key");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Rate limit");
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("giphy is not connected")
            );

            const result = await adapter.execute(
                "search",
                { query: "cats" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringMatching(/connect.*giphy/i),
            });
        });
    });

    describe("search operation", () => {
        it("requires query parameter", async () => {
            const result = await adapter.execute("search", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("query"),
            });
        });

        it("searches for GIFs with query", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: "abc123",
                            title: "Funny Cat GIF",
                            url: "https://giphy.com/gifs/abc123",
                            images: {
                                fixed_height: {
                                    url: "https://media.giphy.com/media/abc123/200.gif",
                                },
                            },
                        },
                    ],
                    pagination: {
                        total_count: 1,
                        count: 1,
                        offset: 0,
                    },
                }),
            });

            const result = await adapter.execute(
                "search",
                { query: "funny cats" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.giphy.com/v1/gifs/search"),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        q: "funny cats",
                        api_key: "test-key",
                    }),
                })
            );
        });

        it("applies limit parameter", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [],
                    pagination: { total_count: 0, count: 0, offset: 0 },
                }),
            });

            await adapter.execute(
                "search",
                { query: "test", limit: 25 },
                testUserEmail
            );

            expect(httpClient.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        limit: 25,
                    }),
                })
            );
        });
    });

    describe("get_random operation", () => {
        it("gets random GIF", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        id: "xyz789",
                        title: "Random GIF",
                        url: "https://giphy.com/gifs/xyz789",
                    },
                }),
            });

            const result = await adapter.execute("get_random", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.giphy.com/v1/gifs/random"),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        api_key: "test-key",
                    }),
                })
            );
        });

        it("accepts optional tag parameter", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({ data: {} }),
            });

            await adapter.execute("get_random", { tag: "excited" }, testUserEmail);

            expect(httpClient.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        tag: "excited",
                    }),
                })
            );
        });
    });

    describe("get_trending operation", () => {
        it("gets trending GIFs", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            const { httpClient } = await import("@/lib/http-client");

            (getCredentials as Mock).mockResolvedValue({
                type: "api_key",
                credentials: { apiKey: "test-key" },
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [],
                    pagination: { total_count: 0, count: 0, offset: 0 },
                }),
            });

            const result = await adapter.execute("get_trending", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.giphy.com/v1/gifs/trending"),
                expect.any(Object)
            );
        });
    });
});
