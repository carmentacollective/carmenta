/**
 * Limitless Adapter Tests
 *
 * Tests authentication and core operations for the Limitless adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { LimitlessAdapter } from "@/lib/integrations/adapters/limitless";
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
        NEXT_PUBLIC_APP_URL: "https://carmenta.app",
    },
}));

describe("LimitlessAdapter", () => {
    let adapter: LimitlessAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new LimitlessAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("limitless");
            expect(adapter.serviceDisplayName).toBe("Limitless");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Limitless");
            expect(help.description).toContain("Limitless");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
            expect(help.docsUrl).toBe("https://www.limitless.ai/developers");
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("search");
            expect(operationNames).toContain("get_lifelog");
            expect(operationNames).toContain("list_recordings");
            expect(operationNames).toContain("get_transcript");
            expect(operationNames).toContain("raw_api");
        });

        it("specifies common operations", () => {
            const help = adapter.getHelp();

            expect(help.commonOperations).toEqual([
                "search",
                "get_lifelog",
                "get_transcript",
                "list_recordings",
            ]);
        });

        it("marks read-only operations with readOnlyHint annotation", () => {
            const help = adapter.getHelp();

            const readOnlyOps = help.operations.filter(
                (op) => op.annotations?.readOnlyHint
            );

            expect(readOnlyOps.length).toBeGreaterThan(0);
            expect(readOnlyOps.map((op) => op.name)).toContain("search");
            expect(readOnlyOps.map((op) => op.name)).toContain("list_recordings");
        });
    });

    describe("Connection Testing", () => {
        it("validates API key using lifelogs endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        lifelogs: [],
                    },
                }),
            });

            const result = await adapter.testConnection("test-api-key");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.limitless.ai/v1/lifelogs"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-API-Key": "test-api-key",
                    }),
                })
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
                new ValidationError("limitless is not connected")
            );

            const result = await adapter.execute(
                "search",
                { query: "meetings" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringMatching(/connect.*limitless/i),
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

        it("searches lifelogs with query", async () => {
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
                        lifelogs: [
                            {
                                id: "lifelog-123",
                                summary: "Project meeting",
                                created_at: "2024-01-15T10:00:00Z",
                            },
                        ],
                    },
                }),
            });

            const result = await adapter.execute(
                "search",
                { query: "project meetings" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.limitless.ai/v1/lifelogs"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-API-Key": "test-key",
                    }),
                    searchParams: expect.objectContaining({
                        search: "project meetings",
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
                    data: { lifelogs: [] },
                }),
            });

            await adapter.execute(
                "search",
                { query: "test", limit: 10 },
                testUserEmail
            );

            expect(httpClient.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    searchParams: expect.objectContaining({
                        limit: 10,
                    }),
                })
            );
        });
    });

    describe("list_recordings operation", () => {
        it("lists recent lifelogs", async () => {
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
                        lifelogs: [],
                    },
                }),
            });

            const result = await adapter.execute("list_recordings", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.limitless.ai/v1/lifelogs"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-API-Key": "test-key",
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
                    data: { lifelogs: [] },
                }),
            });

            await adapter.execute("list_recordings", { limit: 20 }, testUserEmail);

            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.limitless.ai/v1/lifelogs"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-API-Key": "test-key",
                        "Content-Type": "application/json",
                    }),
                    searchParams: expect.objectContaining({
                        limit: "20",
                        direction: "desc",
                    }),
                })
            );
        });
    });

    describe("get_lifelog operation", () => {
        it("requires lifelogId parameter", async () => {
            const result = await adapter.execute("get_lifelog", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0]).toMatchObject({
                type: "text",
                text: expect.stringContaining("lifelogId"),
            });
        });

        it("gets lifelog by ID", async () => {
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
                        lifelog: {
                            id: "lifelog-123",
                            summary: "Test lifelog",
                            startedAt: "2024-01-15T10:00:00Z",
                            endedAt: "2024-01-15T11:00:00Z",
                        },
                    },
                }),
            });

            const result = await adapter.execute(
                "get_lifelog",
                { lifelogId: "lifelog-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.limitless.ai/v1/lifelogs/lifelog-123"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-API-Key": "test-key",
                        "Content-Type": "application/json",
                    }),
                })
            );
        });
    });
});
