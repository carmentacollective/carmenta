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
 * - WORKS: database_id, page_id parents
 * - FAILS: data_source_id parent (returns 400 error)
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
 */

import { ServiceAdapter } from "./base";
import { getCredentials, nangoProxyRequest } from "../connection-manager";
import type { HelpResponse, AdapterResponse, RawAPIParams } from "../types";

// Constants for Notion API
const NOTION_API_VERSION = "2025-09-03";
const PROVIDER_CONFIG_KEY = "notion";
const MAX_PAGE_SIZE = 100;

/**
 * Normalizes a Notion UUID to the hyphenated format required by the Notion API.
 * Accepts both hyphenated and non-hyphenated UUIDs.
 */
function normalizeNotionId(id: string): string {
    if (id.includes("-")) {
        return id;
    }

    if (/^[0-9a-f]{32}$/i.test(id)) {
        return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
    }

    return id;
}

export class NotionAdapter extends ServiceAdapter {
    serviceName = "notion";
    serviceDisplayName = "Notion";

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
                    ],
                    returns: "Array of child blocks with pagination info",
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
                        "Direct access to the full Notion API for operations not covered above. " +
                        "Consult https://developers.notion.com/reference/intro for endpoint details.",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Notion API endpoint path (e.g., '/v1/pages', '/v1/databases')",
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
                            description: "Request body for POST/PATCH requests",
                        },
                    ],
                    returns: "Raw Notion API response as JSON",
                },
            ],
            docsUrl: "https://developers.notion.com/reference/intro",
        };
    }

    async execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<AdapterResponse> {
        // Validate action and params
        const validation = this.validate(action, params);
        if (!validation.valid) {
            this.logError("Validation failed", {
                action,
                errors: validation.errors,
            });
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's Notion connection
        let connectionId: string;
        try {
            const connectionCreds = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );

            if (connectionCreds.type !== "oauth" || !connectionCreds.connectionId) {
                return this.createErrorResponse(
                    "Invalid credentials type for Notion service. Expected OAuth connection."
                );
            }

            connectionId = connectionCreds.connectionId;
        } catch (error) {
            if (error instanceof Error && error.message.includes("No")) {
                return this.createErrorResponse(this.createNotConnectedError());
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
                case "query_database":
                    return await this.handleQueryDatabase(params, connectionId);
                case "create_database_entry":
                    return await this.handleCreateDatabaseEntry(params, connectionId);
                case "append_blocks":
                    return await this.handleAppendBlocks(params, connectionId);
                case "get_child_blocks":
                    return await this.handleGetChildBlocks(params, connectionId);
                case "list_users":
                    return await this.handleListUsers(connectionId);
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
            this.logError(`Failed to execute ${action}`, {
                error: error instanceof Error ? error.message : String(error),
                userId,
            });

            this.captureError(error, {
                action,
                params: params as Record<string, unknown>,
                userId,
            });

            return this.createErrorResponse(this.handleCommonAPIError(error, action));
        }
    }

    private async makeRequest<T>(
        connectionId: string,
        endpoint: string,
        options: {
            method?: "GET" | "POST" | "PATCH" | "DELETE";
            body?: Record<string, unknown>;
        } = {}
    ): Promise<T> {
        const response = await nangoProxyRequest(
            connectionId,
            PROVIDER_CONFIG_KEY,
            endpoint,
            {
                method: options.method,
                body: options.body,
                headers: {
                    "Notion-Version": NOTION_API_VERSION,
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Notion API error ${response.status}: ${errorText}`);
        }

        return response.json() as Promise<T>;
    }

    private async handleSearch(
        params: unknown,
        connectionId: string
    ): Promise<AdapterResponse> {
        const {
            query,
            filter,
            page_size = 25,
        } = params as {
            query: string;
            filter?: { property: string; value: string };
            page_size?: number;
        };

        const cappedPageSize = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);

        const requestBody: Record<string, unknown> = {
            query,
            page_size: cappedPageSize,
        };

        if (filter) {
            requestBody.filter = filter;
        }

        this.logInfo(`Searching Notion for: "${query}"`);

        const response = await this.makeRequest<{
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
        }>(connectionId, "/v1/search", {
            method: "POST",
            body: requestBody,
        });

        if (!response.results || response.results.length === 0) {
            return this.createJSONResponse({
                query,
                totalCount: 0,
                results: [],
            });
        }

        const formattedResults = response.results.map((result) => {
            let title = "Untitled";
            if (result.title && result.title.length > 0) {
                title = result.title[0].plain_text;
            } else if (result.properties) {
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
    ): Promise<AdapterResponse> {
        const { page_id, include_blocks = true } = params as {
            page_id: string;
            include_blocks?: boolean;
        };

        const normalizedPageId = normalizeNotionId(page_id);

        this.logInfo(`Getting page: ${normalizedPageId}`);

        const page = await this.makeRequest<{
            id: string;
            properties: Record<string, unknown>;
            url: string;
            created_time: string;
            last_edited_time: string;
        }>(connectionId, `/v1/pages/${normalizedPageId}`);

        let blocks: Array<Record<string, unknown>> = [];
        if (include_blocks !== false) {
            const blocksResponse = await this.makeRequest<{
                results: Array<Record<string, unknown>>;
            }>(connectionId, `/v1/blocks/${normalizedPageId}/children`);
            blocks = blocksResponse.results;
        }

        return this.createJSONResponse({
            page,
            blocks,
        });
    }

    private async handleCreatePage(
        params: unknown,
        connectionId: string
    ): Promise<AdapterResponse> {
        const { parent, properties, children } = params as {
            parent: Record<string, string | boolean>;
            properties: Record<string, unknown>;
            children?: Array<Record<string, unknown>>;
        };

        if (!parent || typeof parent !== "object") {
            return this.createErrorResponse(
                "Parent parameter is required and must be an object with 'database_id' or 'page_id' property."
            );
        }

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

        // Normalize IDs in parent
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

        if (!properties || typeof properties !== "object") {
            return this.createErrorResponse(
                "Properties parameter is required and must be an object."
            );
        }

        this.logInfo("Creating Notion page");

        const requestBody: Record<string, unknown> = {
            parent: parentObject,
            properties,
        };

        if (children && children.length > 0) {
            requestBody.children = children;
        }

        const response = await this.makeRequest<{
            id: string;
            url: string;
            properties: Record<string, unknown>;
        }>(connectionId, "/v1/pages", {
            method: "POST",
            body: requestBody,
        });

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
    ): Promise<AdapterResponse> {
        const { page_id, properties, archived } = params as {
            page_id: string;
            properties?: Record<string, unknown>;
            archived?: boolean;
        };

        const normalizedPageId = normalizeNotionId(page_id);

        const requestBody: Record<string, unknown> = {};
        if (properties) {
            requestBody.properties = properties;
        }
        if (archived !== undefined) {
            requestBody.archived = archived;
        }

        this.logInfo(`Updating page: ${normalizedPageId}`);

        const response = await this.makeRequest<{
            id: string;
            properties: Record<string, unknown>;
            archived: boolean;
        }>(connectionId, `/v1/pages/${normalizedPageId}`, {
            method: "PATCH",
            body: requestBody,
        });

        return this.createJSONResponse({
            success: true,
            page_id: response.id,
            archived: response.archived,
            properties: response.properties,
        });
    }

    private async handleListDatabases(connectionId: string): Promise<AdapterResponse> {
        this.logInfo("Listing Notion databases");

        const response = await this.makeRequest<{
            results: Array<{
                id: string;
                title?: Array<{ plain_text: string }>;
                url: string;
            }>;
        }>(connectionId, "/v1/search", {
            method: "POST",
            body: {
                filter: {
                    property: "object",
                    value: "database",
                },
                page_size: MAX_PAGE_SIZE,
            },
        });

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
    ): Promise<AdapterResponse> {
        const { database_id } = params as { database_id: string };
        const normalizedDatabaseId = normalizeNotionId(database_id);

        this.logInfo(`Getting database: ${normalizedDatabaseId}`);

        const response = await this.makeRequest<{
            id: string;
            title?: Array<{ plain_text: string }>;
            properties: Record<string, unknown>;
            url: string;
            created_time: string;
            last_edited_time: string;
        }>(connectionId, `/v1/databases/${normalizedDatabaseId}`);

        return this.createJSONResponse(response);
    }

    private async handleQueryDatabase(
        params: unknown,
        connectionId: string
    ): Promise<AdapterResponse> {
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

        const normalizedDatabaseId = normalizeNotionId(database_id);
        const cappedPageSize = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);

        const requestBody: Record<string, unknown> = {
            page_size: cappedPageSize,
        };

        if (filter) {
            requestBody.filter = filter;
        }
        if (sorts) {
            requestBody.sorts = sorts;
        }

        this.logInfo(`Querying database: ${normalizedDatabaseId}`);

        const response = await this.makeRequest<{
            results: Array<Record<string, unknown>>;
            has_more: boolean;
            next_cursor: string | null;
        }>(connectionId, `/v1/databases/${normalizedDatabaseId}/query`, {
            method: "POST",
            body: requestBody,
        });

        return this.createJSONResponse({
            database_id,
            totalCount: response.results.length,
            has_more: response.has_more,
            results: response.results,
        });
    }

    private async handleCreateDatabaseEntry(
        params: unknown,
        connectionId: string
    ): Promise<AdapterResponse> {
        const { database_id, properties, children } = params as {
            database_id: string;
            properties: Record<string, unknown>;
            children?: Array<Record<string, unknown>>;
        };

        const normalizedDatabaseId = normalizeNotionId(database_id);

        const requestBody: Record<string, unknown> = {
            parent: { database_id: normalizedDatabaseId },
            properties,
        };

        if (children && children.length > 0) {
            requestBody.children = children;
        }

        this.logInfo(`Creating entry in database: ${normalizedDatabaseId}`);

        const response = await this.makeRequest<{
            id: string;
            url: string;
            properties: Record<string, unknown>;
        }>(connectionId, "/v1/pages", {
            method: "POST",
            body: requestBody,
        });

        return this.createJSONResponse({
            success: true,
            entry_id: response.id,
            url: response.url,
            properties: response.properties,
        });
    }

    private async handleAppendBlocks(
        params: unknown,
        connectionId: string
    ): Promise<AdapterResponse> {
        const { block_id, children } = params as {
            block_id: string;
            children: Array<Record<string, unknown>>;
        };

        const normalizedBlockId = normalizeNotionId(block_id);

        this.logInfo(`Appending blocks to: ${normalizedBlockId}`);

        const response = await this.makeRequest<{
            results: Array<Record<string, unknown>>;
        }>(connectionId, `/v1/blocks/${normalizedBlockId}/children`, {
            method: "PATCH",
            body: { children },
        });

        return this.createJSONResponse({
            success: true,
            blocks_created: response.results.length,
            blocks: response.results,
        });
    }

    private async handleGetChildBlocks(
        params: unknown,
        connectionId: string
    ): Promise<AdapterResponse> {
        const { block_id, page_size = 100 } = params as {
            block_id: string;
            page_size?: number;
        };

        const normalizedBlockId = normalizeNotionId(block_id);
        const cappedPageSize = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);

        this.logInfo(`Getting child blocks of: ${normalizedBlockId}`);

        const response = await this.makeRequest<{
            results: Array<Record<string, unknown>>;
            has_more: boolean;
            next_cursor: string | null;
        }>(
            connectionId,
            `/v1/blocks/${normalizedBlockId}/children?page_size=${cappedPageSize}`
        );

        return this.createJSONResponse({
            block_id,
            totalCount: response.results.length,
            has_more: response.has_more,
            next_cursor: response.next_cursor,
            blocks: response.results,
        });
    }

    private async handleListUsers(connectionId: string): Promise<AdapterResponse> {
        this.logInfo("Listing Notion users");

        const response = await this.makeRequest<{
            results: Array<{
                id: string;
                name?: string;
                type: string;
                person?: { email?: string };
            }>;
        }>(connectionId, "/v1/users");

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

    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<AdapterResponse> {
        const { endpoint, method, body } = params;

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

        if (!endpoint.startsWith("/v1")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/v1'. " +
                    `Got: ${endpoint}. ` +
                    "Example: '/v1/pages/page-uuid'"
            );
        }

        // Normalize UUIDs in endpoint path
        const normalizedEndpoint = endpoint.replace(
            /\/([0-9a-f]{32})(?=\/|$)/gi,
            (_, uuid) => `/${normalizeNotionId(uuid)}`
        );

        // Get connection
        let connectionId: string;
        try {
            const connectionCreds = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );

            if (connectionCreds.type !== "oauth" || !connectionCreds.connectionId) {
                return this.createErrorResponse("Invalid credentials");
            }

            connectionId = connectionCreds.connectionId;
        } catch (error) {
            if (error instanceof Error && error.message.includes("No")) {
                return this.createErrorResponse(this.createNotConnectedError());
            }
            throw error;
        }

        const allowedMethods = ["GET", "POST", "PATCH", "DELETE"];
        const upperMethod = method.toUpperCase();

        if (!allowedMethods.includes(upperMethod)) {
            return this.createErrorResponse(
                `Unsupported HTTP method: ${method}. Allowed methods: ${allowedMethods.join(", ")}`
            );
        }

        this.logInfo(`Raw API call: ${upperMethod} ${normalizedEndpoint}`);

        try {
            const response = await this.makeRequest<Record<string, unknown>>(
                connectionId,
                normalizedEndpoint,
                {
                    method: upperMethod as "GET" | "POST" | "PATCH" | "DELETE",
                    body: body as Record<string, unknown>,
                }
            );

            return this.createJSONResponse(response);
        } catch (error) {
            this.logError("Raw API request failed", {
                endpoint,
                method,
                error: error instanceof Error ? error.message : String(error),
            });

            this.captureError(error, {
                action: "raw_api",
                params: { endpoint, method },
                userId,
            });

            let errorMessage = "Raw API request failed: ";
            if (error instanceof Error) {
                if (error.message.includes("404")) {
                    errorMessage +=
                        "Endpoint not found. Check the Notion API documentation: " +
                        "https://developers.notion.com/reference/intro";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage += `Authentication failed. ${this.createNotConnectedError()}`;
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
