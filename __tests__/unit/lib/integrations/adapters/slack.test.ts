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
        NEXT_PUBLIC_APP_URL: "https://carmenta.app",
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

    describe("fetchAccountInfo", () => {
        it("fetches Slack workspace information", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    user: "testuser",
                    user_id: "U123456",
                    team: "Test Workspace",
                    team_id: "T123456",
                }),
            } as never);

            const result = await adapter.fetchAccountInfo(testConnectionId);

            expect(result.identifier).toBe("Test Workspace (testuser)");
            expect(result.displayName).toBe("Test Workspace workspace");
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.nango.dev/proxy/auth.test"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "Connection-Id": testConnectionId,
                        "Provider-Config-Key": "slack",
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
                new ValidationError("slack is not connected")
            );

            await expect(
                adapter.execute("list_channels", {}, testUserEmail)
            ).rejects.toThrow("slack is not connected");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                connectionId: testConnectionId,
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
            expect(result.errors).toContain("Missing required parameter: channel");
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
                connectionId: testConnectionId,
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
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.nango.dev/proxy/conversations.list"),
                expect.any(Object)
            );
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
            expect(httpClient.post).toHaveBeenCalledWith(
                expect.stringContaining("api.nango.dev/proxy/chat.postMessage"),
                expect.any(Object)
            );
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
            expect(httpClient.get).toHaveBeenCalledWith(
                expect.stringContaining("api.nango.dev/proxy/conversations.history"),
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
});
