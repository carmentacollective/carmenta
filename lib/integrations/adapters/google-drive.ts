/**
 * Google Drive Full Access Adapter
 *
 * Full Drive access via google-internal OAuth (restricted scopes, internal-only).
 * Unlike google-workspace-files (drive.file scope), this has full Drive browsing.
 *
 * ## Virtual Service Pattern
 * This adapter exposes as "googleDrive" to the LLM but fetches credentials from
 * "google-internal" OAuth connection. This enables one OAuth → multiple tools.
 *
 * ## Rate Limits
 * - Per-user: 1000 queries per 100 seconds
 * - Per-project: 10,000 queries per 100 seconds
 */

import { drive, drive_v3, auth } from "@googleapis/drive";
import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { logger } from "@/lib/logger";
import { getCredentials, listServiceAccounts } from "../connection-manager";
import { ValidationError } from "@/lib/errors";

/**
 * The OAuth service to use for credentials.
 * googleDrive uses google-internal (restricted scopes, internal-only).
 */
const CREDENTIALS_SERVICE = "google-internal";

export class GoogleDriveAdapter extends ServiceAdapter {
    serviceName = "googleDrive";
    serviceDisplayName = "Google Drive";

    /**
     * Create an OAuth2 client configured with the user's access token
     */
    private createAuthClient(accessToken: string) {
        const oauth2Client = new auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return oauth2Client;
    }

    /**
     * Override credential lookup to use google-internal OAuth.
     */
    protected override async getOAuthAccessToken(
        userId: string,
        accountId?: string
    ): Promise<{ accessToken: string } | MCPToolResponse> {
        try {
            const credentials = await getCredentials(
                userId,
                CREDENTIALS_SERVICE,
                accountId
            );
            if (!credentials.accessToken) {
                return this.createErrorResponse(
                    `No access token found for ${this.serviceDisplayName}. ` +
                        `Please connect Google Workspace at: ${this.getGoogleInternalUrl()}`
                );
            }
            return { accessToken: credentials.accessToken };
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(
                    `${this.serviceDisplayName} requires Google Workspace connection. ` +
                        `Connect at: ${this.getGoogleInternalUrl()}`
                );
            }
            throw error;
        }
    }

    private getGoogleInternalUrl(): string {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return `${baseUrl.replace(/\/$/, "")}/integrations/${CREDENTIALS_SERVICE}`;
    }

    async testConnection(
        credentialOrToken: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const auth = this.createAuthClient(credentialOrToken);
            const driveClient = drive({ version: "v3", auth });
            await driveClient.about.get({ fields: "user" });
            return { success: true };
        } catch (error) {
            logger.error({ error, userId }, "Failed to verify Google Drive connection");
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
                "Full Google Drive access - browse, search, read, and manage all files. " +
                "Supports multiple Google accounts via accountId parameter.",
            commonOperations: ["list_files", "search_files", "download_file"],
            operations: [
                {
                    name: "list_accounts",
                    description: "List all connected Google accounts for this user",
                    parameters: [],
                    returns:
                        "Array of connected accounts with accountId and displayName",
                    example: `list_accounts()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_files",
                    description:
                        "List files in Drive. Defaults to root folder, can specify folder ID.",
                    parameters: [
                        {
                            name: "folder_id",
                            type: "string",
                            required: false,
                            description:
                                "Folder ID to list (default: 'root' for My Drive root)",
                            example: "1abc123def",
                        },
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description: "Max files to return (default: 50, max: 1000)",
                        },
                        {
                            name: "page_token",
                            type: "string",
                            required: false,
                            description:
                                "Token for pagination (from previous response)",
                        },
                        {
                            name: "order_by",
                            type: "string",
                            required: false,
                            description:
                                "Sort order: 'name', 'modifiedTime desc', 'createdTime desc'",
                            example: "modifiedTime desc",
                        },
                    ],
                    returns: "List of files with id, name, mimeType, and metadata",
                    example: `list_files({ folder_id: "root", page_size: 20 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "search_files",
                    description:
                        "Search for files using Drive query syntax. " +
                        "Supports name contains, mimeType, owner, etc.",
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "Drive query string. Examples: \"name contains 'report'\", " +
                                "\"mimeType='application/pdf'\", \"'me' in owners\"",
                            example: "name contains 'budget'",
                        },
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description: "Max results (default: 50)",
                        },
                        {
                            name: "page_token",
                            type: "string",
                            required: false,
                            description: "Token for pagination",
                        },
                    ],
                    returns: "List of matching files",
                    example: `search_files({ query: "name contains 'invoice' and mimeType='application/pdf'" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_file",
                    description: "Get metadata for a specific file by ID",
                    parameters: [
                        {
                            name: "file_id",
                            type: "string",
                            required: true,
                            description: "File ID to retrieve",
                        },
                    ],
                    returns:
                        "File metadata including name, size, mimeType, parents, etc.",
                    example: `get_file({ file_id: "1abc123" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "download_file",
                    description:
                        "Download file content. For Google Docs/Sheets/Slides, exports to common format.",
                    parameters: [
                        {
                            name: "file_id",
                            type: "string",
                            required: true,
                            description: "File ID to download",
                        },
                        {
                            name: "export_format",
                            type: "string",
                            required: false,
                            description:
                                "For Google files: 'pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'. " +
                                "Ignored for regular files.",
                            example: "pdf",
                        },
                    ],
                    returns: "File content (text for text files, base64 for binary)",
                    example: `download_file({ file_id: "1abc123", export_format: "pdf" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "create_folder",
                    description: "Create a new folder in Drive",
                    parameters: [
                        {
                            name: "name",
                            type: "string",
                            required: true,
                            description: "Folder name",
                        },
                        {
                            name: "parent_id",
                            type: "string",
                            required: false,
                            description: "Parent folder ID (default: root)",
                        },
                    ],
                    returns: "Created folder with id and webViewLink",
                    example: `create_folder({ name: "Project Files", parent_id: "root" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "move_file",
                    description: "Move a file to a different folder",
                    parameters: [
                        {
                            name: "file_id",
                            type: "string",
                            required: true,
                            description: "File ID to move",
                        },
                        {
                            name: "new_parent_id",
                            type: "string",
                            required: true,
                            description: "Destination folder ID",
                        },
                    ],
                    returns: "Updated file metadata",
                    example: `move_file({ file_id: "1abc123", new_parent_id: "folder456" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "rename_file",
                    description: "Rename a file or folder",
                    parameters: [
                        {
                            name: "file_id",
                            type: "string",
                            required: true,
                            description: "File ID to rename",
                        },
                        {
                            name: "new_name",
                            type: "string",
                            required: true,
                            description: "New name for the file",
                        },
                    ],
                    returns: "Updated file metadata",
                    example: `rename_file({ file_id: "1abc123", new_name: "Q1 Report Final.pdf" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "delete_file",
                    description:
                        "Move a file to trash. Use permanently_delete for permanent removal.",
                    parameters: [
                        {
                            name: "file_id",
                            type: "string",
                            required: true,
                            description: "File ID to delete",
                        },
                        {
                            name: "permanently_delete",
                            type: "boolean",
                            required: false,
                            description:
                                "If true, permanently deletes (no recovery). Default: false (trash)",
                        },
                    ],
                    returns: "Confirmation of deletion",
                    example: `delete_file({ file_id: "1abc123" })`,
                    annotations: { readOnlyHint: false, destructiveHint: true },
                },
                {
                    name: "share_file",
                    description: "Share a file with specific users or make it public",
                    parameters: [
                        {
                            name: "file_id",
                            type: "string",
                            required: true,
                            description: "File ID to share",
                        },
                        {
                            name: "email",
                            type: "string",
                            required: false,
                            description:
                                "Email address to share with (for user/group sharing)",
                        },
                        {
                            name: "role",
                            type: "string",
                            required: true,
                            description: "Permission: 'reader', 'writer', 'commenter'",
                            example: "reader",
                        },
                        {
                            name: "type",
                            type: "string",
                            required: false,
                            description:
                                "Share type: 'user', 'group', 'domain', 'anyone' (default: 'user')",
                        },
                        {
                            name: "send_notification",
                            type: "boolean",
                            required: false,
                            description: "Send email notification (default: true)",
                        },
                    ],
                    returns: "Created permission details",
                    example: `share_file({ file_id: "1abc123", email: "colleague@example.com", role: "writer" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "raw_api",
                    description:
                        "Direct access to Drive API for operations not covered above. " +
                        "Consult https://developers.google.com/drive/api/reference/rest/v3",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description: "Drive API endpoint (e.g., '/drive/v3/files')",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, DELETE, PATCH)",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description: "Request body for POST/PUT/PATCH",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters",
                        },
                    ],
                    returns: "Raw Drive API response",
                    example: `raw_api({ endpoint: "/drive/v3/about", method: "GET", query: { fields: "user,storageQuota" } })`,
                },
            ],
            docsUrl: "https://developers.google.com/drive/api/reference/rest/v3",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const validation = this.validate(action, params);
        if (!validation.valid) {
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        if (action === "list_accounts") {
            try {
                return await this.handleListAccounts(userId);
            } catch (error) {
                return this.handleOperationError(
                    error,
                    action,
                    params as Record<string, unknown>,
                    userId
                );
            }
        }

        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        try {
            switch (action) {
                case "list_files":
                    return await this.handleListFiles(params, accessToken);
                case "search_files":
                    return await this.handleSearchFiles(params, accessToken);
                case "get_file":
                    return await this.handleGetFile(params, accessToken);
                case "download_file":
                    return await this.handleDownloadFile(params, accessToken);
                case "create_folder":
                    return await this.handleCreateFolder(params, accessToken);
                case "move_file":
                    return await this.handleMoveFile(params, accessToken);
                case "rename_file":
                    return await this.handleRenameFile(params, accessToken);
                case "delete_file":
                    return await this.handleDeleteFile(params, accessToken);
                case "share_file":
                    return await this.handleShareFile(params, accessToken);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
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

    private async handleListAccounts(userId: string): Promise<MCPToolResponse> {
        const accounts = await listServiceAccounts(userId, CREDENTIALS_SERVICE);

        if (accounts.length === 0) {
            return this.createJSONResponse({
                accounts: [],
                message:
                    "No Google accounts connected. Connect Google Workspace at: " +
                    this.getGoogleInternalUrl(),
            });
        }

        return this.createJSONResponse({
            accounts: accounts.map((account) => ({
                accountId: account.accountId,
                displayName: account.accountDisplayName ?? account.accountId,
                isDefault: account.isDefault,
                status: account.status,
            })),
        });
    }

    private async handleListFiles(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            folder_id = "root",
            page_size = 50,
            page_token,
            order_by,
        } = params as {
            folder_id?: string;
            page_size?: number;
            page_token?: string;
            order_by?: string;
        };

        // Validate folder_id format to prevent query injection
        // Google Drive file IDs are alphanumeric with hyphens/underscores, or "root"
        if (folder_id !== "root" && !/^[a-zA-Z0-9_-]+$/.test(folder_id)) {
            return this.createErrorResponse(
                `Invalid folder_id format. Must be alphanumeric with dashes/underscores or "root".`
            );
        }

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        const response = await driveClient.files.list({
            q: `'${folder_id}' in parents and trashed = false`,
            pageSize: Math.min(page_size, 1000),
            pageToken: page_token,
            orderBy: order_by || "modifiedTime desc",
            fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, iconLink, parents)",
        });

        return this.createJSONResponse({
            files: response.data.files?.map(this.formatFile) ?? [],
            nextPageToken: response.data.nextPageToken,
            folder_id,
        });
    }

    private async handleSearchFiles(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            query,
            page_size = 50,
            page_token,
        } = params as {
            query: string;
            page_size?: number;
            page_token?: string;
        };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        // Add trashed = false to query if not already specified
        // Note: We trust the LLM to provide valid Drive query syntax.
        // Drive API query language uses single quotes for string literals,
        // so we don't escape them to preserve structured queries.
        const fullQuery = query.includes("trashed")
            ? query
            : `(${query}) and trashed = false`;

        const response = await driveClient.files.list({
            q: fullQuery,
            pageSize: Math.min(page_size, 1000),
            pageToken: page_token,
            fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, iconLink, parents)",
        });

        return this.createJSONResponse({
            files: response.data.files?.map(this.formatFile) ?? [],
            nextPageToken: response.data.nextPageToken,
            query,
        });
    }

    private async handleGetFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { file_id } = params as { file_id: string };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        const response = await driveClient.files.get({
            fileId: file_id,
            fields: "id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, iconLink, parents, owners, shared, permissions",
        });

        return this.createJSONResponse(this.formatFile(response.data));
    }

    /** Max file size for download (50MB) to prevent OOM */
    private static readonly MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024;

    private async handleDownloadFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { file_id, export_format } = params as {
            file_id: string;
            export_format?: string;
        };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        // First get file metadata to determine type
        const metadata = await driveClient.files.get({
            fileId: file_id,
            fields: "id, name, mimeType, size",
        });

        const mimeType = metadata.data.mimeType || "";
        const isGoogleFile = mimeType.startsWith("application/vnd.google-apps.");

        // Check file size for non-Google files (Google files are exported, size varies)
        if (!isGoogleFile && metadata.data.size) {
            const fileSize = parseInt(metadata.data.size, 10);
            if (fileSize > GoogleDriveAdapter.MAX_DOWNLOAD_SIZE) {
                return this.createErrorResponse(
                    `File is too large to download (${Math.round(fileSize / 1024 / 1024)}MB). ` +
                        `Maximum supported size is ${GoogleDriveAdapter.MAX_DOWNLOAD_SIZE / 1024 / 1024}MB. ` +
                        "Use webContentLink to download directly in browser."
                );
            }
        }

        let content: string;
        let outputMimeType: string;

        if (isGoogleFile) {
            // Export Google files
            const exportMime = this.getExportMimeType(mimeType, export_format);
            const response = await driveClient.files.export(
                { fileId: file_id, mimeType: exportMime },
                { responseType: "arraybuffer" }
            );

            const buffer = Buffer.from(response.data as ArrayBuffer);

            // For text formats, return as string; for binary, return base64
            if (
                exportMime.includes("text") ||
                exportMime === "text/csv" ||
                exportMime === "text/plain"
            ) {
                content = buffer.toString("utf-8");
            } else {
                content = buffer.toString("base64");
            }
            outputMimeType = exportMime;
        } else {
            // Download regular files
            const response = await driveClient.files.get(
                { fileId: file_id, alt: "media" },
                { responseType: "arraybuffer" }
            );

            const buffer = Buffer.from(response.data as ArrayBuffer);

            // Text files return as string, binary as base64
            if (
                mimeType.startsWith("text/") ||
                mimeType === "application/json" ||
                mimeType === "application/xml"
            ) {
                content = buffer.toString("utf-8");
            } else {
                content = buffer.toString("base64");
            }
            outputMimeType = mimeType;
        }

        // Determine encoding based on whether content was converted to UTF-8 or base64
        const isTextEncoded =
            outputMimeType.startsWith("text/") ||
            outputMimeType === "application/json" ||
            outputMimeType === "application/xml";

        return this.createJSONResponse({
            file_id,
            name: metadata.data.name,
            mimeType: outputMimeType,
            content,
            encoding: isTextEncoded ? "utf-8" : "base64",
        });
    }

    private getExportMimeType(
        googleMimeType: string,
        requestedFormat?: string
    ): string {
        const formatMap: Record<string, Record<string, string>> = {
            "application/vnd.google-apps.document": {
                pdf: "application/pdf",
                docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                txt: "text/plain",
                default: "text/plain",
            },
            "application/vnd.google-apps.spreadsheet": {
                pdf: "application/pdf",
                xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                csv: "text/csv",
                default: "text/csv",
            },
            "application/vnd.google-apps.presentation": {
                pdf: "application/pdf",
                pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                default: "application/pdf",
            },
            "application/vnd.google-apps.drawing": {
                pdf: "application/pdf",
                png: "image/png",
                svg: "image/svg+xml",
                default: "application/pdf",
            },
        };

        const typeFormats = formatMap[googleMimeType] || { default: "application/pdf" };
        return typeFormats[requestedFormat || "default"] || typeFormats.default;
    }

    private async handleCreateFolder(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { name, parent_id = "root" } = params as {
            name: string;
            parent_id?: string;
        };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        const response = await driveClient.files.create({
            requestBody: {
                name,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parent_id],
            },
            fields: "id, name, webViewLink",
        });

        return this.createJSONResponse({
            success: true,
            id: response.data.id,
            name: response.data.name,
            webViewLink: response.data.webViewLink,
        });
    }

    private async handleMoveFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { file_id, new_parent_id } = params as {
            file_id: string;
            new_parent_id: string;
        };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        // Get current parents
        const file = await driveClient.files.get({
            fileId: file_id,
            fields: "parents",
        });

        const previousParents = file.data.parents?.join(",") || "";

        const response = await driveClient.files.update({
            fileId: file_id,
            addParents: new_parent_id,
            removeParents: previousParents,
            fields: "id, name, parents, webViewLink",
        });

        return this.createJSONResponse({
            success: true,
            id: response.data.id,
            name: response.data.name,
            parents: response.data.parents,
            webViewLink: response.data.webViewLink,
        });
    }

    private async handleRenameFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { file_id, new_name } = params as {
            file_id: string;
            new_name: string;
        };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        const response = await driveClient.files.update({
            fileId: file_id,
            requestBody: { name: new_name },
            fields: "id, name, webViewLink",
        });

        return this.createJSONResponse({
            success: true,
            id: response.data.id,
            name: response.data.name,
            webViewLink: response.data.webViewLink,
        });
    }

    private async handleDeleteFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { file_id, permanently_delete = false } = params as {
            file_id: string;
            permanently_delete?: boolean;
        };

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        if (permanently_delete) {
            await driveClient.files.delete({ fileId: file_id });
            return this.createJSONResponse({
                success: true,
                file_id,
                action: "permanently_deleted",
                message: "File permanently deleted. This cannot be undone.",
            });
        } else {
            await driveClient.files.update({
                fileId: file_id,
                requestBody: { trashed: true },
            });
            return this.createJSONResponse({
                success: true,
                file_id,
                action: "trashed",
                message: "File moved to trash. Can be restored from trash.",
            });
        }
    }

    private async handleShareFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            file_id,
            email,
            role,
            type = "user",
            send_notification = true,
        } = params as {
            file_id: string;
            email?: string;
            role: string;
            type?: string;
            send_notification?: boolean;
        };

        // Validate email is provided for user/group sharing
        if ((type === "user" || type === "group") && !email) {
            return this.createErrorResponse(
                `Email address is required when sharing with type '${type}'. ` +
                    "Use type='anyone' to make the file public without an email."
            );
        }

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        const permission: drive_v3.Schema$Permission = {
            role,
            type,
        };

        if (email && (type === "user" || type === "group")) {
            permission.emailAddress = email;
        }

        const response = await driveClient.permissions.create({
            fileId: file_id,
            requestBody: permission,
            sendNotificationEmail: send_notification,
            fields: "id, role, type, emailAddress",
        });

        return this.createJSONResponse({
            success: true,
            file_id,
            permission: {
                id: response.data.id,
                role: response.data.role,
                type: response.data.type,
                emailAddress: response.data.emailAddress,
            },
        });
    }

    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        if (!endpoint?.startsWith("/drive/v3")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/drive/v3'. " +
                    `Got: ${endpoint}. Example: '/drive/v3/files'`
            );
        }

        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        const auth = this.createAuthClient(accessToken);
        const driveClient = drive({ version: "v3", auth });

        // Parse endpoint to determine which Drive API method to call
        // This is a simplified implementation - expand as needed
        try {
            const pathParts = endpoint.replace("/drive/v3/", "").split("/");
            const resource = pathParts[0];

            if (resource === "about" && method === "GET") {
                const response = await driveClient.about.get({
                    fields: (query?.fields as string) || "*",
                });
                return this.createJSONResponse(
                    response.data as Record<string, unknown>
                );
            }

            if (resource === "files") {
                if (pathParts.length === 1 && method === "GET") {
                    const response = await driveClient.files.list(
                        query as drive_v3.Params$Resource$Files$List
                    );
                    return this.createJSONResponse(
                        response.data as Record<string, unknown>
                    );
                }
                if (pathParts.length === 2 && method === "GET") {
                    const response = await driveClient.files.get({
                        fileId: pathParts[1],
                        ...(query as object),
                    });
                    return this.createJSONResponse(
                        response.data as Record<string, unknown>
                    );
                }
            }

            return this.createErrorResponse(
                `raw_api endpoint '${endpoint}' with method '${method}' not implemented. ` +
                    "Use specific operations like list_files, search_files, etc."
            );
        } catch (error) {
            this.captureAndLogError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });
            return this.createErrorResponse(
                `Raw API request failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    private formatFile(file: drive_v3.Schema$File): Record<string, unknown> {
        return {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size ? parseInt(file.size, 10) : undefined,
            modifiedTime: file.modifiedTime,
            createdTime: file.createdTime,
            webViewLink: file.webViewLink,
            webContentLink: file.webContentLink,
            iconLink: file.iconLink,
            parents: file.parents,
            owners: file.owners?.map((o) => ({
                displayName: o.displayName,
                emailAddress: o.emailAddress,
            })),
            shared: file.shared,
        };
    }
}
