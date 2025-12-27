/**
 * Dropbox Adapter Tests
 *
 * Tests authentication and core operations for the Dropbox adapter.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { DropboxAdapter } from "@/lib/integrations/adapters/dropbox";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
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

describe("DropboxAdapter", () => {
    let adapter: DropboxAdapter;
    const testUserEmail = "test@example.com";
    const testConnectionId = "nango_test_dropbox_123";

    beforeEach(() => {
        adapter = new DropboxAdapter();
        vi.clearAllMocks();
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("dropbox is not connected")
            );

            const result = await adapter.execute(
                "list_folder",
                { path: "" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("dropbox");
            expect(result.content[0].text).toContain("");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "dbid:account-123",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    entries: [
                        {
                            ".tag": "folder",
                            name: "Test Folder",
                            path_lower: "/test folder",
                            id: "id:folder-123",
                        },
                    ],
                    cursor: "cursor-123",
                    has_more: false,
                }),
            } as never);

            const result = await adapter.execute(
                "list_folder",
                { path: "" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "dropbox",
                undefined
            );
        });
    });

    describe("Parameter Validation", () => {
        it("validates required parameters for list_folder", () => {
            const result = adapter.validate("list_folder", {});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it("validates required parameters for search_files", () => {
            const result = adapter.validate("search_files", {});

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
                accessToken: "test-access-token",
                accountId: "dbid:account-123",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("executes list_folder operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    entries: [
                        {
                            ".tag": "file",
                            name: "document.pdf",
                            path_lower: "/document.pdf",
                            id: "id:file-123",
                            size: 1024,
                        },
                    ],
                    cursor: "cursor-123",
                    has_more: false,
                }),
            } as never);

            const result = await adapter.execute(
                "list_folder",
                { path: "" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalled();
        });

        it("executes search_files operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    matches: [
                        {
                            metadata: {
                                ".tag": "metadata",
                                metadata: {
                                    ".tag": "file",
                                    name: "report.pdf",
                                    path_lower: "/reports/report.pdf",
                                },
                            },
                        },
                    ],
                    has_more: false,
                }),
            } as never);

            const result = await adapter.execute(
                "search_files",
                { query: "report" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(httpClient.post).toHaveBeenCalled();
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "dbid:account-123",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute(
                "list_folder",
                { path: "" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute(
                "list_folder",
                { path: "" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 403 permission errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            } as never);

            const result = await adapter.execute(
                "list_folder",
                { path: "" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });
    });
});
