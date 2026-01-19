/**
 * Google Workspace Files Adapter Tests
 *
 * Tests authentication and core operations for the read-only Google Workspace Files adapter.
 * This adapter provides read_sheet and open_picker operations only.
 *
 * Document creation (create_doc, create_sheet) was removed in 2025-01 to prevent
 * malformed JSON tool calls and infinite loops when users expected formatting
 * capabilities the API doesn't support.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GoogleWorkspaceFilesAdapter } from "@/lib/integrations/adapters/google-workspace-files";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock Google APIs - class must be defined inside factory due to vitest hoisting
vi.mock("@googleapis/drive", () => {
    // Define class inside factory to avoid hoisting issues
    const MockOAuth2 = class {
        setCredentials = vi.fn();
    };
    return {
        drive: vi.fn(() => ({
            about: {
                get: vi.fn(),
            },
        })),
        auth: {
            OAuth2: MockOAuth2,
        },
    };
});

vi.mock("@googleapis/sheets", () => ({
    sheets: vi.fn(() => ({
        spreadsheets: {
            values: {
                get: vi.fn(),
            },
        },
    })),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("GoogleWorkspaceFilesAdapter", () => {
    let adapter: GoogleWorkspaceFilesAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new GoogleWorkspaceFilesAdapter();
        vi.clearAllMocks();
    });

    describe("Service Identity", () => {
        it("has correct service name", () => {
            expect(adapter.serviceName).toBe("google-workspace-files");
        });

        it("has correct display name", () => {
            expect(adapter.serviceDisplayName).toBe("Google Sheets/Docs/Slides");
        });
    });

    describe("getHelp()", () => {
        it("returns help with only read_sheet and open_picker operations", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Google Sheets/Docs/Slides");
            expect(help.operations).toHaveLength(2);

            const operationNames = help.operations.map((op) => op.name);
            expect(operationNames).toContain("read_sheet");
            expect(operationNames).toContain("open_picker");

            // Verify create operations are NOT present
            expect(operationNames).not.toContain("create_sheet");
            expect(operationNames).not.toContain("create_doc");
        });

        it("marks all operations as read-only", () => {
            const help = adapter.getHelp();

            for (const op of help.operations) {
                expect(op.annotations?.readOnlyHint).toBe(true);
            }
        });

        it("includes commonOperations", () => {
            const help = adapter.getHelp();

            expect(help.commonOperations).toEqual(["read_sheet", "open_picker"]);
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("google-workspace-files is not connected")
            );

            const result = await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "test-id" },
                testUserEmail
            );

            // When not connected, returns JSON with error field (not isError: true)
            // This allows UI to render IntegrationRequired component
            const content = JSON.parse(result.content[0].text as string);
            expect(content.error).toBe("integration_not_connected");
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });

            const { sheets } = await import("@googleapis/sheets");
            (sheets as unknown as Mock).mockReturnValue({
                spreadsheets: {
                    values: {
                        get: vi.fn().mockResolvedValue({
                            data: {
                                range: "Sheet1!A1:C10",
                                values: [
                                    ["Name", "Email"],
                                    ["Alice", "alice@example.com"],
                                ],
                            },
                        }),
                    },
                },
            });

            const result = await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "test-spreadsheet-id" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "google-workspace-files",
                undefined
            );
        });
    });

    describe("Removed Actions", () => {
        beforeEach(async () => {
            // Set up valid credentials so we can test the action rejection
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("returns helpful error for create_sheet", async () => {
            const result = await adapter.execute(
                "create_sheet",
                { title: "Test Sheet" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("no longer supported");
            expect(result.content[0].text).toContain("read_sheet");
            expect(result.content[0].text).toContain("open_picker");
        });

        it("returns helpful error for create_doc", async () => {
            const result = await adapter.execute(
                "create_doc",
                { title: "Test Doc" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("no longer supported");
        });

        it("returns helpful error for create_slides", async () => {
            const result = await adapter.execute(
                "create_slides",
                { title: "Test Slides" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("no longer supported");
        });
    });

    describe("read_sheet Operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("reads sheet data successfully", async () => {
            const { sheets } = await import("@googleapis/sheets");
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    range: "Sheet1!A1:B2",
                    values: [
                        ["Header1", "Header2"],
                        ["Value1", "Value2"],
                    ],
                },
            });

            (sheets as unknown as Mock).mockReturnValue({
                spreadsheets: {
                    values: {
                        get: mockGet,
                    },
                },
            });

            const result = await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "test-id", range: "Sheet1!A1:B2" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const content = JSON.parse(result.content[0].text as string);
            expect(content.success).toBe(true);
            expect(content.spreadsheetId).toBe("test-id");
            expect(content.rowCount).toBe(2);
            expect(content.data).toEqual([
                ["Header1", "Header2"],
                ["Value1", "Value2"],
            ]);
        });

        it("uses default range A:ZZ when not specified", async () => {
            const { sheets } = await import("@googleapis/sheets");
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    range: "Sheet1!A:ZZ",
                    values: [],
                },
            });

            (sheets as unknown as Mock).mockReturnValue({
                spreadsheets: {
                    values: {
                        get: mockGet,
                    },
                },
            });

            await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "test-id" },
                testUserEmail
            );

            expect(mockGet).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: "A:ZZ",
                })
            );
        });

        it("handles empty sheet", async () => {
            const { sheets } = await import("@googleapis/sheets");
            (sheets as unknown as Mock).mockReturnValue({
                spreadsheets: {
                    values: {
                        get: vi.fn().mockResolvedValue({
                            data: {
                                range: "Sheet1!A:ZZ",
                                values: undefined, // Empty sheet returns undefined
                            },
                        }),
                    },
                },
            });

            const result = await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "empty-sheet-id" },
                testUserEmail
            );

            expect(result.isError).toBe(false);

            const content = JSON.parse(result.content[0].text as string);
            expect(content.rowCount).toBe(0);
            expect(content.data).toEqual([]);
        });
    });

    describe("open_picker Operation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("returns action object for frontend", async () => {
            const result = await adapter.execute("open_picker", {}, testUserEmail);

            expect(result.isError).toBe(false);

            const content = JSON.parse(result.content[0].text as string);
            expect(content.action).toBe("open_google_picker");
            expect(content.fileTypes).toEqual([
                "spreadsheet",
                "document",
                "presentation",
            ]);
            expect(content.mimeTypes).toEqual([
                "application/vnd.google-apps.spreadsheet",
                "application/vnd.google-apps.document",
                "application/vnd.google-apps.presentation",
            ]);
        });

        it("filters to specific file types", async () => {
            const result = await adapter.execute(
                "open_picker",
                { file_types: ["spreadsheet"] },
                testUserEmail
            );

            const content = JSON.parse(result.content[0].text as string);
            expect(content.fileTypes).toEqual(["spreadsheet"]);
            expect(content.mimeTypes).toEqual([
                "application/vnd.google-apps.spreadsheet",
            ]);
        });

        it("supports multiple file types", async () => {
            const result = await adapter.execute(
                "open_picker",
                { file_types: ["spreadsheet", "document"] },
                testUserEmail
            );

            const content = JSON.parse(result.content[0].text as string);
            expect(content.fileTypes).toEqual(["spreadsheet", "document"]);
            expect(content.mimeTypes).toHaveLength(2);
        });

        it("ignores invalid file types", async () => {
            const result = await adapter.execute(
                "open_picker",
                { file_types: ["invalid_type" as any] },
                testUserEmail
            );

            const content = JSON.parse(result.content[0].text as string);
            expect(content.fileTypes).toEqual(["invalid_type"]);
            // Invalid types are silently ignored - no MIME types added
            expect(content.mimeTypes).toEqual([]);
        });
    });

    describe("Parameter Validation", () => {
        it("validates required spreadsheet_id for read_sheet", () => {
            const result = adapter.validate("read_sheet", {});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.join(" ")).toContain("spreadsheet_id");
        });

        it("accepts valid read_sheet params", () => {
            const result = adapter.validate("read_sheet", {
                spreadsheet_id: "test-id",
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it("accepts open_picker without params", () => {
            const result = adapter.validate("open_picker", {});

            expect(result.valid).toBe(true);
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "test@gmail.com",
                accountDisplayName: "Test User",
                isDefault: true,
            });
        });

        it("handles API errors gracefully", async () => {
            const { sheets } = await import("@googleapis/sheets");
            (sheets as unknown as Mock).mockReturnValue({
                spreadsheets: {
                    values: {
                        get: vi.fn().mockRejectedValue(new Error("API Error")),
                    },
                },
            });

            const result = await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "test-id" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles 403 permission errors", async () => {
            const { sheets } = await import("@googleapis/sheets");
            (sheets as unknown as Mock).mockReturnValue({
                spreadsheets: {
                    values: {
                        get: vi
                            .fn()
                            .mockRejectedValue(
                                new Error(
                                    "HTTP 403: You don't have access to this sheet"
                                )
                            ),
                    },
                },
            });

            const result = await adapter.execute(
                "read_sheet",
                { spreadsheet_id: "no-access-id" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("handles unknown actions", async () => {
            const result = await adapter.execute("unknown_action", {}, testUserEmail);

            expect(result.isError).toBe(true);
            // Base adapter validation returns this message for unknown actions
            expect(result.content[0].text).toContain("We don't recognize");
        });
    });

    describe("testConnection", () => {
        it("returns success when Drive API responds", async () => {
            const { drive } = await import("@googleapis/drive");
            (drive as unknown as Mock).mockReturnValue({
                about: {
                    get: vi.fn().mockResolvedValue({
                        data: { user: { emailAddress: "test@gmail.com" } },
                    }),
                },
            });

            const result = await adapter.testConnection("valid-token", testUserEmail);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("returns friendly error for 401 unauthorized", async () => {
            const { drive } = await import("@googleapis/drive");
            (drive as unknown as Mock).mockReturnValue({
                about: {
                    get: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
                },
            });

            const result = await adapter.testConnection("expired-token", testUserEmail);

            expect(result.success).toBe(false);
            expect(result.error).toBe(
                "The Google connection may have expired. Try reconnecting."
            );
        });

        it("returns friendly error for 403 forbidden", async () => {
            const { drive } = await import("@googleapis/drive");
            (drive as unknown as Mock).mockReturnValue({
                about: {
                    get: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
                },
            });

            const result = await adapter.testConnection(
                "forbidden-token",
                testUserEmail
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe(
                "The Google connection may have expired. Try reconnecting."
            );
        });
    });
});
