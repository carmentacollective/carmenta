/**
 * Asana Service Adapter
 *
 * Task and project management via Asana API using in-house OAuth.
 *
 * ## AI-First Design
 * - search_tasks returns rich data with notes/descriptions inline
 * - Uses opt_fields to get synthesis-ready responses in one call
 * - Default limit: 10 results with summaries included
 *
 * ## Code-Relevant Gotchas
 * - Full-text search (text param) requires premium Asana - we gracefully handle 402 errors
 * - Most operations need workspace_gid - use get_me first to discover it
 * - Due dates use ISO format (YYYY-MM-DD) not timestamps
 * - Pagination uses offset tokens that expire
 */

import { ServiceAdapter, HelpResponse, MCPToolResponse, RawAPIParams } from "./base";
import { httpClient } from "@/lib/http-client";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ASANA_API_BASE } from "../oauth/providers/asana";

export class AsanaAdapter extends ServiceAdapter {
    serviceName = "asana";
    serviceDisplayName = "Asana";

    /**
     * Build headers for Asana API requests.
     */
    private buildHeaders(accessToken: string): Record<string, string> {
        return {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }

    /**
     * Test the OAuth connection by making a live API request.
     */
    async testConnection(
        credentialOrToken: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await httpClient
                .get(`${ASANA_API_BASE}/users/me`, {
                    headers: this.buildHeaders(credentialOrToken),
                })
                .json<Record<string, unknown>>();

            return { success: true };
        } catch (error) {
            logger.error({ error, userId }, "Failed to verify Asana connection");
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
                "Manage tasks and projects in Asana. " +
                "IMPORTANT: Use 'get_me' first to get your user_gid and default workspace_gid. " +
                "Use 'search_tasks' for queries like 'what tasks are assigned to me?' - returns rich data including notes. " +
                "Use 'list_project_tasks' to see tasks in a specific project. " +
                "Both return summaries - only use get_task if you need full details or comments.",
            commonOperations: ["get_me", "search_tasks", "list_project_tasks"],
            operations: [
                {
                    name: "get_me",
                    description:
                        "Get current user info including user_gid and default workspace. " +
                        "ALWAYS call this first to discover workspace_gid needed for other operations.",
                    parameters: [],
                    returns:
                        "User profile with gid, name, email, and workspaces. Use workspace gid for subsequent calls.",
                    example: `get_me()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_workspaces",
                    description: "Get all workspaces the user has access to",
                    parameters: [],
                    returns: "List of workspaces with their IDs and names",
                    example: `list_workspaces()`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "search_tasks",
                    description:
                        "Primary action for finding tasks. Returns rich data with notes included. " +
                        "IMPORTANT: text search requires premium Asana - use filters for free accounts.",
                    parameters: [
                        {
                            name: "workspace_gid",
                            type: "string",
                            required: true,
                            description: "Workspace GID (get from get_me)",
                        },
                        {
                            name: "text",
                            type: "string",
                            required: false,
                            description:
                                "Full-text search on name and notes (PREMIUM ONLY - returns 402 on free)",
                        },
                        {
                            name: "assignee",
                            type: "string",
                            required: false,
                            description:
                                "Filter by assignee user GID. Use 'me' for current user.",
                        },
                        {
                            name: "completed",
                            type: "boolean",
                            required: false,
                            description: "Filter by completion status (default: false)",
                        },
                        {
                            name: "projects",
                            type: "string",
                            required: false,
                            description:
                                "Filter by project GID (comma-separated for multiple)",
                        },
                        {
                            name: "due_on_before",
                            type: "string",
                            required: false,
                            description: "Due date before (YYYY-MM-DD)",
                        },
                        {
                            name: "due_on_after",
                            type: "string",
                            required: false,
                            description: "Due date after (YYYY-MM-DD)",
                        },
                        {
                            name: "modified_at_after",
                            type: "string",
                            required: false,
                            description: "Modified after (ISO 8601 datetime)",
                        },
                        {
                            name: "sort_by",
                            type: "string",
                            required: false,
                            description:
                                "Sort by: due_date, created_at, completed_at, modified_at (default)",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10, max: 100)",
                        },
                    ],
                    returns:
                        "Tasks with names, notes, assignees, due dates, and projects. Synthesize directly from these.",
                    example: `search_tasks({ workspace_gid: "123", assignee: "me", completed: false, limit: 10 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_project_tasks",
                    description:
                        "Get tasks from a specific project with rich data included",
                    parameters: [
                        {
                            name: "project_gid",
                            type: "string",
                            required: true,
                            description: "Project GID",
                        },
                        {
                            name: "completed_since",
                            type: "string",
                            required: false,
                            description:
                                "Only return incomplete tasks or completed since date (ISO 8601)",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 10, max: 100)",
                        },
                    ],
                    returns: "Tasks in the project with full details",
                    example: `list_project_tasks({ project_gid: "456", limit: 20 })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "list_projects",
                    description: "Get projects in a workspace",
                    parameters: [
                        {
                            name: "workspace_gid",
                            type: "string",
                            required: true,
                            description: "Workspace GID",
                        },
                        {
                            name: "archived",
                            type: "boolean",
                            required: false,
                            description: "Include archived projects (default: false)",
                        },
                        {
                            name: "limit",
                            type: "number",
                            required: false,
                            description: "Max results (default: 20)",
                        },
                    ],
                    returns: "List of projects with names and details",
                    example: `list_projects({ workspace_gid: "123" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "get_task",
                    description:
                        "Get FULL details of ONE task. Only use when user needs deep details on a specific task.",
                    parameters: [
                        {
                            name: "task_gid",
                            type: "string",
                            required: true,
                            description: "Task GID",
                        },
                    ],
                    returns:
                        "Full task details: name, notes, assignee, dates, tags, custom fields",
                    example: `get_task({ task_gid: "789" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "create_task",
                    description: "Create a new task",
                    parameters: [
                        {
                            name: "workspace_gid",
                            type: "string",
                            required: false,
                            description: "Workspace GID (required if no projects)",
                        },
                        {
                            name: "projects",
                            type: "array",
                            required: false,
                            description: "Project GIDs to add task to",
                            example: '["123", "456"]',
                        },
                        {
                            name: "name",
                            type: "string",
                            required: true,
                            description: "Task name/title",
                        },
                        {
                            name: "notes",
                            type: "string",
                            required: false,
                            description: "Task description (supports markdown)",
                        },
                        {
                            name: "assignee",
                            type: "string",
                            required: false,
                            description: "Assignee user GID or 'me'",
                        },
                        {
                            name: "due_on",
                            type: "string",
                            required: false,
                            description: "Due date (YYYY-MM-DD)",
                        },
                        {
                            name: "start_on",
                            type: "string",
                            required: false,
                            description: "Start date (YYYY-MM-DD)",
                        },
                    ],
                    returns: "Created task details including task GID and URL",
                    example: `create_task({ workspace_gid: "123", name: "Review PR", assignee: "me", due_on: "2026-01-20" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "update_task",
                    description: "Update an existing task",
                    parameters: [
                        {
                            name: "task_gid",
                            type: "string",
                            required: true,
                            description: "Task GID to update",
                        },
                        {
                            name: "name",
                            type: "string",
                            required: false,
                            description: "New task name",
                        },
                        {
                            name: "notes",
                            type: "string",
                            required: false,
                            description: "New task notes",
                        },
                        {
                            name: "completed",
                            type: "boolean",
                            required: false,
                            description: "Mark complete/incomplete",
                        },
                        {
                            name: "assignee",
                            type: "string",
                            required: false,
                            description:
                                "New assignee user GID or 'me' or null to unassign",
                        },
                        {
                            name: "due_on",
                            type: "string",
                            required: false,
                            description: "New due date (YYYY-MM-DD) or null to clear",
                        },
                    ],
                    returns: "Updated task details",
                    example: `update_task({ task_gid: "789", completed: true })`,
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
                            name: "task_gid",
                            type: "string",
                            required: true,
                            description: "Task GID to delete",
                        },
                    ],
                    returns: "Confirmation of deletion",
                    example: `delete_task({ task_gid: "789" })`,
                    annotations: { readOnlyHint: false, destructiveHint: true },
                },
                {
                    name: "get_stories",
                    description: "Get comments and activity on a task",
                    parameters: [
                        {
                            name: "task_gid",
                            type: "string",
                            required: true,
                            description: "Task GID",
                        },
                    ],
                    returns: "List of comments and activity entries",
                    example: `get_stories({ task_gid: "789" })`,
                    annotations: { readOnlyHint: true },
                },
                {
                    name: "add_comment",
                    description: "Add a comment to a task",
                    parameters: [
                        {
                            name: "task_gid",
                            type: "string",
                            required: true,
                            description: "Task GID to comment on",
                        },
                        {
                            name: "text",
                            type: "string",
                            required: true,
                            description: "Comment text",
                        },
                    ],
                    returns: "Created comment details",
                    example: `add_comment({ task_gid: "789", text: "Looking good!" })`,
                    annotations: { readOnlyHint: false, destructiveHint: false },
                },
                {
                    name: "raw_api",
                    description:
                        "Use this operation when the user requests functionality that doesn't have a dedicated operation listed above. " +
                        "This gives you direct access to the full Asana API. " +
                        "If you're familiar with the Asana API structure, construct the request directly. " +
                        "If unsure/errors: consult https://developers.asana.com/reference",
                    parameters: [
                        {
                            name: "endpoint",
                            type: "string",
                            required: true,
                            description:
                                "Asana API endpoint path (e.g., '/users/me', '/workspaces', '/tasks')",
                            example: "/users/me",
                        },
                        {
                            name: "method",
                            type: "string",
                            required: true,
                            description: "HTTP method (GET, POST, PUT, DELETE)",
                            example: "GET",
                        },
                        {
                            name: "body",
                            type: "object",
                            required: false,
                            description: "Request body for POST/PUT requests",
                        },
                        {
                            name: "query",
                            type: "object",
                            required: false,
                            description: "Query parameters as key-value pairs",
                        },
                    ],
                    returns: "Raw Asana API response as JSON",
                    example: `raw_api({ endpoint: "/users/me", method: "GET" })`,
                },
            ],
            docsUrl: "https://developers.asana.com/reference",
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
                `[ASANA ADAPTER] Validation failed for action '${action}':`,
                validation.errors
            );
            return this.createErrorResponse(
                `Validation errors:\n${validation.errors.join("\n")}`
            );
        }

        // Get credentials via base adapter helper
        const tokenResult = await this.getOAuthAccessToken(userId, accountId);
        if ("content" in tokenResult) {
            return tokenResult;
        }
        const { accessToken } = tokenResult;

        try {
            switch (action) {
                case "get_me":
                    return await this.handleGetMe(accessToken);
                case "list_workspaces":
                    return await this.handleListWorkspaces(accessToken);
                case "search_tasks":
                    return await this.handleSearchTasks(params, accessToken);
                case "list_project_tasks":
                    return await this.handleListProjectTasks(params, accessToken);
                case "list_projects":
                    return await this.handleListProjects(params, accessToken);
                case "get_task":
                    return await this.handleGetTask(params, accessToken);
                case "create_task":
                    return await this.handleCreateTask(params, accessToken);
                case "update_task":
                    return await this.handleUpdateTask(params, accessToken);
                case "delete_task":
                    return await this.handleDeleteTask(params, accessToken);
                case "get_stories":
                    return await this.handleGetStories(params, accessToken);
                case "add_comment":
                    return await this.handleAddComment(params, accessToken);
                case "raw_api":
                    return await this.executeRawAPI(
                        params as RawAPIParams,
                        userId,
                        accountId
                    );
                default:
                    this.logError(
                        `[ASANA ADAPTER] Unknown action '${action}' requested by user ${userId}`
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

    // Standard opt_fields for rich task data
    private readonly TASK_OPT_FIELDS =
        "name,notes,completed,assignee.name,due_on,start_on,projects.name,tags.name,created_at,modified_at,permalink_url";

    private async handleGetMe(accessToken: string): Promise<MCPToolResponse> {
        const response = await httpClient
            .get(`${ASANA_API_BASE}/users/me`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    opt_fields: "name,email,workspaces.name",
                },
            })
            .json<{
                data: {
                    gid: string;
                    name: string;
                    email: string;
                    workspaces: Array<{ gid: string; name: string }>;
                };
            }>();

        return this.createJSONResponse({
            user_gid: response.data.gid,
            name: response.data.name,
            email: response.data.email,
            workspaces: response.data.workspaces.map((w) => ({
                gid: w.gid,
                name: w.name,
            })),
            note: "Use workspace gid for search_tasks and other operations. Use user_gid for assignee filters.",
        });
    }

    private async handleListWorkspaces(accessToken: string): Promise<MCPToolResponse> {
        const response = await httpClient
            .get(`${ASANA_API_BASE}/workspaces`, {
                headers: this.buildHeaders(accessToken),
            })
            .json<{
                data: Array<{ gid: string; name: string }>;
            }>();

        return this.createJSONResponse({
            totalCount: response.data.length,
            workspaces: response.data.map((w) => ({
                gid: w.gid,
                name: w.name,
            })),
            note: "Use workspace gid for search_tasks, list_projects, and create_task.",
        });
    }

    private async handleSearchTasks(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            workspace_gid,
            text,
            assignee,
            completed = false,
            projects,
            due_on_before,
            due_on_after,
            modified_at_after,
            sort_by,
            limit = 10,
        } = params as {
            workspace_gid: string;
            text?: string;
            assignee?: string;
            completed?: boolean;
            projects?: string;
            due_on_before?: string;
            due_on_after?: string;
            modified_at_after?: string;
            sort_by?: string;
            limit?: number;
        };

        const searchParams: Record<string, string> = {
            opt_fields: this.TASK_OPT_FIELDS,
            limit: Math.min(limit, 100).toString(),
        };

        // Build filter params
        if (text) searchParams.text = text;
        if (assignee) {
            searchParams["assignee.any"] = assignee;
        }
        if (completed !== undefined) {
            searchParams.completed = String(completed);
        }
        if (projects) {
            searchParams["projects.any"] = projects;
        }
        if (due_on_before) searchParams["due_on.before"] = due_on_before;
        if (due_on_after) searchParams["due_on.after"] = due_on_after;
        if (modified_at_after) searchParams["modified_at.after"] = modified_at_after;
        if (sort_by) searchParams.sort_by = sort_by;

        try {
            const response = await httpClient
                .get(`${ASANA_API_BASE}/workspaces/${workspace_gid}/tasks/search`, {
                    headers: this.buildHeaders(accessToken),
                    searchParams,
                })
                .json<{
                    data: Array<{
                        gid: string;
                        name: string;
                        notes?: string;
                        completed: boolean;
                        assignee?: { name: string };
                        due_on?: string;
                        start_on?: string;
                        projects?: Array<{ name: string }>;
                        tags?: Array<{ name: string }>;
                        permalink_url?: string;
                    }>;
                    next_page?: { offset: string };
                }>();

            return this.createJSONResponse({
                totalCount: response.data.length,
                tasks: response.data.map((task) => ({
                    gid: task.gid,
                    name: task.name,
                    notes: task.notes
                        ? task.notes.slice(0, 500) +
                          (task.notes.length > 500 ? "..." : "")
                        : undefined,
                    completed: task.completed,
                    assignee: task.assignee?.name,
                    due_on: task.due_on,
                    projects: task.projects?.map((p) => p.name),
                    tags: task.tags?.map((t) => t.name),
                    url: task.permalink_url,
                })),
                hasMore: !!response.next_page,
                note: "Tasks include notes - synthesize directly. Use get_task only if full details needed.",
            });
        } catch (error) {
            // Handle premium-only text search error
            if (error instanceof Error && error.message.includes("402")) {
                return this.createErrorResponse(
                    "Full-text search requires Asana Premium. Try using filters instead: " +
                        "assignee, projects, due_on_before, due_on_after, completed."
                );
            }
            throw error;
        }
    }

    private async handleListProjectTasks(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            project_gid,
            completed_since,
            limit = 10,
        } = params as {
            project_gid: string;
            completed_since?: string;
            limit?: number;
        };

        const searchParams: Record<string, string> = {
            opt_fields: this.TASK_OPT_FIELDS,
            limit: Math.min(limit, 100).toString(),
        };

        if (completed_since) {
            searchParams.completed_since = completed_since;
        }

        const response = await httpClient
            .get(`${ASANA_API_BASE}/projects/${project_gid}/tasks`, {
                headers: this.buildHeaders(accessToken),
                searchParams,
            })
            .json<{
                data: Array<{
                    gid: string;
                    name: string;
                    notes?: string;
                    completed: boolean;
                    assignee?: { name: string };
                    due_on?: string;
                    tags?: Array<{ name: string }>;
                    permalink_url?: string;
                }>;
                next_page?: { offset: string };
            }>();

        return this.createJSONResponse({
            totalCount: response.data.length,
            tasks: response.data.map((task) => ({
                gid: task.gid,
                name: task.name,
                notes: task.notes
                    ? task.notes.slice(0, 500) + (task.notes.length > 500 ? "..." : "")
                    : undefined,
                completed: task.completed,
                assignee: task.assignee?.name,
                due_on: task.due_on,
                tags: task.tags?.map((t) => t.name),
                url: task.permalink_url,
            })),
            hasMore: !!response.next_page,
            note: "Tasks include notes - synthesize directly. Use get_task for full details.",
        });
    }

    private async handleListProjects(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const {
            workspace_gid,
            archived = false,
            limit = 20,
        } = params as {
            workspace_gid: string;
            archived?: boolean;
            limit?: number;
        };

        const response = await httpClient
            .get(`${ASANA_API_BASE}/workspaces/${workspace_gid}/projects`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    archived: String(archived),
                    limit: Math.min(limit, 100).toString(),
                    opt_fields: "name,color,notes,permalink_url",
                },
            })
            .json<{
                data: Array<{
                    gid: string;
                    name: string;
                    color?: string;
                    notes?: string;
                    permalink_url?: string;
                }>;
            }>();

        return this.createJSONResponse({
            totalCount: response.data.length,
            projects: response.data.map((p) => ({
                gid: p.gid,
                name: p.name,
                color: p.color,
                notes: p.notes
                    ? p.notes.slice(0, 200) + (p.notes.length > 200 ? "..." : "")
                    : undefined,
                url: p.permalink_url,
            })),
            note: "Use project gid for list_project_tasks or as filter in search_tasks.",
        });
    }

    private async handleGetTask(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { task_gid } = params as { task_gid: string };

        const response = await httpClient
            .get(`${ASANA_API_BASE}/tasks/${task_gid}`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    opt_fields:
                        "name,notes,html_notes,completed,assignee.name,assignee.email,due_on,due_at,start_on,projects.name,tags.name,custom_fields,created_at,modified_at,permalink_url,num_subtasks",
                },
            })
            .json<{
                data: {
                    gid: string;
                    name: string;
                    notes?: string;
                    html_notes?: string;
                    completed: boolean;
                    assignee?: { name: string; email: string };
                    due_on?: string;
                    due_at?: string;
                    start_on?: string;
                    projects?: Array<{ gid: string; name: string }>;
                    tags?: Array<{ name: string }>;
                    custom_fields?: Array<{
                        gid: string;
                        name: string;
                        display_value: string | null;
                    }>;
                    created_at: string;
                    modified_at: string;
                    permalink_url: string;
                    num_subtasks: number;
                };
            }>();

        const task = response.data;

        return this.createJSONResponse({
            gid: task.gid,
            name: task.name,
            notes: task.notes,
            completed: task.completed,
            assignee: task.assignee
                ? { name: task.assignee.name, email: task.assignee.email }
                : null,
            due_on: task.due_on,
            due_at: task.due_at,
            start_on: task.start_on,
            projects: task.projects?.map((p) => ({ gid: p.gid, name: p.name })),
            tags: task.tags?.map((t) => t.name),
            customFields: task.custom_fields
                ?.filter((f) => f.display_value)
                .map((f) => ({ name: f.name, value: f.display_value })),
            created_at: task.created_at,
            modified_at: task.modified_at,
            url: task.permalink_url,
            subtaskCount: task.num_subtasks,
            note: "Full task details. Use get_stories for comments.",
        });
    }

    private async handleCreateTask(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { workspace_gid, projects, name, notes, assignee, due_on, start_on } =
            params as {
                workspace_gid?: string;
                projects?: string[];
                name: string;
                notes?: string;
                assignee?: string;
                due_on?: string;
                start_on?: string;
            };

        if (!workspace_gid && (!projects || projects.length === 0)) {
            throw new ValidationError(
                "Either workspace_gid or projects is required for create_task"
            );
        }

        const body: Record<string, unknown> = { name };
        if (workspace_gid) body.workspace = workspace_gid;
        if (projects && projects.length > 0) body.projects = projects;
        if (notes) body.notes = notes;
        if (assignee) body.assignee = assignee;
        if (due_on) body.due_on = due_on;
        if (start_on) body.start_on = start_on;

        const response = await httpClient
            .post(`${ASANA_API_BASE}/tasks`, {
                headers: this.buildHeaders(accessToken),
                json: { data: body },
            })
            .json<{
                data: {
                    gid: string;
                    name: string;
                    permalink_url: string;
                };
            }>();

        return this.createJSONResponse({
            success: true,
            task_gid: response.data.gid,
            name: response.data.name,
            url: response.data.permalink_url,
            note: "Task created! Share the URL or use task_gid for updates.",
        });
    }

    private async handleUpdateTask(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { task_gid, name, notes, completed, assignee, due_on } = params as {
            task_gid: string;
            name?: string;
            notes?: string;
            completed?: boolean;
            assignee?: string | null;
            due_on?: string | null;
        };

        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (notes !== undefined) body.notes = notes;
        if (completed !== undefined) body.completed = completed;
        if (assignee !== undefined) body.assignee = assignee;
        if (due_on !== undefined) body.due_on = due_on;

        if (Object.keys(body).length === 0) {
            throw new ValidationError(
                "update_task requires at least one field to update (name, notes, completed, assignee, or due_on)"
            );
        }

        const response = await httpClient
            .put(`${ASANA_API_BASE}/tasks/${task_gid}`, {
                headers: this.buildHeaders(accessToken),
                json: { data: body },
            })
            .json<{
                data: {
                    gid: string;
                    name: string;
                    completed: boolean;
                    permalink_url: string;
                };
            }>();

        return this.createJSONResponse({
            success: true,
            task_gid: response.data.gid,
            name: response.data.name,
            completed: response.data.completed,
            url: response.data.permalink_url,
            note: "Task updated!",
        });
    }

    private async handleDeleteTask(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { task_gid } = params as { task_gid: string };

        await httpClient.delete(`${ASANA_API_BASE}/tasks/${task_gid}`, {
            headers: this.buildHeaders(accessToken),
        });

        return this.createJSONResponse({
            success: true,
            task_gid,
            note: "Task deleted. This cannot be undone.",
        });
    }

    private async handleGetStories(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { task_gid } = params as { task_gid: string };

        const response = await httpClient
            .get(`${ASANA_API_BASE}/tasks/${task_gid}/stories`, {
                headers: this.buildHeaders(accessToken),
                searchParams: {
                    opt_fields: "created_at,created_by.name,text,resource_subtype",
                },
            })
            .json<{
                data: Array<{
                    gid: string;
                    created_at: string;
                    created_by?: { name: string };
                    text?: string;
                    resource_subtype: string;
                }>;
            }>();

        // Filter to just comments (not system events)
        const comments = response.data.filter(
            (s) => s.resource_subtype === "comment_added" && s.text
        );

        return this.createJSONResponse({
            totalCount: comments.length,
            comments: comments.map((c) => ({
                gid: c.gid,
                author: c.created_by?.name,
                text: c.text,
                created_at: c.created_at,
            })),
            note: "Comments on the task, oldest first.",
        });
    }

    private async handleAddComment(
        params: unknown,
        accessToken: string
    ): Promise<MCPToolResponse> {
        const { task_gid, text } = params as { task_gid: string; text: string };

        const response = await httpClient
            .post(`${ASANA_API_BASE}/tasks/${task_gid}/stories`, {
                headers: this.buildHeaders(accessToken),
                json: { data: { text } },
            })
            .json<{
                data: {
                    gid: string;
                    created_at: string;
                    text: string;
                };
            }>();

        return this.createJSONResponse({
            success: true,
            comment_gid: response.data.gid,
            created_at: response.data.created_at,
            note: "Comment added to task.",
        });
    }

    /**
     * Execute a raw Asana API request
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
                "raw_api requires 'method' parameter (GET, POST, PUT, DELETE)"
            );
        }

        // Validate endpoint starts with /
        if (!endpoint.startsWith("/")) {
            return this.createErrorResponse(
                `Invalid endpoint: must start with '/'. Got: ${endpoint}. Example: '/users/me'`
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
            requestOptions.json = { data: body };
        }

        try {
            const httpMethod = method.toLowerCase() as
                | "get"
                | "post"
                | "put"
                | "patch"
                | "delete";
            const fullUrl = `${ASANA_API_BASE}${endpoint}`;

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
                        "Endpoint not found. Check the Asana API docs: https://developers.asana.com/reference";
                } else {
                    errorMessage += this.getAPIErrorDescription(error);
                }
            } else {
                errorMessage += "Unknown error";
            }

            return this.createErrorResponse(errorMessage);
        }
    }
}
