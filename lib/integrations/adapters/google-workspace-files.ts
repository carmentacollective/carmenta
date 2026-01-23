/**
 * Google Workspace Files Adapter
 *
 * Read-only access to Google Sheets, Docs, and Slides using the drive.file scope.
 * This scope only grants access to files the user explicitly picks via Google Picker.
 *
 * Design decision (2025-01-18): Removed document creation capabilities.
 * Carmenta is not a document formatting service - users should create docs in
 * Google Workspace and have Carmenta read/analyze them.
 *
 * No full Drive browsing - that would require CASA audit ($15-75k/year).
 */

import { drive, auth } from "@googleapis/drive";
import { sheets } from "@googleapis/sheets";
import { ServiceAdapter, HelpResponse, MCPToolResponse } from "./base";
import { logger } from "@/lib/logger";

export class GoogleWorkspaceFilesAdapter extends ServiceAdapter {
    serviceName = "google-workspace-files";
    serviceDisplayName = "Google Sheets/Docs/Slides";

    /**
     * Create an OAuth2 client configured with the user's access token
     */
    private createAuthClient(accessToken: string) {
        const oauth2Client = new auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return oauth2Client;
    }

    /**
     * Test the OAuth connection by making a live API request
     */
    async testConnection(
        credentialOrToken: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const auth = this.createAuthClient(credentialOrToken);
            const driveClient = drive({ version: "v3", auth });

            // Simple request to verify token is valid
            await driveClient.about.get({ fields: "user" });

            return { success: true };
        } catch (error) {
            logger.error(
                { error, userId },
                "Failed to verify Google Workspace Files connection"
            );

            const errorMessage = error instanceof Error ? error.message : String(error);

            // Expected OAuth failures - don't capture to Sentry
            if (errorMessage.includes("401") || errorMessage.includes("403")) {
                return {
                    success: false,
                    error: "The Google connection may have expired. Try reconnecting.",
                };
            }

            // Unexpected error - capture to Sentry
            this.captureError(error, {
                action: "testConnection",
                userId,
            });

            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Connection verification failed",
            };
        }
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            description:
                "Read and interact with Google Sheets, Docs, and Slides. " +
                "Select files via Google Picker to grant Carmenta access.",
            operations: [
                {
                    name: "read_sheet",
                    description:
                        "Read data from a Google Sheet that the user selected via Picker. " +
                        "Cannot access arbitrary sheets - only those the user has explicitly granted access to.",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "spreadsheet_id",
                            type: "string",
                            required: true,
                            description:
                                "The spreadsheet ID (from Google Picker selection or URL)",
                            example: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
                        },
                        {
                            name: "range",
                            type: "string",
                            required: false,
                            description:
                                "A1 notation range to read. Defaults to all rows in columns A-ZZ (702 columns).",
                            example: "Sheet1!A1:D10",
                        },
                    ],
                    returns: "2D array of cell values",
                    example: `read_sheet({ spreadsheet_id: "abc123", range: "A1:C10" })`,
                },
                {
                    name: "open_picker",
                    description:
                        "Open Google Picker so user can select an existing file from their Drive. " +
                        "This grants Carmenta access to the selected file. " +
                        "Use this when the user wants to work with an existing spreadsheet, document, or presentation.",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "file_types",
                            type: "array",
                            required: false,
                            description:
                                "Types of files to show: 'spreadsheet', 'document', 'presentation'. " +
                                "Defaults to all three.",
                            example: '["spreadsheet"]',
                        },
                    ],
                    returns: "Action object for frontend to open Google Picker UI",
                    example: `open_picker({ file_types: ["spreadsheet", "document"] })`,
                },
            ],
            commonOperations: ["read_sheet", "open_picker"],
            docsUrl: "https://developers.google.com/workspace",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        // Early return for removed actions with helpful message
        // This runs before validation to provide better error messages
        const removedActions = ["create_sheet", "create_doc", "create_slides"];
        if (removedActions.includes(action)) {
            return this.createErrorResponse(
                `'${action}' is no longer supported. Available actions: read_sheet, open_picker. ` +
                    `Document creation was removed - create files in Google Workspace directly, ` +
                    `then use open_picker to select them for reading/analysis.`
            );
        }

        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError(
                `[GOOGLE WORKSPACE FILES ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's OAuth access token
        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            // Extract error message from the original error response
            const errorMessage =
                tokenResult.content[0]?.type === "text"
                    ? tokenResult.content[0].text
                    : "Integration not connected";

            // Return structured error for UI to render IntegrationRequired component
            // We use isError: false so lib/integrations/tools.ts parses the JSON response.
            // When isError: true, tools.ts returns { error: true, message: "..." } which breaks
            // the UI check for output.error === "integration_not_connected" (string value).
            return this.createJSONResponse({
                error: "integration_not_connected",
                message: errorMessage,
            });
        }
        const { accessToken } = tokenResult;

        // Route to appropriate handler
        try {
            switch (action) {
                case "read_sheet":
                    return await this.handleReadSheet(params, accessToken);
                case "open_picker":
                    return this.handleOpenPicker(params);
                default:
                    this.logError(
                        `[GOOGLE WORKSPACE FILES ADAPTER] Unknown action '${action}' requested by user ${userId}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Available actions: read_sheet, open_picker. ` +
                            `Note: Document creation is not supported - use Google Workspace directly to create files.`
                    );
            }
        } catch (error) {
            return this.handleOperationError(
                error,
                action,
                params as Record<string, unknown>,
                userId
            );
        }
    }

    /**
     * Read data from a Google Sheet
     */
    private async handleReadSheet(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { spreadsheet_id, range } = params as {
            spreadsheet_id: string;
            range?: string;
        };

        const auth = this.createAuthClient(accessToken);
        const sheetsClient = sheets({ version: "v4", auth });

        logger.info({ spreadsheetId: spreadsheet_id, range }, "Reading Google Sheet");

        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: spreadsheet_id,
            range: range || "A:ZZ", // All columns if no range specified
        });

        const values = response.data.values || [];

        return this.createJSONResponse({
            success: true,
            spreadsheetId: spreadsheet_id,
            range: response.data.range,
            rowCount: values.length,
            data: values,
        });
    }

    /**
     * Signal frontend to open Google Picker
     * This returns an action object - the actual picker UI is handled by the frontend
     */
    private handleOpenPicker(params: unknown): MCPToolResponse {
        const { file_types } = params as {
            file_types?: ("spreadsheet" | "document" | "presentation")[];
        };

        const mimeTypes: string[] = [];

        const types = file_types || ["spreadsheet", "document", "presentation"];

        for (const type of types) {
            switch (type) {
                case "spreadsheet":
                    mimeTypes.push("application/vnd.google-apps.spreadsheet");
                    break;
                case "document":
                    mimeTypes.push("application/vnd.google-apps.document");
                    break;
                case "presentation":
                    mimeTypes.push("application/vnd.google-apps.presentation");
                    break;
            }
        }

        return this.createJSONResponse({
            action: "open_google_picker",
            fileTypes: types,
            mimeTypes,
            message:
                "Frontend should open Google Picker to let user select a file. " +
                "Once selected, the file ID can be used with read_sheet or other operations.",
        });
    }
}
