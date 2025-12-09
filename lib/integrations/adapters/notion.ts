/**
 * Notion Service Adapter
 *
 * Provides Notion workspace operations through the Notion API via Nango proxy
 *
 * ## API Version and Terminology Note
 *
 * We use API version "2025-09-03" which documents a transition from databases to
 * data_sources. However, testing reveals the new data_source structure is not yet
 * deployed in the actual API:
 *
 * - ✅ WORKS: database_id, page_id parents
 * - ❌ FAILS: data_source_id parent (returns 400 error)
 * - Databases still return properties directly (not via data_sources array)
 *
 * This adapter uses the working API structure (database_id) while monitoring for
 * when the documented data_source migration actually goes live.
 *
 * ## Internal Integration Limitations
 *
 * As an internal integration, this adapter CANNOT create top-level workspace or
 * teamspace pages using parent: { workspace: true }. Per Notion's API:
 * "A page or data source parent is currently required in the API, because there is
 * no one specific Notion user associated with them that could be used as the 'owner'
 * of the new private page."
 *
 * To create pages in a teamspace, use parent: { page_id: "..." } with an existing
 * page in that teamspace as the parent.
 *
 * Last verified: 2025-11-09
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ValidationError } from "@/lib/errors";

/** Get and validate Nango secret key */
function getNangoSecretKey(): string {
    if (!env.NANGO_SECRET_KEY) {
        throw new Error("Missing required environment variable: NANGO_SECRET_KEY");
    }
    return env.NANGO_SECRET_KEY;
}

// Constants for Notion API
const NOTION_API_VERSION = "2025-09-03";
const MAX_PAGE_SIZE = 100;

/**
 * Normalizes a Notion UUID to the hyphenated format required by the Notion API.
 * Accepts both hyphenated and non-hyphenated UUIDs.
 * If the ID is already properly formatted or doesn't match UUID pattern, returns as-is.
 * @param id - The UUID string (with or without hyphens)
 * @returns The UUID in hyphenated format (8-4-4-4-12) or original if not a UUID
 * @example
 * normalizeNotionId('291dc1ba6d7681c6a172d8f9e998194d') // '291dc1ba-6d76-81c6-a172-d8f9e998194d'
 * normalizeNotionId('291dc1ba-6d76-81c6-a172-d8f9e998194d') // '291dc1ba-6d76-81c6-a172-d8f9e998194d'
 * normalizeNotionId('page-uuid') // 'page-uuid' (test IDs pass through)
 */
function normalizeNotionId(id: string): string {
    // If already properly formatted (has hyphens), return as-is
    if (id.includes("-")) {
        return id;
    }

    // Only normalize if it looks like a 32-character hex string (UUID without hyphens)
    if (/^[0-9a-f]{32}$/i.test(id)) {
        // Format as UUID: 8-4-4-4-12
        return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
    }

    // Return as-is if it doesn't match UUID pattern (e.g., test IDs like "page-uuid")
    return id;
}

export class NotionAdapter extends ServiceAdapter {
    serviceName = "notion";
    serviceDisplayName = "Notion";

    private getNangoUrl(): string {
        if (!env.NANGO_API_URL) {
            throw new Error("Missing required environment variable: NANGO_API_URL");
        }
        return env.NANGO_API_URL;
    }

    /**
     * Fetch the Notion workspace information
     * Used to populate accountIdentifier and accountDisplayName after OAuth
     */
    async fetchAccountInfo(userId: string): Promise<{
        identifier: string;
        displayName: string;
    }> {
        const credentials = await getCredentials(userId, this.serviceName);

        if (!credentials.connectionId) {
            throw new ValidationError(
                `No Nango connection ID found for ${this.serviceDisplayName}. ` +
                    `Please reconnect your account at /integrations/${this.serviceName}`
            );
        }

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            // Get bot user info to determine workspace
            const response = await httpClient
                .get(`${nangoUrl}/proxy/v1/users/me`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": credentials.connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                    },
                })
                .json<{
                    id: string;
                    name?: string;
                    type: string;
                    bot?: {
                        owner: {
                            type: string;
                            workspace?: boolean;
                        };
                        workspace_name?: string;
                    };
                }>();

            // For bot users, try to get workspace name
            const workspaceName =
                response.bot?.workspace_name || response.name || "Notion Workspace";
            const workspaceId = response.id;

            return {
                identifier: workspaceId,
                displayName: workspaceName,
            };
        } catch (error) {
            this.logError("Failed to fetch Notion account info:", error);
            throw new ValidationError("Failed to fetch Notion account information");
        }
    }

    getHelp(): HelpResponse {
        return {
            service: this.serviceDisplayName,
            operations: [
                {
                    name: "search",
                    description:
                        "Search across all pages and databases in the workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "query",
                            type: "string",
                            required: true,
                            description:
                                "Search terms to find in page titles and content",
                            example: "project roadmap",
                        },
                        {
                            name: "filter",
                            type: "object",
                            required: false,
                            description: "Filter by object type: page or database",
                            example: '{ "property": "object", "value": "page" }',
                        },
                        {
                            name: "sort",
                            type: "object",
                            required: false,
                            description: "Sort direction and timestamp",
                            example:
                                '{ "direction": "ascending", "timestamp": "last_edited_time" }',
                        },
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description:
                                "Number of results to return (default: 25, max: 100)",
                            example: "10",
                        },
                    ],
                    returns:
                        "List of matching pages/databases with titles, IDs, and metadata",
                    example: `search({ query: "meeting notes", filter: { property: "object", value: "page" } })`,
                },
                {
                    name: "get_page",
                    description:
                        "Retrieve full page content including properties and blocks",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "page_id",
                            type: "string",
                            required: true,
                            description: "Page ID (UUID format)",
                        },
                        {
                            name: "include_blocks",
                            type: "boolean",
                            required: false,
                            description: "Include child blocks (default: true)",
                            example: "true",
                        },
                    ],
                    returns: "Page object with properties, blocks, and metadata",
                },
                {
                    name: "create_page",
                    description:
                        "Create a new page as child of another page or in a database",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "parent",
                            type: "object",
                            required: true,
                            description:
                                "Parent location: page ID for child pages or database ID for database entries",
                            example:
                                '{ "page_id": "parent-uuid" } or { "database_id": "database-uuid" }',
                        },
                        {
                            name: "properties",
                            type: "object",
                            required: true,
                            description: "Page properties (title, etc.)",
                            example:
                                '{ "title": [{ "text": { "content": "New Page" } }] }',
                        },
                        {
                            name: "children",
                            type: "array",
                            required: false,
                            description: "Initial content blocks",
                        },
                    ],
                    returns: "Created page object with ID and URL",
                },
                {
                    name: "update_page",
                    description:
                        "Update page properties (title, archived status, etc.)",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                    parameters: [
                        {
                            name: "page_id",
                            type: "string",
                            required: true,
                            description: "Page ID to update",
                        },
                        {
                            name: "properties",
                            type: "object",
                            required: false,
                            description: "Properties to update",
                        },
                        {
                            name: "archived",
                            type: "boolean",
                            required: false,
                            description: "Archive (true) or restore (false) the page",
                        },
                    ],
                    returns: "Updated page object",
                },
                {
                    name: "list_databases",
                    description: "List all databases in the workspace",
                    annotations: { readOnlyHint: true },
                    parameters: [],
                    returns: "List of databases with names and IDs",
                },
                {
                    name: "get_database",
                    description: "Retrieve database metadata and schema definition",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "database_id",
                            type: "string",
                            required: true,
                            description: "Database ID (UUID)",
                        },
                    ],
                    returns:
                        "Database object with title, properties schema, and metadata",
                },
                {
                    name: "create_database",
                    description: "Create a new database in the workspace",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "parent",
                            type: "object",
                            required: true,
                            description:
                                "Parent page where the database will be created",
                            example: '{ "page_id": "parent-page-uuid" }',
                        },
                        {
                            name: "title",
                            type: "array",
                            required: true,
                            description: "Database title as rich text array",
                            example:
                                '[{ "type": "text", "text": { "content": "My Database" } }]',
                        },
                        {
                            name: "properties",
                            type: "object",
                            required: true,
                            description:
                                "Database schema defining columns and their types (title, rich_text, number, select, multi_select, date, checkbox, url, email, phone_number, etc.)",
                            example:
                                '{ "Name": { "title": {} }, "Status": { "select": { "options": [{ "name": "Not Started" }, { "name": "In Progress" }, { "name": "Done" }] } }, "Due Date": { "date": {} } }',
                        },
                    ],
                    returns: "Created database object with ID and URL",
                    example: `create_database({ parent: { page_id: "abc123" }, title: [{ type: "text", text: { content: "Project Tracker" } }], properties: { "Name": { title: {} }, "Status": { select: {} } } })`,
                },
                {
                    name: "update_database",
                    description: "Update database properties, title, or schema",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                    parameters: [
                        {
                            name: "database_id",
                            type: "string",
                            required: true,
                            description: "Database ID (UUID)",
                        },
                        {
                            name: "title",
                            type: "array",
                            required: false,
                            description: "Updated database title as rich text array",
                            example:
                                '[{ "type": "text", "text": { "content": "Updated Title" } }]',
                        },
                        {
                            name: "properties",
                            type: "object",
                            required: false,
                            description:
                                "Add or modify database properties. To add a property, include it with full schema. To remove a property, set it to null.",
                            example:
                                '{ "New Column": { "rich_text": {} }, "Status": { "select": { "options": [{ "name": "New Option" }] } } }',
                        },
                        {
                            name: "icon",
                            type: "object",
                            required: false,
                            description: "Database icon (emoji or external URL)",
                            example: '{ "type": "emoji", "emoji": "📊" }',
                        },
                        {
                            name: "cover",
                            type: "object",
                            required: false,
                            description: "Database cover image",
                            example:
                                '{ "type": "external", "external": { "url": "https://..." } }',
                        },
                    ],
                    returns: "Updated database object with new schema",
                    example: `update_database({ database_id: "abc123", properties: { "Priority": { "select": { "options": [{ "name": "High", "color": "red" }] } } } })`,
                },
                {
                    name: "query_database",
                    description: "Query a database with filters, sorts, and pagination",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "database_id",
                            type: "string",
                            required: true,
                            description: "Database ID (UUID)",
                        },
                        {
                            name: "filter",
                            type: "object",
                            required: false,
                            description: "Filter conditions",
                            example:
                                '{ "property": "Status", "status": { "equals": "In Progress" } }',
                        },
                        {
                            name: "sorts",
                            type: "array",
                            required: false,
                            description: "Sort specifications",
                            example:
                                '[{ "property": "Due Date", "direction": "ascending" }]',
                        },
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description: "Results per page (max 100)",
                            example: "50",
                        },
                    ],
                    returns: "Array of database pages (entries) matching criteria",
                },
                {
                    name: "create_database_entry",
                    description: "Add a new entry (page) to a database",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "database_id",
                            type: "string",
                            required: true,
                            description: "Database ID",
                        },
                        {
                            name: "properties",
                            type: "object",
                            required: true,
                            description: "Property values for all required fields",
                        },
                        {
                            name: "children",
                            type: "array",
                            required: false,
                            description: "Content blocks for the entry",
                        },
                    ],
                    returns: "Created database entry with ID",
                },
                {
                    name: "append_blocks",
                    description: "Add content blocks to a page",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "block_id",
                            type: "string",
                            required: true,
                            description: "Parent block or page ID",
                        },
                        {
                            name: "children",
                            type: "array",
                            required: true,
                            description:
                                "Blocks to append (paragraph, heading, list, etc.)",
                        },
                    ],
                    returns: "List of created block objects",
                },
                {
                    name: "get_block",
                    description: "Retrieve block details",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "block_id",
                            type: "string",
                            required: true,
                            description: "Block ID",
                        },
                    ],
                    returns: "Block object with content and metadata",
                },
                {
                    name: "update_block",
                    description: "Update an existing block's content or archive it",
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                    parameters: [
                        {
                            name: "block_id",
                            type: "string",
                            required: true,
                            description: "Block ID to update",
                        },
                        {
                            name: "block_type",
                            type: "string",
                            required: false,
                            description:
                                "Type of block (paragraph, heading_1, heading_2, heading_3, bulleted_list_item, numbered_list_item, to_do, toggle, code, quote, etc.)",
                        },
                        {
                            name: "content",
                            type: "object",
                            required: false,
                            description:
                                "Updated block content. Structure depends on block_type. For most blocks, provide rich_text array.",
                            example:
                                '{ "rich_text": [{ "text": { "content": "Updated content" } }] }',
                        },
                        {
                            name: "archived",
                            type: "boolean",
                            required: false,
                            description: "Set to true to archive the block",
                        },
                    ],
                    returns: "Updated block object",
                    example: `update_block({ block_id: "block-uuid", block_type: "paragraph", content: { rich_text: [{ text: { content: "New text" } }] } })`,
                },
                {
                    name: "get_child_blocks",
                    description: "Retrieve child blocks of a block or page",
                    annotations: { readOnlyHint: true },
                    parameters: [
                        {
                            name: "block_id",
                            type: "string",
                            required: true,
                            description: "Parent block or page ID",
                        },
                        {
                            name: "page_size",
                            type: "number",
                            required: false,
                            description: "Number of results to return (max 100)",
                            example: "50",
                        },
                        {
                            name: "start_cursor",
                            type: "string",
                            required: false,
                            description: "Pagination cursor from previous response",
                        },
                    ],
                    returns: "Array of child blocks with pagination info",
                },
                {
                    name: "create_comment",
                    description: "Add a comment to a page or discussion",
                    annotations: { readOnlyHint: false, destructiveHint: false },
                    parameters: [
                        {
                            name: "page_id",
                            type: "string",
                            required: true,
                            description: "Page to comment on",
                        },
                        {
                            name: "rich_text",
                            type: "array",
                            required: true,
                            description: "Comment content",
                            example: '[{ "text": { "content": "Great work!" } }]',
                        },
                    ],
                    returns: "Created comment object",
                },
                {
                    name: "list_users",
                    description: "Get workspace users",
                    annotations: { readOnlyHint: true },
                    parameters: [],
                    returns: "List of workspace users with names and IDs",
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Notion API - you can perform nearly any operation supported by Notion. " +
                        "If you're familiar with the Notion API structure, construct the request directly. " +
                        "If unsure/errors: try context7 (/websites/developers_notion) or https://developers.notion.com/reference/intro",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Notion API endpoint path (e.g., '/v1/pages', '/v1/databases', '/v1/blocks/{id}')",
                            example: "/v1/databases",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PATCH, DELETE)",
                            example: "POST",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description:
                                "Request body for POST/PATCH requests. Structure depends on the endpoint - " +
                                "for example, creating a database requires parent, title, and properties fields. " +
                                "Use the Notion API structure you're familiar with, or consult the documentation if needed.",
                        },
                    ],
                    returns: "Raw Notion API response as JSON",
                    example:
                        `raw_api({ endpoint: "/v1/users/me", method: "GET" }) or ` +
                        `raw_api({ endpoint: "/v1/databases", method: "POST", body: { parent: { page_id: "..." }, title: [...], properties: {...} } })`,
                },
            ],
            commonOperations: [
                "search",
                "get_page",
                "create_page",
                "query_database",
                "create_database_entry",
            ],
            docsUrl: "https://developers.notion.com/reference/intro",
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
                `[NOTION ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's Notion credentials via connection manager
        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for Notion. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/notion`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        // Route to appropriate handler
        try {
            switch (action) {
                case "search":
                    return await this.handleSearch(params, connectionId);
                case "get_page":
                    return await this.handleGetPage(params, connectionId);
                case "create_page":
                    return await this.handleCreatePage(params, connectionId);
                case "update_page":
                    return await this.handleUpdatePage(params, connectionId);
                case "list_databases":
                    return await this.handleListDatabases(connectionId);
                case "get_database":
                    return await this.handleGetDatabase(params, connectionId);
                case "create_database":
                    return await this.handleCreateDatabase(params, connectionId);
                case "update_database":
                    return await this.handleUpdateDatabase(params, connectionId);
                case "query_database":
                    return await this.handleQueryDatabase(params, connectionId);
                case "create_database_entry":
                    return await this.handleCreateDatabaseEntry(params, connectionId);
                case "append_blocks":
                    return await this.handleAppendBlocks(params, connectionId);
                case "get_block":
                    return await this.handleGetBlock(params, connectionId);
                case "update_block":
                    return await this.handleUpdateBlock(params, connectionId);
                case "get_child_blocks":
                    return await this.handleGetChildBlocks(params, connectionId);
                case "create_comment":
                    return await this.handleCreateComment(params, connectionId);
                case "list_users":
                    return await this.handleListUsers(connectionId);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    this.logError(
                        `[NOTION ADAPTER] Unknown action '${action}' requested by user ${userId}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            // Comprehensive error logging
            this.logError(
                `[NOTION ADAPTER] Failed to execute ${action} for user ${userId}:`,
                {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    params,
                    connectionId,
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            // User-friendly error message
            let errorMessage = `Failed to ${action}: `;
            if (error instanceof Error) {
                // Parse common error types
                if (error.message.includes("404")) {
                    errorMessage +=
                        "The requested resource was not found. Check that the page/database ID is correct and that the integration has access.";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                    errorMessage += `Authentication failed. Your Notion connection may have expired. Please reconnect at: ${appUrl}/integrations/notion`;
                } else if (error.message.includes("429")) {
                    errorMessage +=
                        "Rate limit exceeded (3 requests/second). Please try again in a moment.";
                } else if (
                    error.message.includes("500") ||
                    error.message.includes("503")
                ) {
                    errorMessage +=
                        "Notion service is temporarily unavailable. Please try again later.";
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    private async handleSearch(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            query,
            filter,
            sort,
            page_size = 25,
        } = params as {
            query: string;
            filter?: { property: string; value: string };
            sort?: { direction: string; timestamp: string };
            page_size?: number;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // Cap page_size between 1 and MAX_PAGE_SIZE (100)
        const cappedPageSize = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);

        const requestBody: {
            query: string;
            filter?: { property: string; value: string };
            sort?: { direction: string; timestamp: string };
            page_size?: number;
        } = {
            query,
            page_size: cappedPageSize,
        };

        if (filter) {
            requestBody.filter = filter;
        }
        if (sort) {
            requestBody.sort = sort;
        }

        const response = await httpClient
            .post(`${nangoUrl}/proxy/v1/search`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: requestBody,
            })
            .json<{
                results: Array<{
                    id: string;
                    object: string;
                    created_time: string;
                    last_edited_time: string;
                    properties?: Record<string, unknown>;
                    title?: Array<{ plain_text: string }>;
                    url: string;
                }>;
                has_more: boolean;
                next_cursor: string | null;
            }>();

        if (!response.results || response.results.length === 0) {
            return this.createJSONResponse({
                query,
                totalCount: 0,
                results: [],
            });
        }

        // Format results for readability
        const formattedResults = response.results.map((result) => {
            let title = "Untitled";
            if (result.title && result.title.length > 0) {
                title = result.title[0].plain_text;
            } else if (result.properties) {
                // Try to extract title from properties
                const titleProp = Object.values(result.properties).find(
                    (
                        prop
                    ): prop is {
                        type: string;
                        title?: Array<{ plain_text: string }>;
                    } =>
                        typeof prop === "object" &&
                        prop !== null &&
                        "type" in prop &&
                        prop.type === "title"
                );
                if (titleProp?.title?.[0]?.plain_text) {
                    title = titleProp.title[0].plain_text;
                }
            }

            return {
                id: result.id,
                type: result.object,
                title,
                url: result.url,
                last_edited: result.last_edited_time,
            };
        });

        return this.createJSONResponse({
            query,
            totalCount: response.results.length,
            has_more: response.has_more,
            results: formattedResults,
        });
    }

    private async handleGetPage(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { page_id, include_blocks = true } = params as {
            page_id: string;
            include_blocks?: boolean;
        };

        // Normalize the page_id to ensure it has hyphens
        const normalizedPageId = normalizeNotionId(page_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            // Get page metadata
            const page = await httpClient
                .get(`${nangoUrl}/proxy/v1/pages/${normalizedPageId}`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                    },
                })
                .json<{
                    id: string;
                    properties: Record<string, unknown>;
                    url: string;
                    created_time: string;
                    last_edited_time: string;
                }>();

            let blocks: Array<Record<string, unknown>> = [];
            if (include_blocks !== false) {
                const blocksResponse = await httpClient
                    .get(`${nangoUrl}/proxy/v1/blocks/${normalizedPageId}/children`, {
                        headers: {
                            Authorization: `Bearer ${nangoSecretKey}`,
                            "Connection-Id": connectionId,
                            "Provider-Config-Key": "notion",
                            "Notion-Version": NOTION_API_VERSION,
                        },
                    })
                    .json<{
                        results: Array<Record<string, unknown>>;
                    }>();
                blocks = blocksResponse.results;
            }

            return this.createJSONResponse({
                page,
                blocks,
            });
        } catch (error) {
            // Handle 404 errors gracefully
            if (error instanceof Error && error.message.includes("404")) {
                return this.createErrorResponse(
                    `Page '${page_id}' not found. This page ID may be incorrect, or the page may have been deleted or archived. ` +
                        `Please verify the page_id is correct by using the search tool to find the page.`
                );
            }
            throw error; // Re-throw unexpected errors
        }
    }

    private async handleCreatePage(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { parent, properties, children } = params as {
            parent: Record<string, string | boolean>;
            properties: Record<string, unknown>;
            children?: Array<Record<string, unknown>>;
        };

        // Validate and transform parent parameter
        if (!parent || typeof parent !== "object") {
            return this.createErrorResponse(
                "Parent parameter is required and must be an object with 'database_id' or 'page_id' property."
            );
        }

        // Check for workspace parent - not supported for internal integrations
        if ("workspace" in parent) {
            return this.createErrorResponse(
                "Cannot create top-level workspace/teamspace pages with internal integrations.\n\n" +
                    "Notion's API requires a parent page or database for internal integrations.\n\n" +
                    "To create a page in a teamspace:\n" +
                    "1. Search for an existing page in that teamspace\n" +
                    "2. Use that page as the parent:\n" +
                    '   parent: { page_id: "<existing-page-id>" }'
            );
        }

        if (!("database_id" in parent) && !("page_id" in parent)) {
            return this.createErrorResponse(
                "Parent parameter must have either 'database_id' or 'page_id' property."
            );
        }

        // Normalize the ID in the parent object
        const parentObject = { ...parent };
        if (
            "database_id" in parentObject &&
            typeof parentObject.database_id === "string"
        ) {
            parentObject.database_id = normalizeNotionId(parentObject.database_id);
        }
        if ("page_id" in parentObject && typeof parentObject.page_id === "string") {
            parentObject.page_id = normalizeNotionId(parentObject.page_id);
        }

        // Validate properties parameter
        if (!properties || typeof properties !== "object") {
            return this.createErrorResponse(
                "Properties parameter is required and must be an object."
            );
        }

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        logger.debug(
            {
                action: "create_page",
                parent: parentObject,
                hasProperties: !!properties,
                hasChildren: !!children,
            },
            "🔧 [NOTION] Creating page"
        );

        const requestBody: {
            parent: Record<string, string | boolean>;
            properties: Record<string, unknown>;
            children?: Array<Record<string, unknown>>;
        } = {
            parent: parentObject,
            properties,
        };

        if (children && children.length > 0) {
            requestBody.children = children;
        }

        const response = await httpClient
            .post(`${nangoUrl}/proxy/v1/pages`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: requestBody,
            })
            .json<{
                id: string;
                url: string;
                properties: Record<string, unknown>;
            }>();

        return this.createJSONResponse({
            success: true,
            page_id: response.id,
            url: response.url,
            properties: response.properties,
        });
    }

    private async handleUpdatePage(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { page_id, properties, archived } = params as {
            page_id: string;
            properties?: Record<string, unknown>;
            archived?: boolean;
        };

        // Normalize the page_id to ensure it has hyphens
        const normalizedPageId = normalizeNotionId(page_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const requestBody: {
            properties?: Record<string, unknown>;
            archived?: boolean;
        } = {};

        if (properties) {
            requestBody.properties = properties;
        }
        if (archived !== undefined) {
            requestBody.archived = archived;
        }

        const response = await httpClient
            .patch(`${nangoUrl}/proxy/v1/pages/${normalizedPageId}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: requestBody,
            })
            .json<{
                id: string;
                properties: Record<string, unknown>;
                archived: boolean;
            }>();

        return this.createJSONResponse({
            success: true,
            page_id: response.id,
            archived: response.archived,
            properties: response.properties,
        });
    }

    private async handleListDatabases(connectionId: string): Promise<MCPToolResponse> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .post(`${nangoUrl}/proxy/v1/search`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: {
                    filter: {
                        property: "object",
                        value: "database",
                    },
                    page_size: MAX_PAGE_SIZE,
                },
            })
            .json<{
                results: Array<{
                    id: string;
                    title?: Array<{ plain_text: string }>;
                    url: string;
                }>;
            }>();

        const databases = response.results.map((db) => ({
            id: db.id,
            title: db.title?.[0]?.plain_text || "Untitled Database",
            url: db.url,
        }));

        return this.createJSONResponse({
            totalCount: databases.length,
            databases,
        });
    }

    private async handleGetDatabase(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { database_id } = params as { database_id: string };

        // Normalize the database_id to ensure it has hyphens
        const normalizedDatabaseId = normalizeNotionId(database_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            const response = await httpClient
                .get(`${nangoUrl}/proxy/v1/databases/${normalizedDatabaseId}`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                    },
                })
                .json<{
                    id: string;
                    title?: Array<{ plain_text: string }>;
                    properties: Record<string, unknown>;
                    url: string;
                    created_time: string;
                    last_edited_time: string;
                }>();

            return this.createJSONResponse(response);
        } catch (error) {
            // Handle 404 errors gracefully
            if (error instanceof Error && error.message.includes("404")) {
                return this.createErrorResponse(
                    `Database '${database_id}' not found. This database ID may be incorrect, or the database may have been deleted or archived. ` +
                        `Please verify the database_id is correct by using list_databases or search to find the database.`
                );
            }
            throw error; // Re-throw unexpected errors
        }
    }

    private async handleCreateDatabase(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { parent, title, properties } = params as {
            parent: Record<string, string>;
            title: Array<Record<string, unknown>>;
            properties: Record<string, unknown>;
        };

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const requestBody = {
            parent,
            title,
            properties,
        };

        const response = await httpClient
            .post(`${nangoUrl}/proxy/v1/databases`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: requestBody,
            })
            .json<{
                id: string;
                url: string;
                title: Array<{ plain_text: string }>;
                properties: Record<string, unknown>;
            }>();

        return this.createJSONResponse({
            success: true,
            database_id: response.id,
            url: response.url,
            title: response.title?.[0]?.plain_text || "Untitled",
            properties: response.properties,
        });
    }

    private async handleUpdateDatabase(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { database_id, title, properties, icon, cover } = params as {
            database_id: string;
            title?: Array<Record<string, unknown>>;
            properties?: Record<string, unknown>;
            icon?: Record<string, unknown>;
            cover?: Record<string, unknown>;
        };

        // Validate that at least one update parameter is provided
        if (!title && !properties && !icon && !cover) {
            return this.createErrorResponse(
                "Must provide at least one parameter to update: title, properties, icon, or cover"
            );
        }

        // Normalize the database_id to ensure it has hyphens
        const normalizedDatabaseId = normalizeNotionId(database_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // Build request body with only provided parameters
        const requestBody: {
            title?: Array<Record<string, unknown>>;
            properties?: Record<string, unknown>;
            icon?: Record<string, unknown>;
            cover?: Record<string, unknown>;
        } = {};

        if (title) requestBody.title = title;
        if (properties) requestBody.properties = properties;
        if (icon) requestBody.icon = icon;
        if (cover) requestBody.cover = cover;

        try {
            const response = await httpClient
                .patch(`${nangoUrl}/proxy/v1/databases/${normalizedDatabaseId}`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                        "Content-Type": "application/json",
                    },
                    json: requestBody,
                })
                .json<{
                    id: string;
                    url: string;
                    title?: Array<{ plain_text: string }>;
                    properties: Record<string, unknown>;
                }>();

            return this.createJSONResponse({
                success: true,
                database_id: response.id,
                url: response.url,
                title: response.title?.[0]?.plain_text || "Untitled",
                properties: response.properties,
            });
        } catch (error) {
            // Handle 404 errors gracefully
            if (error instanceof Error && error.message.includes("404")) {
                return this.createErrorResponse(
                    `Database '${database_id}' not found. This database ID may be incorrect, or the database may have been deleted or archived. ` +
                        `Please verify the database_id is correct by using list_databases or search to find the database.`
                );
            }
            throw error; // Re-throw unexpected errors
        }
    }

    private async handleQueryDatabase(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            database_id,
            filter,
            sorts,
            page_size = 100,
        } = params as {
            database_id: string;
            filter?: Record<string, unknown>;
            sorts?: Array<Record<string, unknown>>;
            page_size?: number;
        };

        // Normalize the database_id to ensure it has hyphens
        const normalizedDatabaseId = normalizeNotionId(database_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const cappedPageSize = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);

        const requestBody: {
            filter?: Record<string, unknown>;
            sorts?: Array<Record<string, unknown>>;
            page_size: number;
        } = {
            page_size: cappedPageSize,
        };

        if (filter) {
            requestBody.filter = filter;
        }
        if (sorts) {
            requestBody.sorts = sorts;
        }

        try {
            // API Version 2025-09-03 Migration Notes:
            // The official docs describe a new /v1/data_sources/{id}/query endpoint where
            // databases act as containers for data sources. However, testing shows:
            //   ❌ POST /v1/data_sources/{id}/query → 400 Bad Request
            //   ❌ PATCH /v1/databases/{id}/query → 400 Bad Request
            //   ✅ POST /v1/databases/{id}/query → Works perfectly
            // The GET /v1/databases/{id} response also doesn't include the documented
            // `data_sources` array. This indicates the new endpoints aren't live yet,
            // likely due to staged rollout or Nango proxy not being updated.
            // TODO: Migrate to /v1/data_sources/{id}/query once it's actually available.
            const response = await httpClient
                .post(`${nangoUrl}/proxy/v1/databases/${normalizedDatabaseId}/query`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                        "Content-Type": "application/json",
                    },
                    json: requestBody,
                })
                .json<{
                    results: Array<Record<string, unknown>>;
                    has_more: boolean;
                    next_cursor: string | null;
                }>();

            return this.createJSONResponse({
                database_id,
                totalCount: response.results.length,
                has_more: response.has_more,
                results: response.results,
            });
        } catch (error) {
            // Handle 404 errors gracefully
            if (error instanceof Error && error.message.includes("404")) {
                return this.createErrorResponse(
                    `Database '${database_id}' not found. This database ID may be incorrect, or the database may have been deleted or archived. ` +
                        `Please verify the database_id is correct by using list_databases or search to find the database.`
                );
            }
            throw error; // Re-throw unexpected errors
        }
    }

    private async handleCreateDatabaseEntry(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { database_id, properties, children } = params as {
            database_id: string;
            properties: Record<string, unknown>;
            children?: Array<Record<string, unknown>>;
        };

        // Normalize the database_id to ensure it has hyphens
        const normalizedDatabaseId = normalizeNotionId(database_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const requestBody: {
            parent: { database_id: string };
            properties: Record<string, unknown>;
            children?: Array<Record<string, unknown>>;
        } = {
            parent: { database_id: normalizedDatabaseId },
            properties,
        };

        if (children && children.length > 0) {
            requestBody.children = children;
        }

        try {
            const response = await httpClient
                .post(`${nangoUrl}/proxy/v1/pages`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                        "Content-Type": "application/json",
                    },
                    json: requestBody,
                })
                .json<{
                    id: string;
                    url: string;
                    properties: Record<string, unknown>;
                }>();

            return this.createJSONResponse({
                success: true,
                entry_id: response.id,
                url: response.url,
                properties: response.properties,
            });
        } catch (error) {
            // Handle 400/404 errors gracefully
            if (error instanceof Error) {
                if (error.message.includes("400")) {
                    return this.createErrorResponse(
                        `Cannot create entry in database '${database_id}': The database ID may be incorrect, you may not have access, ` +
                            `or the properties don't match the database schema. Please verify the database_id using list_databases, and ` +
                            `check that the properties match the database's property definitions (use get_database to see the schema).`
                    );
                }
                if (error.message.includes("404")) {
                    return this.createErrorResponse(
                        `Database '${database_id}' not found. This database ID may be incorrect, or the database may have been deleted or archived. ` +
                            `Please verify the database_id is correct by using list_databases or search to find the database.`
                    );
                }
            }
            throw error; // Re-throw unexpected errors
        }
    }

    private async handleAppendBlocks(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { block_id, children } = params as {
            block_id: string;
            children: Array<Record<string, unknown>>;
        };

        // Normalize the block_id to ensure it has hyphens
        const normalizedBlockId = normalizeNotionId(block_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .patch(`${nangoUrl}/proxy/v1/blocks/${normalizedBlockId}/children`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: { children },
            })
            .json<{
                results: Array<Record<string, unknown>>;
            }>();

        return this.createJSONResponse({
            success: true,
            blocks_created: response.results.length,
            blocks: response.results,
        });
    }

    private async handleGetBlock(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { block_id } = params as { block_id: string };

        // Normalize the block_id to ensure it has hyphens
        const normalizedBlockId = normalizeNotionId(block_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(`${nangoUrl}/proxy/v1/blocks/${normalizedBlockId}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                },
            })
            .json<Record<string, unknown>>();

        return this.createJSONResponse(response);
    }

    private async handleUpdateBlock(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { block_id, block_type, content, archived } = params as {
            block_id: string;
            block_type?: string;
            content?: Record<string, unknown>;
            archived?: boolean;
        };

        // Normalize the block_id to ensure it has hyphens
        const normalizedBlockId = normalizeNotionId(block_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // Build request body based on what's being updated
        const requestBody: Record<string, unknown> = {};

        // If updating content, need both block_type and content
        if (block_type && content) {
            requestBody[block_type] = content;
        } else if (block_type || content) {
            return this.createErrorResponse(
                "To update block content, both 'block_type' and 'content' are required. " +
                    "Example: { block_type: 'paragraph', content: { rich_text: [...] } }"
            );
        }

        // Archive parameter is independent
        if (archived !== undefined) {
            requestBody.archived = archived;
        }

        // Must have at least one thing to update
        if (Object.keys(requestBody).length === 0) {
            return this.createErrorResponse(
                "Must provide either content (block_type + content) or archived parameter to update"
            );
        }

        try {
            const response = await httpClient
                .patch(`${nangoUrl}/proxy/v1/blocks/${normalizedBlockId}`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "notion",
                        "Notion-Version": NOTION_API_VERSION,
                        "Content-Type": "application/json",
                    },
                    json: requestBody,
                })
                .json<Record<string, unknown>>();

            return this.createJSONResponse({
                success: true,
                block: response,
            });
        } catch (error) {
            // Handle 404 errors gracefully
            if (error instanceof Error && error.message.includes("404")) {
                return this.createErrorResponse(
                    `Block '${block_id}' not found. The block may have been deleted or you may not have access to it.`
                );
            }
            throw error; // Re-throw unexpected errors
        }
    }

    private async handleGetChildBlocks(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            block_id,
            page_size = 100,
            start_cursor,
        } = params as {
            block_id: string;
            page_size?: number;
            start_cursor?: string;
        };

        // Normalize the block_id to ensure it has hyphens
        const normalizedBlockId = normalizeNotionId(block_id);

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // Cap page_size between 1 and MAX_PAGE_SIZE (100)
        const cappedPageSize = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);

        // Build URL with query parameters
        let url = `${nangoUrl}/proxy/v1/blocks/${normalizedBlockId}/children?page_size=${cappedPageSize}`;
        if (start_cursor) {
            url += `&start_cursor=${encodeURIComponent(start_cursor)}`;
        }

        const response = await httpClient
            .get(url, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                },
            })
            .json<{
                results: Array<Record<string, unknown>>;
                has_more: boolean;
                next_cursor: string | null;
            }>();

        return this.createJSONResponse({
            block_id,
            totalCount: response.results.length,
            has_more: response.has_more,
            next_cursor: response.next_cursor,
            blocks: response.results,
        });
    }

    private async handleCreateComment(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { page_id, rich_text } = params as {
            page_id: string;
            rich_text: Array<Record<string, unknown>>;
        };

        const normalizedPageId = normalizeNotionId(page_id);
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .post(`${nangoUrl}/proxy/v1/comments`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                    "Content-Type": "application/json",
                },
                json: {
                    parent: { page_id: normalizedPageId },
                    rich_text,
                },
            })
            .json<{
                id: string;
                created_time: string;
                rich_text: Array<Record<string, unknown>>;
            }>();

        return this.createJSONResponse({
            success: true,
            comment_id: response.id,
            created_time: response.created_time,
        });
    }

    private async handleListUsers(connectionId: string): Promise<MCPToolResponse> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        const response = await httpClient
            .get(`${nangoUrl}/proxy/v1/users`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "notion",
                    "Notion-Version": NOTION_API_VERSION,
                },
            })
            .json<{
                results: Array<{
                    id: string;
                    name?: string;
                    type: string;
                    person?: { email?: string };
                }>;
            }>();

        const users = response.results.map((user) => ({
            id: user.id,
            name: user.name || "Unknown",
            type: user.type,
            email: user.person?.email,
        }));

        return this.createJSONResponse({
            totalCount: users.length,
            users,
        });
    }

    /**
     * Execute a raw Notion API request
     * This provides an escape hatch for operations not covered by standard actions
     */
    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body } = params;

        // Validate parameters
        if (!endpoint || typeof endpoint !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'endpoint' parameter (string)"
            );
        }
        if (!method || typeof method !== "string") {
            return this.createErrorResponse(
                "raw_api requires 'method' parameter (GET, POST, PATCH, DELETE)"
            );
        }

        // Security: validate endpoint starts with /v1
        if (!endpoint.startsWith("/v1")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1'. " +
                    `Got: ${endpoint}. ` +
                    "Example: '/v1/pages/page-uuid'"
            );
        }

        // Normalize UUIDs in endpoint path
        // This handles endpoints like /v1/pages/{page_id}, /v1/databases/{database_id}, etc.
        // Notion API requires UUIDs with hyphens (8-4-4-4-12 format)
        const normalizedEndpoint = endpoint.replace(
            /\/([0-9a-f]{32})(?=\/|$)/gi,
            (match, uuid) => `/${normalizeNotionId(uuid)}`
        );

        // Get user credentials via connection manager
        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for Notion. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/notion`
                );
            }
            connectionId = credentials.connectionId;
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }

        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        // Build request options
        const requestOptions: {
            headers: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "notion",
                "Notion-Version": NOTION_API_VERSION,
            },
        };

        // Add body for POST/PATCH
        if (["POST", "PATCH"].includes(method.toUpperCase()) && body) {
            requestOptions.json = body;
            requestOptions.headers["Content-Type"] = "application/json";
        }

        try {
            const httpMethod = method.toLowerCase();
            const allowedMethods = ["get", "post", "patch", "delete"];

            if (!allowedMethods.includes(httpMethod)) {
                return this.createErrorResponse(
                    `Unsupported HTTP method: ${method}. Allowed methods: ${allowedMethods.join(", ").toUpperCase()}`
                );
            }

            const fullUrl = `${nangoUrl}/proxy${normalizedEndpoint}`;

            const response = await httpClient[
                httpMethod as "get" | "post" | "patch" | "delete"
            ](fullUrl, requestOptions).json<Record<string, unknown>>();

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError(
                `[NOTION ADAPTER] Raw API request failed for user ${userId}:`,
                {
                    endpoint,
                    method,
                    error: error instanceof Error ? error.message : String(error),
                }
            );

            // Capture error to Sentry for monitoring and alerting
            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            let errorMessage = `Raw API request failed: `;
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the Notion API documentation for the correct endpoint path: " +
                        "https://developers.notion.com/reference/intro";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                    errorMessage += `Authentication failed. Your Notion connection may have expired. Please reconnect at: ${appUrl}/integrations/notion`;
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }
}
