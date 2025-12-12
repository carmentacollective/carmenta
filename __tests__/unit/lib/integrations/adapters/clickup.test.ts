/**
 * ClickUp Adapter Tests
 *
 * Tests authentication and core operations for the ClickUp adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { ClickUpAdapter } from "@/lib/integrations/adapters/clickup";
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
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.app",
        NANGO_API_URL: "https://api.nango.dev",
        NANGO_SECRET_KEY: "test-nango-key",
    },
}));

describe("ClickUpAdapter", () => {
    let adapter: ClickUpAdapter;
    const testUserEmail = "test@example.com";
    const testConnectionId = "nango_test_clickup_123";

    beforeEach(() => {
        adapter = new ClickUpAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("clickup");
            expect(adapter.serviceDisplayName).toBe("ClickUp");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("ClickUp");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("list_teams");
            expect(operationNames).toContain("list_spaces");
            expect(operationNames).toContain("list_tasks");
            expect(operationNames).toContain("create_task");
            expect(operationNames).toContain("update_task");
            expect(operationNames).toContain("raw_api");
        });

        it("specifies common operations", () => {
            const help = adapter.getHelp();

            expect(help.commonOperations).toEqual([
                "list_tasks",
                "create_task",
                "update_task",
            ]);
        });
    });

    describe("fetchAccountInfo", () => {
        it("fetches ClickUp account information", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    user: {
                        id: 123,
                        username: "testuser",
                        email: "test@clickup.com",
                    },
                }),
            } as never);

            const result = await adapter.fetchAccountInfo(testConnectionId);

            expect(result.identifier).toBe("test@clickup.com");
            expect(result.displayName).toBe("testuser");
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.nango.dev/proxy/api/v2/user"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Connection-Id": testConnectionId,
                        "Provider-Config-Key": "clickup",
                    }),
                })
            );
        });

        it("handles errors when fetching account info", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("Network error")),
            } as never);

            await expect(adapter.fetchAccountInfo(testConnectionId)).rejects.toThrow(
                ValidationError
            );
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("clickup is not connected")
            );

            const result = await adapter.execute("list_teams", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("clickup");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                connectionId: testConnectionId,
                accountId: "test@clickup.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    teams: [
                        {
                            id: "team-123",
                            name: "Test Team",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_teams", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "clickup",
                undefined
            );
        });
    });

    describe("Operation Execution", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                connectionId: testConnectionId,
                accountId: "test@clickup.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("executes list_teams operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    teams: [
                        {
                            id: "team-123",
                            name: "Test Team",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_teams", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.nango.dev/proxy/api/v2/team"),
                expect.any(Object)
            );
        });

        it.skip("executes list_tasks operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    tasks: [
                        {
                            id: "task-123",
                            name: "Test Task",
                            status: { status: "open" },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_tasks",
                { list_id: "list-123" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining(
                    "api.nango.dev/proxy/api/v2/list/list-123/task"
                ),
                expect.any(Object)
            );
        });

        it("executes create_task operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    id: "task-456",
                    name: "New Task",
                    status: { status: "open" },
                }),
            } as never);

            const result = await adapter.execute(
                "create_task",
                {
                    list_id: "list-123",
                    name: "New Task",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining(
                    "api.nango.dev/proxy/api/v2/list/list-123/task"
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
                connectionId: testConnectionId,
                accountId: "test@clickup.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute("list_teams", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Authentication failed");
            expect(result.content[0].text).toContain("connection may have expired");
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute("list_teams", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Rate limit exceeded");
        });

        it("handles 403 permission errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute("list_teams", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Authentication failed");
        });
    });
});
