/**
 * Dropbox Service Adapter
 *
 * File storage via Dropbox API.
 *
 * ## File Uploads NOT Supported
 * Upload endpoints use content.dropboxapi.com with binary bodies and custom headers -
 * incompatible with standard JSON requests. Users must upload via Dropbox UI.
 *
 * ## API Body Quirks (code workarounds in place)
 * - No-param endpoints require body: "null" (literal string)
 * - Download endpoints require empty body + Dropbox-API-Arg header
 * - Shared link creation fails if link exists - code falls back to list_shared_links
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { httpClient } from "@/lib/http-client";
import { logger } from "@/lib/logger";
import { DROPBOX_API_BASE, DROPBOX_CONTENT_API_BASE } from "../oauth/providers/dropbox";

// Constants for Dropbox API limits
const MAX_SEARCH_RESULTS = 100;
const MAX_LIST_RESULTS = 100;

export class DropboxAdapter extends ServiceAdapter {
    serviceName = "dropbox";
    serviceDisplayName = "Dropbox";

    private buildHeaders(accessToken: string): Record<string, string> {
        return {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };
    }

    /**
     * Test the OAuth connection by making a live API request
     * Called when user clicks "Test" button to verify credentials are working
     *
     * @param credentialOrToken - Access token or credential string
     * @param userId - User ID (optional, only used for logging)
     */
    async testConnection(
        credentialOrToken: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Verify connection by fetching account info
            await httpClient
                .post(`${DROPBOX_API_BASE}/users/get_current_account`, {
                    headers: this.buildHeaders(credentialOrToken),
                    body: "null", // See "API Request Body Quirks" in file header
                })
                .json<Record<string, unknown>>();

            return { success: true };
        } catch (error) {
            logger.error({ error, userId }, "Failed to verify Dropbox connection");
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
                "Access Dropbox files and folders. Note: File uploads not currently supported.",
            operations: [
                {
                    name: "list_folder",
                    description:
                        "List files and folders in a specific path. Use empty string for root.",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "path",
                            type: "string",
                            required: true,
                            description:
                                "Path to list (use '' for root, or '/folder/subfolder')",
                            example: "",
                        },
                        {
                            name: "recursive",
                            type: "boolean",
                            required: false,
                            description: "List all files recursively (default: false)",
                            example: "false",
                        },
                    ],
                    returns: "List of files and folders with metadata",
                    example: `list_folder({ path: "", recursive: false })`,
                },
                {
                    name: "search_files",
                    description: "Search for files and folders by name or content",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description: "Search query (file names or content)",
                        },
                        {
                            name: "path",
                            type: "string",
                            required: false,
                            description:
                                "Limit search to specific folder (default: search all)",
                            example: "/Documents",
                        },
                        {
                            name: "maxResults",
                            type: "number",
                            required: false,
                            description: "Maximum results to return (default: 20)",
                            example: "10",
                        },
                    ],
                    returns: "List of matching files and folders",
                    example: `search_files({ query: "report", path: "/Documents" })`,
                },
                {
                    name: "get_metadata",
                    description: "Get detailed metadata for a file or folder",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "path",
                            type: "string",
                            required: true,
                            description: "Path to file or folder",
                            example: "/Documents/report.pdf",
                        },
                    ],
                    returns: "Detailed metadata including size, dates, sharing info",
                },
                {
                    name: "download_file",
                    description:
                        "Download and read file content (text files, documents, etc.)",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "path",
                            type: "string",
                            required: true,
                            description: "Path to file to download",
                            example: "/Documents/notes.txt",
                        },
                    ],
                    returns:
                        "File content as text (for text files) or base64 (for binary files)",
                },
                {
                    name: "create_folder",
                    description: "Create a new folder",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "path",
                            type: "string",
                            required: true,
                            description: "Path for new folder",
                            example: "/Projects/New Project",
                        },
                    ],
                    returns: "Created folder metadata",
                },
                {
                    name: "move",
                    description: "Move or rename a file or folder",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                    parameters: [
                        {
                            name: "from_path",
                            type: "string",
                            required: true,
                            description: "Current path",
                            example: "/old-name.txt",
                        },
                        {
                            name: "to_path",
                            type: "string",
                            required: true,
                            description: "New path",
                            example: "/Documents/new-name.txt",
                        },
                    ],
                    returns: "Moved file/folder metadata",
                },
                {
                    name: "delete",
                    description: "Delete a file or folder",
                    annotations: { readOnlyHint: false, destructiveHint: true },
                    parameters: [
                        {
                            name: "path",
                            type: "string",
                            required: true,
                            description: "Path to delete",
                            example: "/old-file.txt",
                        },
                    ],
                    returns: "Deleted file/folder metadata",
                },
                {
                    name: "create_shared_link",
                    description: "Create a shareable link for a file or folder",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "path",
                            type: "string",
                            required: true,
                            description: "Path to share",
                            example: "/Documents/presentation.pdf",
                        },
                    ],
                    returns: "Shareable link URL and settings",
                },
                {
                    name: "get_current_account",
                    description: "Get information about the connected Dropbox account",
                    annotations: { readOnlyHint: true },
                    parameters: [],
                    returns: "Account details including name, email, and usage",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Dropbox API - you can perform nearly any operation supported by Dropbox. " +
                        "If you're familiar with the Dropbox API structure, construct the request directly. " +
                        "If unsure/errors: fallback to https://www.dropbox.com/developers/documentation/http/documentation",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Dropbox API endpoint path (e.g., '/2/files/list_folder', '/2/files/upload', '/2/sharing/share_folder')",
                            example: "/2/files/get_metadata",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, DELETE, PATCH)",
                            example: "POST",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description:
                                "Request body for POST/PUT/PATCH requests. Structure depends on the endpoint - " +
                                "for example, listing a folder requires path and recursive fields. " +
                                "Use the Dropbox API structure you're familiar with, or consult the documentation if needed.",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw Dropbox API response as JSON",
                    example: `raw_api({ endpoint: "/2/files/get_metadata", method: "POST", body: { path: "/test.txt" } })`,
                },
            ],
            commonOperations: [
                "search_files",
                "list_folder",
                "download_file",
                "create_shared_link",
            ],
            docsUrl:
                "https://www.dropbox.com/developers/documentation/http/documentation",
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
            this.logError(
                `[DROPBOX ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        try {
            switch (action) {
                case "list_folder":
                    return await this.handleListFolder(params, accessToken);
                case "search_files":
                    return await this.handleSearchFiles(params, accessToken);
                case "get_metadata":
                    return await this.handleGetMetadata(params, accessToken);
                case "download_file":
                    return await this.handleDownloadFile(params, accessToken);
                case "create_folder":
                    return await this.handleCreateFolder(params, accessToken);
                case "move":
                    return await this.handleMove(params, accessToken);
                case "delete":
                    return await this.handleDelete(params, accessToken);
                case "create_shared_link":
                    return await this.handleCreateSharedLink(params, accessToken);
                case "get_current_account":
                    return await this.handleGetCurrentAccount(accessToken);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    this.logError(
                        `[DROPBOX ADAPTER] Unknown action '${action}' requested by user ${userId}`
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

    private async handleListFolder(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { path, recursive = false } = params as {
            path: string;
            recursive?: boolean;
        };

        const response = await httpClient
            .post(`${DROPBOX_API_BASE}/files/list_folder`, {
                headers: this.buildHeaders(accessToken),
                json: {
                    path: path === "" ? "" : path,
                    recursive,
                    include_deleted: false,
                    include_has_explicit_shared_members: false,
                    include_mounted_folders: true,
                    limit: MAX_LIST_RESULTS,
                },
            })
            .json<{
                entries: Array<{
                    ".tag": string;
                    name: string;
                    path_display: string;
                    id: string;
                    size?: number;
                    client_modified?: string;
                    server_modified?: string;
                }>;
                cursor: string;
                has_more: boolean;
            }>();

        const formattedEntries = response.entries.map((entry) => {
            const isFolder = entry[".tag"] === "folder";
            return {
                type: isFolder ? "folder" : "file",
                name: entry.name,
                path: entry.path_display,
                id: entry.id,
                size: entry.size,
                modified: entry.server_modified || entry.client_modified,
            };
        });

        return this.createJSONResponse({
            path: path || "/",
            count: formattedEntries.length,
            hasMore: response.has_more,
            entries: formattedEntries,
        });
    }

    private async handleSearchFiles(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            query,
            path = "",
            maxResults = 20,
        } = params as {
            query: string;
            path?: string;
            maxResults?: number;
        };

        const cappedMaxResults = Math.min(
            Math.max(1, Math.floor(maxResults || 20)),
            MAX_SEARCH_RESULTS
        );

        const response = await httpClient
            .post(`${DROPBOX_API_BASE}/files/search_v2`, {
                headers: this.buildHeaders(accessToken),
                json: {
                    query,
                    options: {
                        path: path || "",
                        max_results: cappedMaxResults,
                        filename_only: false, // Search in content too
                    },
                },
            })
            .json<{
                matches: Array<{
                    metadata: {
                        ".tag": string;
                        metadata: {
                            ".tag": string;
                            name: string;
                            path_display: string;
                            id: string;
                            size?: number;
                            client_modified?: string;
                            server_modified?: string;
                        };
                    };
                }>;
                has_more: boolean;
            }>();

        const formattedMatches = response.matches.map((match) => {
            const metadata = match.metadata.metadata;
            const isFolder = metadata[".tag"] === "folder";
            return {
                type: isFolder ? "folder" : "file",
                name: metadata.name,
                path: metadata.path_display,
                id: metadata.id,
                size: metadata.size,
                modified: metadata.server_modified || metadata.client_modified,
            };
        });

        return this.createJSONResponse({
            query,
            count: formattedMatches.length,
            hasMore: response.has_more,
            matches: formattedMatches,
        });
    }

    private async handleGetMetadata(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { path } = params as { path: string };

        const response = await httpClient
            .post(`${DROPBOX_API_BASE}/files/get_metadata`, {
                headers: this.buildHeaders(accessToken),
                json: {
                    path,
                    include_deleted: false,
                },
            })
            .json<{
                ".tag": string;
                name: string;
                path_display: string;
                id: string;
                size?: number;
                client_modified?: string;
                server_modified?: string;
                rev?: string;
                content_hash?: string;
            }>();

        const isFolder = response[".tag"] === "folder";

        return this.createJSONResponse({
            type: isFolder ? "folder" : "file",
            name: response.name,
            path: response.path_display,
            id: response.id,
            size: response.size,
            modified: response.server_modified || response.client_modified,
            rev: response.rev,
            contentHash: response.content_hash,
        });
    }

    private async handleDownloadFile(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { path } = params as { path: string };

        // Content endpoint - see "API Request Body Quirks" in file header
        // Get response as ArrayBuffer to preserve raw bytes for binary files
        const arrayBuffer = await httpClient
            .post(`${DROPBOX_CONTENT_API_BASE}/files/download`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Dropbox-API-Arg": JSON.stringify({ path }),
                },
                body: "", // See "Dropbox API Request Body Quirks" above
            })
            .arrayBuffer();

        // Convert to Buffer for binary detection and processing
        const buffer = Buffer.from(arrayBuffer);

        // Detect if file is binary or text
        // Binary files contain null bytes or excessive control characters
        const isBinary =
            buffer.includes(0) ||
            /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(buffer.toString("binary"));

        if (isBinary) {
            // Binary file - return as base64 (preserves original bytes)
            const base64Content = buffer.toString("base64");
            return this.createJSONResponse({
                path,
                contentType: "binary",
                content: base64Content,
                note: "Binary file returned as base64",
            });
        }

        // Text file - decode as UTF-8 and return as readable text
        const textContent = buffer.toString("utf-8");
        return this.createSuccessResponse(`File: ${path}\n\nContent:\n${textContent}`);
    }

    private async handleCreateFolder(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { path } = params as { path: string };

        const response = await httpClient
            .post(`${DROPBOX_API_BASE}/files/create_folder_v2`, {
                headers: this.buildHeaders(accessToken),
                json: {
                    path,
                    autorename: false,
                },
            })
            .json<{
                metadata: {
                    name: string;
                    path_display: string;
                    id: string;
                };
            }>();

        return this.createJSONResponse({
            name: response.metadata.name,
            path: response.metadata.path_display,
            id: response.metadata.id,
        });
    }

    private async handleMove(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { from_path, to_path } = params as {
            from_path: string;
            to_path: string;
        };

        const response = await httpClient
            .post(`${DROPBOX_API_BASE}/files/move_v2`, {
                headers: this.buildHeaders(accessToken),
                json: {
                    from_path,
                    to_path,
                    autorename: false,
                    allow_shared_folder: false,
                    allow_ownership_transfer: false,
                },
            })
            .json<{
                metadata: {
                    ".tag": string;
                    name: string;
                    path_display: string;
                    id: string;
                };
            }>();

        return this.createJSONResponse({
            type: response.metadata[".tag"],
            name: response.metadata.name,
            path: response.metadata.path_display,
            id: response.metadata.id,
        });
    }

    private async handleDelete(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { path } = params as { path: string };

        const response = await httpClient
            .post(`${DROPBOX_API_BASE}/files/delete_v2`, {
                headers: this.buildHeaders(accessToken),
                json: {
                    path,
                },
            })
            .json<{
                metadata: {
                    ".tag": string;
                    name: string;
                    path_display: string;
                };
            }>();

        return this.createSuccessResponse(
            `✓ Deleted ${response.metadata[".tag"]}: ${response.metadata.path_display}`
        );
    }

    private async handleCreateSharedLink(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { path } = params as { path: string };

        try {
            const response = await httpClient
                .post(`${DROPBOX_API_BASE}/sharing/create_shared_link_with_settings`, {
                    headers: this.buildHeaders(accessToken),
                    json: {
                        path,
                        settings: {
                            requested_visibility: "public",
                        },
                    },
                })
                .json<{
                    url: string;
                    name: string;
                    path_lower: string;
                }>();

            return this.createJSONResponse({
                url: response.url,
                name: response.name,
                path: response.path_lower,
            });
        } catch (error) {
            // If link already exists, try to list existing links
            if (
                error instanceof Error &&
                error.message.includes("shared_link_already_exists")
            ) {
                const listResponse = await httpClient
                    .post(`${DROPBOX_API_BASE}/sharing/list_shared_links`, {
                        headers: this.buildHeaders(accessToken),
                        json: {
                            path,
                        },
                    })
                    .json<{
                        links: Array<{
                            url: string;
                            name: string;
                            path_lower: string;
                        }>;
                    }>();

                if (listResponse.links.length > 0) {
                    const link = listResponse.links[0];
                    // Note: Not capturing to Sentry here as this is an expected case (link already exists)
                    return this.createJSONResponse({
                        url: link.url,
                        name: link.name,
                        path: link.path_lower,
                        note: "Using existing shared link",
                    });
                }
            }
            // Error will be caught and captured by the outer execute catch block
            throw error;
        }
    }

    private async handleGetCurrentAccount(
        accessToken: string
    ): Promise<MCPToolResponse> {
        const [accountResponse, spaceResponse] = await Promise.all([
            httpClient
                .post(`${DROPBOX_API_BASE}/users/get_current_account`, {
                    headers: this.buildHeaders(accessToken),
                    body: "null", // See "API Request Body Quirks" in file header
                })
                .json<{
                    account_id: string;
                    name: {
                        display_name: string;
                        given_name?: string;
                        surname?: string;
                    };
                    email: string;
                    country?: string;
                    account_type: {
                        ".tag": string;
                    };
                }>(),
            httpClient
                .post(`${DROPBOX_API_BASE}/users/get_space_usage`, {
                    headers: this.buildHeaders(accessToken),
                    body: "null", // See "API Request Body Quirks" in file header
                })
                .json<{
                    used: number;
                    allocation: {
                        ".tag": string;
                        allocated?: number;
                    };
                }>(),
        ]);

        const usedGB = (spaceResponse.used / (1024 * 1024 * 1024)).toFixed(2);
        const allocatedGB = spaceResponse.allocation.allocated
            ? `${(spaceResponse.allocation.allocated / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : "Unlimited";

        return this.createJSONResponse({
            accountId: accountResponse.account_id,
            name: accountResponse.name.display_name,
            email: accountResponse.email,
            country: accountResponse.country,
            accountType: accountResponse.account_type[".tag"],
            storage: {
                used: `${usedGB} GB`,
                allocated: allocatedGB,
                usedBytes: spaceResponse.used,
                allocatedBytes: spaceResponse.allocation.allocated,
            },
        });
    }

    /**
     * Execute a raw Dropbox API request
     */
    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST, PUT, DELETE, PATCH)"
            );
        }

        if (!endpoint.startsWith("/2/")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/2/'. " +
                    `Got: ${endpoint}. Example: '/2/files/get_metadata'`
            );
        }

        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        const requestOptions: {
            headers: Record<string, string>;
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: this.buildHeaders(accessToken),
        };

        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
            requestOptions.json = body;
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "put"
                | "delete"
                | "patch";
            const fullUrl = `https://api.dropboxapi.com${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            return this.createJSONResponse(response);
        } catch (error) {
            this.captureAndLogError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            let errorMessage = `Raw API request failed: `;
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the Dropbox API docs: " +
                        "https://www.dropbox.com/developers/documentation/http/documentation";
                } else {
                    errorMessage += this.getAPIErrorDescription(error);
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    /**
     * Handle Dropbox-specific API errors before falling back to common handling
     */
    protected override handleCommonAPIError(error: unknown, action: string): string {
        if (error instanceof Error) {
            const errMsg = error.message;

            // Dropbox-specific: file/folder conflict
            if (errMsg.includes("conflict")) {
                return `We couldn't ${action}: A file or folder with that name already exists at this location.`;
            }

            // Dropbox-specific: storage quota exceeded
            if (errMsg.includes("insufficient_space")) {
                return `We couldn't ${action}: Not enough space in your Dropbox account to complete this operation.`;
            }
        }

        // Fall back to common error handling
        return super.handleCommonAPIError(error, action);
    }
}
