/**
 * Google Workspace Files Adapter
 *
 * Create and work with Google Sheets, Docs, and Slides using the drive.file scope.
 * This scope only grants access to:
 * - Files the user explicitly picks via Google Picker
 * - Files our app creates
 *
 * No full Drive browsing - that would require CASA audit ($15-75k/year).
 */

import { google } from "googleapis";
import { ServiceAdapter, HelpResponse, MCPToolResponse } from "./base";
import { logger } from "@/lib/logger";

export class GoogleWorkspaceFilesAdapter extends ServiceAdapter {
    serviceName = "google-workspace-files";
    serviceDisplayName = "Google Sheets/Docs/Slides";

    /**
     * Create an OAuth2 client configured with the user's access token
     */
    private createAuthClient(accessToken: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        return auth;
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
            const drive = google.drive({ version: "v3", auth });

            // Simple request to verify token is valid
            await drive.about.get({ fields: "user" });

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
                "Create and work with Google Sheets, Docs, and Slides. " +
                "Access is limited to files you create through Carmenta or explicitly select via Google Picker.",
            operations: [
                {
                    name: "create_sheet",
                    description:
                        "Create a new Google Sheet with optional initial data. " +
                        "Returns the spreadsheet URL for the user to open.",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "title",
                            type: "string",
                            required: true,
                            description: "Title for the new spreadsheet",
                            example: "Q1 Budget",
                        },
                        {
                            name: "data",
                            type: "array",
                            required: false,
                            description:
                                "2D array of cell values. First row is typically headers. " +
                                'Example: [["Name", "Email"], ["Alice", "alice@example.com"]]',
                            example:
                                '[[\"Name\", \"Amount\"], [\"Alice\", \"100\"], [\"Bob\", \"200\"]]',
                        },
                        {
                            name: "sheet_name",
                            type: "string",
                            required: false,
                            description: "Name for the first sheet (default: 'Sheet1')",
                            example: "Sales Data",
                        },
                    ],
                    returns: "Object with spreadsheetId and url to open the new sheet",
                    example: `create_sheet({ title: "Team Roster", data: [["Name", "Role"], ["Alice", "Engineer"]] })`,
                },
                {
                    name: "create_doc",
                    description:
                        "Create a new Google Doc with optional initial content. " +
                        "Returns the document URL for the user to open.",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "title",
                            type: "string",
                            required: true,
                            description: "Title for the new document",
                            example: "Meeting Notes - Jan 10",
                        },
                        {
                            name: "content",
                            type: "string",
                            required: false,
                            description:
                                "Plain text content to insert into the document. " +
                                "For formatting, the user can edit in Google Docs after creation.",
                            example:
                                "Attendees:\\n- Alice\\n- Bob\\n\\nAgenda:\\n1. Project updates",
                        },
                    ],
                    returns: "Object with documentId and url to open the new doc",
                    example: `create_doc({ title: "Project Brief", content: "Overview\\n\\nThis project aims to..." })`,
                },
                {
                    name: "read_sheet",
                    description:
                        "Read data from a Google Sheet that was created by Carmenta or selected via Picker. " +
                        "Cannot access arbitrary sheets - only those the user has explicitly granted access to.",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "spreadsheet_id",
                            type: "string",
                            required: true,
                            description:
                                "The spreadsheet ID (from the URL or a previous create_sheet result)",
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
                        "Signal the frontend to open Google Picker so user can select an existing file. " +
                        "This grants Carmenta access to the selected file. " +
                        "Returns an action for the frontend to handle - does not directly open the picker.",
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
            commonOperations: ["create_sheet", "create_doc", "open_picker"],
            docsUrl: "https://developers.google.com/workspace",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
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
                case "create_sheet":
                    return await this.handleCreateSheet(params, accessToken);
                case "create_doc":
                    return await this.handleCreateDoc(params, accessToken);
                case "read_sheet":
                    return await this.handleReadSheet(params, accessToken);
                case "open_picker":
                    return this.handleOpenPicker(params);
                default:
                    this.logError(
                        `[GOOGLE WORKSPACE FILES ADAPTER] Unknown action '${action}' requested by user ${userId}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
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
     * Create a new Google Sheet
     */
    private async handleCreateSheet(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { title, data, sheet_name } = params as {
            title: string;
            data?: unknown[][];
            sheet_name?: string;
        };

        const auth = this.createAuthClient(accessToken);
        const sheets = google.sheets({ version: "v4", auth });

        // Build the request body
        const requestBody: {
            properties: { title: string };
            sheets?: Array<{
                properties?: { title: string };
                data?: Array<{
                    startRow: number;
                    startColumn: number;
                    rowData: Array<{
                        values: Array<{
                            userEnteredValue: { stringValue: string };
                        }>;
                    }>;
                }>;
            }>;
        } = {
            properties: { title },
        };

        // Add initial data if provided
        if (data && data.length > 0) {
            requestBody.sheets = [
                {
                    properties: sheet_name ? { title: sheet_name } : undefined,
                    data: [
                        {
                            startRow: 0,
                            startColumn: 0,
                            rowData: data.map((row) => ({
                                values: (Array.isArray(row) ? row : []).map((cell) => ({
                                    userEnteredValue: {
                                        stringValue: cell == null ? "" : String(cell),
                                    },
                                })),
                            })),
                        },
                    ],
                },
            ];
        } else if (sheet_name) {
            requestBody.sheets = [{ properties: { title: sheet_name } }];
        }

        logger.info(
            { title, hasData: !!data, rowCount: data?.length },
            "Creating Google Sheet"
        );

        const response = await sheets.spreadsheets.create({ requestBody });

        const { spreadsheetId, spreadsheetUrl } = response.data;

        if (!spreadsheetId || !spreadsheetUrl) {
            logger.error(
                { response: response.data, title },
                "Google Sheets API returned incomplete data"
            );
            return this.createErrorResponse(
                "Google created the spreadsheet but didn't return all required info. " +
                    "Check your recent files in Google Drive."
            );
        }

        return this.createJSONResponse({
            success: true,
            spreadsheetId,
            url: spreadsheetUrl,
            title,
            message: `Created Google Sheet "${title}"`,
        });
    }

    /**
     * Create a new Google Doc
     */
    private async handleCreateDoc(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { title, content } = params as {
            title: string;
            content?: string;
        };

        const auth = this.createAuthClient(accessToken);
        const docs = google.docs({ version: "v1", auth });

        logger.info({ title, hasContent: !!content }, "Creating Google Doc");

        // Create the document
        const createResponse = await docs.documents.create({
            requestBody: { title },
        });

        const documentId = createResponse.data.documentId;

        if (!documentId) {
            logger.error(
                { response: createResponse.data, title },
                "Google Docs API returned no documentId"
            );
            return this.createErrorResponse(
                "Google created the document but didn't return its ID. " +
                    "Check your recent files in Google Drive."
            );
        }

        const url = `https://docs.google.com/document/d/${documentId}/edit`;

        // Insert content if provided
        if (content && content.length > 0) {
            try {
                await docs.documents.batchUpdate({
                    documentId,
                    requestBody: {
                        requests: [
                            {
                                insertText: {
                                    location: { index: 1 },
                                    text: content,
                                },
                            },
                        ],
                    },
                });
            } catch (contentError) {
                logger.error(
                    { documentId, error: contentError, title },
                    "Failed to insert content into newly created doc"
                );
                // Capture to Sentry for visibility into partial failures
                this.captureError(contentError, {
                    action: "create_doc_content",
                    params: { documentId },
                });
                // Return partial success - doc exists but content failed
                return this.createJSONResponse({
                    success: false,
                    partial: true,
                    documentId,
                    url,
                    title,
                    message:
                        `Created Google Doc "${title}" but couldn't insert content. ` +
                        `The empty doc is available at the URL.`,
                    error:
                        contentError instanceof Error
                            ? contentError.message
                            : "Unknown error inserting content",
                });
            }
        }

        return this.createJSONResponse({
            success: true,
            documentId,
            url,
            title,
            message: `Created Google Doc "${title}"`,
        });
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
        const sheets = google.sheets({ version: "v4", auth });

        logger.info({ spreadsheetId: spreadsheet_id, range }, "Reading Google Sheet");

        const response = await sheets.spreadsheets.values.get({
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
