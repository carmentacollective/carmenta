/**
 * Slack Adapter Tests
 *
 * Tests authentication and core operations for the Slack adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { SlackAdapter } from "@/lib/integrations/adapters/slack";
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
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
        NANGO_API_URL: "https://api.nango.dev",
        NANGO_SECRET_KEY: "test-nango-key",
    },
}));

describe("SlackAdapter", () => {
    let adapter: SlackAdapter;
    const testUserEmail = "test@example.com";
    const testConnectionId = "nango_test_slack_123";

    beforeEach(() => {
        adapter = new SlackAdapter();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service properties", () => {
            expect(adapter.serviceName).toBe("slack");
            expect(adapter.serviceDisplayName).toBe("Slack");
        });
    });

    describe("getHelp", () => {
        it("returns help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Slack");
            expect(help.operations).toBeDefined();
            expect(help.operations.length).toBeGreaterThan(0);
        });

        it("documents all core operations", () => {
            const help = adapter.getHelp();
            const operationNames = help.operations.map((op) => op.name);

            expect(operationNames).toContain("list_channels");
            expect(operationNames).toContain("send_message");
            expect(operationNames).toContain("get_channel_history");
            expect(operationNames).toContain("raw_api");
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("slack is not connected")
            );

            const result = await adapter.execute("list_channels", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("slack is not connected");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    channels: [
                        {
                            id: "C123456",
                            name: "general",
                            is_member: true,
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_channels", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "slack",
                undefined
            );
        });
    });

    describe("Parameter Validation", () => {
        it("validates required parameters for send_message", () => {
            const result = adapter.validate("send_message", { text: "Hello" });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toMatch(/Missing required parameter: channel/);
        });

        it("accepts valid parameters for send_message", () => {
            const result = adapter.validate("send_message", {
                channel: "C123456",
                text: "Hello",
            });

            expect(result.valid).toBe(true);
        });
    });

    describe("Operation Execution", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("executes list_channels operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    channels: [
                        {
                            id: "C123456",
                            name: "general",
                            is_member: true,
                            num_members: 10,
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_channels", {}, testUserEmail);

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalled();
        });

        it("executes send_message operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    ts: "1234567890.123456",
                    channel: "C123456",
                }),
            } as never);

            const result = await adapter.execute(
                "send_message",
                {
                    channel: "C123456",
                    text: "Hello, world!",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalled();
        });

        it("executes get_channel_history operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    messages: [
                        {
                            type: "message",
                            text: "Hello",
                            user: "U123456",
                            ts: "1234567890.123456",
                        },
                    ],
                    has_more: false,
                }),
            } as never);

            const result = await adapter.execute(
                "get_channel_history",
                { channel: "C123456" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.get).toHaveBeenCalled();
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute("list_channels", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /403|Forbidden|Authentication failed/
            );
            expect(result.content[0].text).toContain("connection may have expired");
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute("list_channels", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Rate limit exceeded");
        });

        it("handles 403 permission errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute("list_channels", {}, testUserEmail);

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(
                /403|Forbidden|Authentication failed/
            );
        });
    });

    describe("New Operations - Message Search", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("executes search_messages with rate limit headers", async () => {
            const { httpClient } = await import("@/lib/http-client");
            const mockHeaders = new Headers({
                "x-rate-limit-remaining": "50",
                "x-rate-limit-limit": "100",
                "x-rate-limit-reset": "1234567890",
            });

            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    messages: {
                        total: 2,
                        matches: [
                            {
                                channel: { id: "C123", name: "general" },
                                type: "message",
                                text: "Q4 goals discussion",
                                ts: "1234567890.123456",
                                username: "alice",
                                permalink: "https://slack.com/...",
                            },
                        ],
                    },
                }),
                headers: mockHeaders,
            } as never);

            const result = await adapter.execute(
                "search_messages",
                { query: "Q4 goals", count: 20 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const response = JSON.parse(result.content[0].text!);
            expect(response.query).toBe("Q4 goals");
            expect(response.total).toBe(2);
            expect(response.results).toHaveLength(1);
            expect(response.rate_limit).toBeDefined();
            expect(response.rate_limit.remaining).toBe(50);
        });

        it("validates required query parameter", () => {
            const result = adapter.validate("search_messages", { count: 20 });

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toMatch(/Missing required parameter: query/);
        });
    });

    describe("New Operations - Message Editing", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("executes update_message successfully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    ts: "1234567890.123456",
                    channel: "C123",
                    text: "Updated text",
                }),
            } as never);

            const result = await adapter.execute(
                "update_message",
                {
                    channel: "C123",
                    timestamp: "1234567890.123456",
                    text: "Updated text",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalled();
        });

        it("handles cant_update_message permission error", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: false,
                    error: "cant_update_message",
                }),
            } as never);

            const result = await adapter.execute(
                "update_message",
                {
                    channel: "C123",
                    timestamp: "1234567890.123456",
                    text: "Updated text",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "You can only edit messages you sent"
            );
        });
    });

    describe("New Operations - Message Deletion", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("executes delete_message successfully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    ts: "1234567890.123456",
                    channel: "C123",
                }),
            } as never);

            const result = await adapter.execute(
                "delete_message",
                {
                    channel: "C123",
                    timestamp: "1234567890.123456",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const response = JSON.parse(result.content[0].text!);
            expect(response.deleted).toBe(true);
        });

        it("handles message_not_found error", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: false,
                    error: "message_not_found",
                }),
            } as never);

            const result = await adapter.execute(
                "delete_message",
                {
                    channel: "C123",
                    timestamp: "1234567890.123456",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(
                "Message not found. It may have already been deleted"
            );
        });
    });

    describe("New Operations - Workspace Info", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("executes get_workspace_info successfully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    team: {
                        id: "T123",
                        name: "Test Workspace",
                        domain: "test-workspace",
                        email_domain: "example.com",
                        icon: {
                            image_original: "https://example.com/icon.png",
                        },
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_workspace_info",
                {},
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const response = JSON.parse(result.content[0].text!);
            expect(response.name).toBe("Test Workspace");
            expect(response.domain).toBe("test-workspace");
        });
    });

    describe("New Operations - Pagination", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "Test Workspace (testuser)",
                accountDisplayName: "Test Workspace workspace",
                isDefault: true,
            });
        });

        it("handles pagination cursor in list_channels", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    channels: [
                        {
                            id: "C123",
                            name: "general",
                            is_channel: true,
                            is_group: false,
                            is_im: false,
                            is_mpim: false,
                            is_private: false,
                            num_members: 10,
                        },
                    ],
                    response_metadata: {
                        next_cursor: "dXNlcjpVMDYxTkZUVDI=",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "list_channels",
                { cursor: "previous_cursor" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const response = JSON.parse(result.content[0].text!);
            expect(response.has_more).toBe(true);
            expect(response.next_cursor).toBe("dXNlcjpVMDYxTkZUVDI=");
        });

        it("handles pagination cursor in get_channel_history", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    messages: [
                        {
                            type: "message",
                            text: "Hello",
                            user: "U123",
                            ts: "1234567890.123456",
                        },
                    ],
                    has_more: true,
                    response_metadata: {
                        next_cursor: "bmV4dF9jdXJzb3I=",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_channel_history",
                { channel: "C123", cursor: "previous_cursor" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const response = JSON.parse(result.content[0].text!);
            expect(response.has_more).toBe(true);
            expect(response.next_cursor).toBe("bmV4dF9jdXJzb3I=");
        });
    });
});
