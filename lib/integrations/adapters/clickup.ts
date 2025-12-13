/**
 * ClickUp Service Adapter
 *
 * Task management via ClickUp API through Nango proxy.
 *
 * ## Hierarchy Navigation
 * Team → Space → (optional Folder) → List → Task. You MUST have a list_id to create
 * tasks. Operations cascade: get team_id first, then space_id, then list_id.
 *
 * ## Code-Relevant Gotchas
 * - Priority is inverted: 1=Urgent, 4=Low, null=None (code sorts ascending)
 * - Custom field dropdown values require option UUIDs, not display names
 * - Statuses are case-sensitive and list-specific (no universal status enum)
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { httpClient } from "@/lib/http-client";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Get and validate Nango secret key */
function getNangoSecretKey(): string {
    if (!env.NANGO_SECRET_KEY) {
        throw new Error("Missing required environment variable: NANGO_SECRET_KEY");
    }
    return env.NANGO_SECRET_KEY;
}

export class ClickUpAdapter extends ServiceAdapter {
    serviceName = "clickup";
    serviceDisplayName = "ClickUp";

    private getNangoUrl(): string {
        if (!env.NANGO_API_URL) {
            throw new Error("Missing required environment variable: NANGO_API_URL");
        }
        return env.NANGO_API_URL;
    }

    /**
     * Fetch the ClickUp account information
     * Used to populate accountIdentifier and accountDisplayName after OAuth
     *
     * @param connectionId - Nango connection ID (required for OAuth webhook flow)
     * @param userId - User ID (optional, only used for logging)
     */
    async fetchAccountInfo(
        connectionId: string,
        userId?: string
    ): Promise<{
        identifier: string;
        displayName: string;
    }> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            const response = await httpClient
                .get(`${nangoUrl}/proxy/api/v2/user`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "clickup",
                    },
                })
                .json<{
                    user: {
                        id: number;
                        username: string;
                        email: string;
                    };
                }>();

            return {
                identifier: response.user.email,
                displayName: response.user.username || response.user.email,
            };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "📋 Failed to fetch ClickUp account info"
            );
            throw new ValidationError("Failed to fetch ClickUp account information");
        }
    }

    /**
     * Test the OAuth connection by making a live API request
     * Called when user clicks "Test" button to verify credentials are working
     *
     * @param connectionId - Nango connection ID
     * @param userId - User ID (optional, only used for logging)
     */
    async testConnection(
        connectionId: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        const nangoUrl = this.getNangoUrl();
        const nangoSecretKey = getNangoSecretKey();

        try {
            // Make the same request as fetchAccountInfo to verify connection
            await httpClient
                .get(`${nangoUrl}/proxy/api/v2/user`, {
                    headers: {
                        Authorization: `Bearer ${nangoSecretKey}`,
                        "Connection-Id": connectionId,
                        "Provider-Config-Key": "clickup",
                    },
                })
                .json<Record<string, unknown>>();

            return { success: true };
        } catch (error) {
            logger.error(
                { error, userId, connectionId },
                "Failed to verify ClickUp connection"
            );
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
            commonOperations: ["list_tasks", "create_task", "update_task"],
            operations: [
                {
                    name: "list_teams",
                    description: "Get all teams (workspaces) the user has access to",
                    parameters: [],
                    returns: "List of teams with their IDs and names",
                    example: `list_teams()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_spaces",
                    description: "Get all spaces within a team",
                    parameters: [
                        {
                            name: "team_id",
                            type: "string",
                            required: true,
                            description: "Team ID to get spaces from",
                        },
                    ],
                    returns: "List of spaces in the team",
                    example: `list_spaces({ team_id: "123" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_lists",
                    description: "Get lists in a space (folderless) or in a folder",
                    parameters: [
                        {
                            name: "space_id",
                            type: "string",
                            required: false,
                            description: "Space ID to get folderless lists from",
                        },
                        {
                            name: "folder_id",
                            type: "string",
                            required: false,
                            description: "Folder ID to get lists from",
                        },
                    ],
                    returns: "List of lists (one of space_id or folder_id is required)",
                    example: `list_lists({ space_id: "456" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_tasks",
                    description:
                        "Get tasks with filters. Can filter by list, team, or various task properties",
                    parameters: [
                        {
                            name: "list_id",
                            type: "string",
                            required: false,
                            description: "List ID to get tasks from",
                        },
                        {
                            name: "team_id",
                            type: "string",
                            required: false,
                            description:
                                "Team ID to get tasks from (requires additional filters)",
                        },
                        {
                            name: "archived",
                            type: "boolean",
                            required: false,
                            description: "Include archived tasks",
                        },
                        {
                            name: "page",
                            type: "number",
                            required: false,
                            description: "Page number for pagination (default: 0)",
                        },
                        {
                            name: "order_by",
                            type: "string",
                            required: false,
                            description:
                                "Field to order by (id, created, updated, due_date, priority)",
                        },
                        {
                            name: "reverse",
                            type: "boolean",
                            required: false,
                            description: "Reverse sort order",
                        },
                        {
                            name: "subtasks",
                            type: "boolean",
                            required: false,
                            description: "Include subtasks",
                        },
                        {
                            name: "statuses",
                            type: "array",
                            required: false,
                            description: "Filter by status names",
                            example: '["Open", "In Progress"]',
                        },
                        {
                            name: "include_closed",
                            type: "boolean",
                            required: false,
                            description: "Include closed tasks",
                        },
                        {
                            name: "assignees",
                            type: "array",
                            required: false,
                            description:
                                "Filter by assignee user IDs (numeric IDs, not usernames)",
                            example: "[123, 456]",
                        },
                        {
                            name: "due_date_gt",
                            type: "number",
                            required: false,
                            description: "Due date greater than (Unix timestamp in ms)",
                        },
                        {
                            name: "due_date_lt",
                            type: "number",
                            required: false,
                            description: "Due date less than (Unix timestamp in ms)",
                        },
                        {
                            name: "date_created_gt",
                            type: "number",
                            required: false,
                            description:
                                "Created date greater than (Unix timestamp in ms)",
                        },
                        {
                            name: "date_created_lt",
                            type: "number",
                            required: false,
                            description:
                                "Created date less than (Unix timestamp in ms)",
                        },
                        {
                            name: "date_updated_gt",
                            type: "number",
                            required: false,
                            description:
                                "Updated date greater than (Unix timestamp in ms)",
                        },
                        {
                            name: "date_updated_lt",
                            type: "number",
                            required: false,
                            description:
                                "Updated date less than (Unix timestamp in ms)",
                        },
                    ],
                    returns: "List of tasks matching the filters",
                    example: `list_tasks({ list_id: "789", statuses: ["Open"], include_closed: false })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_task",
                    description: "Get detailed information about a specific task",
                    parameters: [
                        {
                            name: "task_id",
                            type: "string",
                            required: true,
                            description: "Task ID",
                        },
                    ],
                    returns:
                        "Detailed task information including description, status, assignees, custom fields",
                    example: `get_task({ task_id: "abc123" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "create_task",
                    description: "Create a new task in a list",
                    parameters: [
                        {
                            name: "list_id",
                            type: "string",
                            required: true,
                            description: "List ID where the task will be created",
                        },
                        {
                            name: "name",
                            type: "string",
                            required: true,
                            description: "Task name/title",
                        },
                        {
                            name: "description",
                            type: "string",
                            required: false,
                            description: "Task description (supports markdown)",
                        },
                        {
                            name: "assignees",
                            type: "array",
                            required: false,
                            description: "Array of user IDs to assign",
                            example: '["123", "456"]',
                        },
                        {
                            name: "status",
                            type: "string",
                            required: false,
                            description: "Status name (must exist in list)",
                        },
                        {
                            name: "priority",
                            type: "number",
                            required: false,
                            description: "Priority (1=urgent, 2=high, 3=normal, 4=low)",
                            example: "2",
                        },
                        {
                            name: "due_date",
                            type: "number",
                            required: false,
                            description: "Due date (Unix timestamp in ms)",
                        },
                        {
                            name: "start_date",
                            type: "number",
                            required: false,
                            description: "Start date (Unix timestamp in ms)",
                        },
                        {
                            name: "tags",
                            type: "array",
                            required: false,
                            description: "Array of tag names",
                            example: '["bug", "urgent"]',
                        },
                    ],
                    returns: "Created task details including task ID",
                    example: `create_task({ list_id: "789", name: "Fix login bug", priority: 1, tags: ["bug"] })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "update_task",
                    description: "Update an existing task",
                    parameters: [
                        {
                            name: "task_id",
                            type: "string",
                            required: true,
                            description: "Task ID to update",
                        },
                        {
                            name: "name",
                            type: "string",
                            required: false,
                            description: "New task name",
                        },
                        {
                            name: "description",
                            type: "string",
                            required: false,
                            description: "New task description",
                        },
                        {
                            name: "status",
                            type: "string",
                            required: false,
                            description: "New status name",
                        },
                        {
                            name: "priority",
                            type: "number",
                            required: false,
                            description: "New priority (1-4)",
                        },
                        {
                            name: "assignees",
                            type: "object",
                            required: false,
                            description: "Assignees to add or remove",
                            example: '{"add": ["123"], "rem": ["456"]}',
                        },
                        {
                            name: "due_date",
                            type: "number",
                            required: false,
                            description:
                                "New due date (Unix timestamp in ms, or null to clear)",
                        },
                    ],
                    returns: "Updated task details",
                    example: `update_task({ task_id: "abc123", status: "Complete", priority: 3 })`,
                    annotations: {
                        readOnlyHint: false,
                        destructiveHint: false,
                        idempotentHint: true,
                    },
                },
                {
                    name: "delete_task",
                    description: "Delete a task permanently",
                    parameters: [
                        {
                            name: "task_id",
                            type: "string",
                            required: true,
                            description: "Task ID to delete",
                        },
                    ],
                    returns: "Confirmation of deletion",
                    example: `delete_task({ task_id: "abc123" })`,
                    annotations: { readOnlyHint: false, destructiveHint: true },
                },
                {
                    name: "create_comment",
                    description: "Add a comment to a task",
                    parameters: [
                        {
                            name: "task_id",
                            type: "string",
                            required: true,
                            description: "Task ID to comment on",
                        },
                        {
                            name: "comment_text",
                            type: "string",
                            required: true,
                            description: "Comment text (supports markdown)",
                        },
                        {
                            name: "notify_all",
                            type: "boolean",
                            required: false,
                            description: "Notify all task members",
                        },
                    ],
                    returns: "Created comment details",
                    example: `create_comment({ task_id: "abc123", comment_text: "Updated requirements", notify_all: true })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "list_comments",
                    description: "Get all comments on a task",
                    parameters: [
                        {
                            name: "task_id",
                            type: "string",
                            required: true,
                            description: "Task ID to get comments for",
                        },
                    ],
                    returns: "List of comments with author and timestamp",
                    example: `list_comments({ task_id: "abc123" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_time_entries",
                    description: "Get time tracking entries for a task",
                    parameters: [
                        {
                            name: "task_id",
                            type: "string",
                            required: true,
                            description: "Task ID to get time entries for",
                        },
                    ],
                    returns: "List of time tracking entries",
                    example: `list_time_entries({ task_id: "abc123" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full ClickUp API - you can perform nearly any operation supported by ClickUp. " +
                        "If you're familiar with the ClickUp API structure, construct the request directly. " +
                        "If unsure/errors: try context7 (/websites/developer_clickup) or https://clickup.com/api",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "ClickUp API endpoint path (e.g., '/api/v2/team', '/api/v2/space', '/api/v2/task')",
                            example: "/api/v2/team",
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
                                "for example, creating a task requires name and list_id fields. " +
                                "Use the ClickUp API structure you're familiar with, or consult the documentation if needed.",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw ClickUp API response as JSON",
                    example: `raw_api({ endpoint: "/api/v2/team", method: "GET" })`,
                },
            ],
            docsUrl: "https://clickup.com/api",
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
                `📋 [CLICKUP ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get user's ClickUp credentials via connection manager
        let connectionId: string;
        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.connectionId) {
                return this.createErrorResponse(
                    `No connection ID found for ClickUp. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/clickup`
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
                case "list_teams":
                    return await this.handleListTeams(connectionId);
                case "list_spaces":
                    return await this.handleListSpaces(params, connectionId);
                case "list_lists":
                    return await this.handleListLists(params, connectionId);
                case "list_tasks":
                    return await this.handleListTasks(params, connectionId);
                case "get_task":
                    return await this.handleGetTask(params, connectionId);
                case "create_task":
                    return await this.handleCreateTask(params, connectionId);
                case "update_task":
                    return await this.handleUpdateTask(params, connectionId);
                case "delete_task":
                    return await this.handleDeleteTask(params, connectionId);
                case "create_comment":
                    return await this.handleCreateComment(params, connectionId);
                case "list_comments":
                    return await this.handleListComments(params, connectionId);
                case "list_time_entries":
                    return await this.handleListTimeEntries(params, connectionId);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    this.logError(
                        `📋 [CLICKUP ADAPTER] Unknown action '${action}' requested by user ${userId}`
                    );
                    return this.createErrorResponse(
                        `Unknown action: ${action}. Use action='describe' to see available operations.`
                    );
            }
        } catch (error) {
            // Comprehensive error logging
            this.logError(
                `📋 [CLICKUP ADAPTER] Failed to execute ${action} for user ${userId}:`,
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
                        "The requested resource was not found. Please check the ID and try again.";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage +=
                        "Authentication failed. Your ClickUp connection may have expired. Please reconnect at: " +
                        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/clickup`;
                } else if (error.message.includes("429")) {
                    errorMessage +=
                        "Rate limit exceeded. Please try again in a few moments.";
                } else if (
                    error.message.includes("500") ||
                    error.message.includes("503")
                ) {
                    errorMessage +=
                        "ClickUp service is temporarily unavailable. Please try again later.";
                } else {
                    errorMessage += error.message;
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }

    private async handleListTeams(connectionId: string): Promise<MCPToolResponse> {
        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/api/v2/team`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
            })
            .json<{
                teams: Array<{
                    id: string;
                    name: string;
                    color: string;
                    avatar?: string;
                }>;
            }>();

        return this.createJSONResponse({
            teams: response.teams.map((team) => ({
                id: team.id,
                name: team.name,
                color: team.color,
            })),
        });
    }

    private async handleListSpaces(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { team_id } = params as { team_id: string };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/api/v2/team/${team_id}/space`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
                searchParams: {
                    archived: "false",
                },
            })
            .json<{
                spaces: Array<{
                    id: string;
                    name: string;
                    private: boolean;
                    statuses: Array<{ status: string; type: string; color: string }>;
                }>;
            }>();

        return this.createJSONResponse({
            spaces: response.spaces.map((space) => ({
                id: space.id,
                name: space.name,
                private: space.private,
            })),
        });
    }

    private async handleListLists(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { space_id, folder_id } = params as {
            space_id?: string;
            folder_id?: string;
        };

        if (!space_id && !folder_id) {
            throw new ValidationError(
                "Either space_id or folder_id is required for list_lists"
            );
        }

        const endpoint = folder_id
            ? `/proxy/api/v2/folder/${folder_id}/list`
            : `/proxy/api/v2/space/${space_id}/list`;

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}${endpoint}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
                searchParams: {
                    archived: "false",
                },
            })
            .json<{
                lists: Array<{
                    id: string;
                    name: string;
                    orderindex: number;
                    content: string;
                }>;
            }>();

        return this.createJSONResponse({
            lists: response.lists.map((list) => ({
                id: list.id,
                name: list.name,
            })),
        });
    }

    private async handleListTasks(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            list_id,
            team_id,
            archived,
            page,
            order_by,
            reverse,
            subtasks,
            statuses,
            include_closed,
            assignees,
            due_date_gt,
            due_date_lt,
            date_created_gt,
            date_created_lt,
            date_updated_gt,
            date_updated_lt,
        } = params as {
            list_id?: string;
            team_id?: string;
            archived?: boolean;
            page?: number;
            order_by?: string;
            reverse?: boolean;
            subtasks?: boolean;
            statuses?: string[];
            include_closed?: boolean;
            assignees?: string[];
            due_date_gt?: number;
            due_date_lt?: number;
            date_created_gt?: number;
            date_created_lt?: number;
            date_updated_gt?: number;
            date_updated_lt?: number;
        };

        if (!list_id && !team_id) {
            throw new ValidationError(
                "Either list_id or team_id is required for list_tasks"
            );
        }

        const endpoint = list_id
            ? `/proxy/api/v2/list/${list_id}/task`
            : `/proxy/api/v2/team/${team_id}/task`;

        // Build query parameters
        const searchParams = new URLSearchParams();
        if (archived !== undefined) searchParams.set("archived", String(archived));
        if (page !== undefined) searchParams.set("page", String(page));
        if (order_by) searchParams.set("order_by", order_by);
        if (reverse !== undefined) searchParams.set("reverse", String(reverse));
        if (subtasks !== undefined) searchParams.set("subtasks", String(subtasks));
        if (statuses && statuses.length > 0) {
            statuses.forEach((status) => searchParams.append("statuses[]", status));
        }
        if (include_closed !== undefined)
            searchParams.set("include_closed", String(include_closed));
        if (assignees && assignees.length > 0) {
            assignees.forEach((assignee) =>
                searchParams.append("assignees[]", assignee)
            );
        }
        if (due_date_gt) searchParams.set("due_date_gt", String(due_date_gt));
        if (due_date_lt) searchParams.set("due_date_lt", String(due_date_lt));
        if (date_created_gt)
            searchParams.set("date_created_gt", String(date_created_gt));
        if (date_created_lt)
            searchParams.set("date_created_lt", String(date_created_lt));
        if (date_updated_gt)
            searchParams.set("date_updated_gt", String(date_updated_gt));
        if (date_updated_lt)
            searchParams.set("date_updated_lt", String(date_updated_lt));

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}${endpoint}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
                searchParams,
            })
            .json<{
                tasks: Array<{
                    id: string;
                    name: string;
                    status: { status: string };
                    description?: string;
                    assignees: Array<{ id: number; username: string }>;
                    priority?: { priority: string };
                    due_date?: string;
                    url: string;
                }>;
            }>();

        return this.createJSONResponse({
            tasks: response.tasks.map((task) => ({
                id: task.id,
                name: task.name,
                status: task.status.status,
                assignees: task.assignees.map((a) => a.username),
                priority: task.priority?.priority,
                due_date: task.due_date,
                url: task.url,
            })),
        });
    }

    private async handleGetTask(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { task_id } = params as { task_id: string };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/api/v2/task/${task_id}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
            })
            .json<{
                id: string;
                name: string;
                description: string;
                status: { status: string };
                assignees: Array<{ id: number; username: string; email: string }>;
                priority?: { id: string; priority: string };
                due_date?: string;
                start_date?: string;
                tags: Array<{ name: string }>;
                url: string;
                custom_fields?: Array<{
                    id: string;
                    name: string;
                    value: unknown;
                }>;
            }>();

        return this.createJSONResponse({
            id: response.id,
            name: response.name,
            description: response.description,
            status: response.status.status,
            assignees: response.assignees.map((a) => ({
                username: a.username,
                email: a.email,
            })),
            priority: response.priority?.priority,
            due_date: response.due_date,
            start_date: response.start_date,
            tags: response.tags.map((t) => t.name),
            url: response.url,
            custom_fields: response.custom_fields,
        });
    }

    private async handleCreateTask(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const {
            list_id,
            name,
            description,
            assignees,
            status,
            priority,
            due_date,
            start_date,
            tags,
        } = params as {
            list_id: string;
            name: string;
            description?: string;
            assignees?: string[];
            status?: string;
            priority?: number;
            due_date?: number;
            start_date?: number;
            tags?: string[];
        };

        // Build request body
        const body: Record<string, unknown> = {
            name,
        };
        if (description) body.description = description;
        if (assignees) body.assignees = assignees;
        if (status) body.status = status;
        if (priority) body.priority = priority;
        if (due_date) body.due_date = due_date;
        if (start_date) body.start_date = start_date;
        if (tags) body.tags = tags;

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .post(`${this.getNangoUrl()}/proxy/api/v2/list/${list_id}/task`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                    "Content-Type": "application/json",
                },
                json: body,
            })
            .json<{
                id: string;
                name: string;
                status: { status: string };
                url: string;
            }>();

        return this.createJSONResponse({
            success: true,
            task_id: response.id,
            name: response.name,
            status: response.status.status,
            url: response.url,
        });
    }

    private async handleUpdateTask(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { task_id, name, description, status, priority, assignees, due_date } =
            params as {
                task_id: string;
                name?: string;
                description?: string;
                status?: string;
                priority?: number;
                assignees?: { add?: string[]; rem?: string[] };
                due_date?: number | null;
            };

        // Build request body
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (status !== undefined) body.status = status;
        if (priority !== undefined) body.priority = priority;
        if (assignees !== undefined) body.assignees = assignees;
        if (due_date !== undefined) body.due_date = due_date;

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .put(`${this.getNangoUrl()}/proxy/api/v2/task/${task_id}`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                    "Content-Type": "application/json",
                },
                json: body,
            })
            .json<{
                id: string;
                name: string;
                status: { status: string };
            }>();

        return this.createJSONResponse({
            success: true,
            task_id: response.id,
            name: response.name,
            status: response.status.status,
        });
    }

    private async handleDeleteTask(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { task_id } = params as { task_id: string };

        const nangoSecretKey = getNangoSecretKey();
        await httpClient.delete(`${this.getNangoUrl()}/proxy/api/v2/task/${task_id}`, {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "clickup",
            },
        });

        return this.createJSONResponse({
            success: true,
            message: `Task ${task_id} deleted successfully`,
        });
    }

    private async handleCreateComment(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { task_id, comment_text, notify_all } = params as {
            task_id: string;
            comment_text: string;
            notify_all?: boolean;
        };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .post(`${this.getNangoUrl()}/proxy/api/v2/task/${task_id}/comment`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                    "Content-Type": "application/json",
                },
                json: {
                    comment_text,
                    notify_all: notify_all ?? false,
                },
            })
            .json<{
                id: number | string;
                hist_id?: string;
                date: number;
            }>();

        return this.createJSONResponse({
            success: true,
            comment_id: String(response.id),
            date: String(response.date),
        });
    }

    private async handleListComments(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { task_id } = params as { task_id: string };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/api/v2/task/${task_id}/comment`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
            })
            .json<{
                comments: Array<{
                    id: string;
                    comment: Array<{ text: string }>;
                    user: { username: string };
                    date: string;
                }>;
            }>();

        return this.createJSONResponse({
            comments: response.comments.map((c) => ({
                id: c.id,
                text: c.comment.map((ct) => ct.text).join("\n"),
                author: c.user.username,
                date: c.date,
            })),
        });
    }

    private async handleListTimeEntries(
        params: unknown,
        connectionId: string
    ): Promise<MCPToolResponse> {
        const { task_id } = params as { task_id: string };

        const nangoSecretKey = getNangoSecretKey();
        const response = await httpClient
            .get(`${this.getNangoUrl()}/proxy/api/v2/task/${task_id}/time`, {
                headers: {
                    Authorization: `Bearer ${nangoSecretKey}`,
                    "Connection-Id": connectionId,
                    "Provider-Config-Key": "clickup",
                },
            })
            .json<{
                data: Array<{
                    id: string;
                    user: { username: string };
                    duration: number;
                    start: string;
                    end?: string;
                    description?: string;
                }>;
            }>();

        return this.createJSONResponse({
            time_entries: response.data.map((entry) => ({
                id: entry.id,
                user: entry.user.username,
                duration_ms: entry.duration,
                start: entry.start,
                end: entry.end,
                description: entry.description,
            })),
        });
    }

    /**
     * Execute a raw ClickUp API request
     * This provides an escape hatch for operations not covered by standard actions
     */
    async executeRawAPI(
        params: RawAPIParams,
        userId: string,
        accountId?: string
    ): Promise<MCPToolResponse> {
        const { endpoint, method, body, query } = params;

        // Validate parameters
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

        // Security: validate endpoint starts with /api/v2
        if (!endpoint.startsWith("/api/v2")) {
            return this.createErrorResponse(
                "Invalid endpoint: must start with '/api/v2'. " +
                    `Got: ${endpoint}. ` +
                    "Example: '/api/v2/team'"
            );
        }

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
                    `No connection ID found for ClickUp. Please reconnect at: ` +
                        `${env.NEXT_PUBLIC_APP_URL}/integrations/clickup`
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
            searchParams?: Record<string, string>;
            json?: Record<string, unknown>;
        } = {
            headers: {
                Authorization: `Bearer ${nangoSecretKey}`,
                "Connection-Id": connectionId,
                "Provider-Config-Key": "clickup",
            },
        };

        // Add query parameters if provided
        if (query && typeof query === "object") {
            requestOptions.searchParams = Object.fromEntries(
                Object.entries(query).map(([k, v]) => [k, String(v)])
            );
        }

        // Add body for POST/PUT/PATCH
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
            const fullUrl = `${nangoUrl}/proxy${endpoint}`;

            const response = await httpClient[httpMethod](fullUrl, requestOptions).json<
                Record<string, unknown>
            >();

            return this.createJSONResponse(response);
        } catch (error) {
            logger.error(
                {
                    endpoint,
                    method,
                    userId,
                    error: error instanceof Error ? error.message : String(error),
                },
                "📋 [CLICKUP ADAPTER] Raw API request failed"
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
                        "Endpoint not found. Check the ClickUp API documentation for the correct endpoint path: " +
                        "https://clickup.com/api";
                } else if (
                    error.message.includes("401") ||
                    error.message.includes("403")
                ) {
                    errorMessage +=
                        "Authentication failed. Your ClickUp connection may have expired. Please reconnect at: " +
                        `${process.env.NEXT_PUBLIC_APP_URL}/integrations/clickup`;
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
