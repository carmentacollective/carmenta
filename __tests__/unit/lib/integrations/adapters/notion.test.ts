/**
 * Notion Adapter Tests
 *
 * Tests authentication and core operations for the Notion adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { NotionAdapter } from "@/lib/integrations/adapters/notion";
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
        patch: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("NotionAdapter", () => {
    let adapter: NotionAdapter;
    const testUserEmail = "test@example.com";
    const testAccessToken = "test_access_token_123";

    beforeEach(() => {
        adapter = new NotionAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("notion");
            expect(adapter.serviceDisplayName).toBe("Notion");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Notion");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("search");
            expect(operationNames).toContain("get_page");
            expect(operationNames).toContain("create_page");
            expect(operationNames).toContain("update_page");
            expect(operationNames).toContain("query_database");
            expect(operationNames).toContain("create_database_entry");
            expect(operationNames).toContain("raw_api");
        });

        it("marks read-only operations with readOnlyHint annotation", () => {
            const help = adapter.getHelp();

            const readOnlyOps = help.operations.filter(
                (op) => op.annotations?.readOnlyHint
            );

            expect(readOnlyOps.length).toBeGreaterThan(0);
            expect(readOnlyOps.map((op) => op.name)).toContain("search");
            expect(readOnlyOps.map((op) => op.name)).toContain("get_page");
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("notion is not connected")
            );

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("notion");
            expect(result.content[0].text).toMatch(/connect|integrations/i);
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: testAccessToken,
                accountId: "workspace-123",
                accountDisplayName: "Test Workspace",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    results: [
                        {
                            id: "page-123",
                            object: "page",
                            properties: {
                                title: {
                                    title: [{ plain_text: "Test Page" }],
                                },
                            },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "notion",
                undefined
            );
        });
    });

    describe("Parameter Validation", () => {
        it("validates required parameters for search", () => {
            const result = adapter.validate("search", {});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toMatch(/Missing required parameter: query/);
        });

        it("validates required parameters for get_page", () => {
            const result = adapter.validate("get_page", {});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toMatch(/Missing required parameter: page_id/);
        });

        it("validates required parameters for create_page", () => {
            const result = adapter.validate("create_page", {});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe("Operation Execution", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: testAccessToken,
                accountId: "workspace-123",
                accountDisplayName: "Test Workspace",
                isDefault: true,
            });
        });

        it("executes search operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const mockResults = {
                results: [
                    {
                        id: "page-123",
                        object: "page",
                        properties: {
                            title: {
                                title: [{ plain_text: "Test Page" }],
                            },
                        },
                        url: "https://notion.so/page-123",
                    },
                ],
                has_more: false,
            };

            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue(mockResults),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining("api.notion.com/v1/search"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${testAccessToken}`,
                        "Notion-Version": "2022-06-28",
                    }),
                })
            );
        });

        it("executes get_page operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const mockPage = {
                id: "page-123",
                object: "page",
                properties: {
                    title: {
                        title: [{ plain_text: "Test Page" }],
                    },
                },
            };

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue(mockPage),
            } as never);

            const result = await adapter.execute(
                "get_page",
                { page_id: "page-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.notion.com/v1/pages/page-123"),
                expect.any(Object)
            );
        });

        it("executes query_database operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const mockResults = {
                results: [
                    {
                        id: "page-456",
                        object: "page",
                        properties: {
                            Name: {
                                title: [{ plain_text: "Database Entry" }],
                            },
                        },
                    },
                ],
                has_more: false,
            };

            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue(mockResults),
            } as never);

            const result = await adapter.execute(
                "query_database",
                { database_id: "database-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining(
                    "api.notion.com/v1/databases/database-123/query"
                ),
                expect.any(Object)
            );
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: testAccessToken,
                accountId: "workspace-123",
                accountDisplayName: "Test Workspace",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Authentication failed");
            expect(result.content[0].text).toContain("connection may have expired");
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("rate limit hit");
        });

        it("handles 403 permission errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute(
                "search",
                { query: "test" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Authentication failed");
        });
    });
});
