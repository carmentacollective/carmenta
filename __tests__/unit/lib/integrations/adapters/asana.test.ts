/**
 * Asana Adapter Tests
 *
 * Tests authentication and core operations for the Asana adapter.
 * Follows the pattern established by CoinMarketCap adapter tests.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AsanaAdapter } from "@/lib/integrations/adapters/asana";
import { ValidationError } from "@/lib/errors";

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getCredentials: vi.fn(),
}));

// Mock HTTP client
vi.mock("@/lib/http-client", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        NEXT_PUBLIC_APP_URL: "https://carmenta.ai",
    },
}));

describe("AsanaAdapter", () => {
    let adapter: AsanaAdapter;
    const testUserEmail = "test@example.com";

    beforeEach(() => {
        adapter = new AsanaAdapter();
        vi.clearAllMocks();
    });

    describe("Service Configuration", () => {
        it("has correct service name and display name", () => {
            expect(adapter.serviceName).toBe("asana");
            expect(adapter.serviceDisplayName).toBe("Asana");
        });

        it("provides comprehensive help documentation", () => {
            const help = adapter.getHelp();

            expect(help.service).toBe("Asana");
            expect(help.description).toContain("get_me");
            expect(help.commonOperations).toContain("get_me");
            expect(help.commonOperations).toContain("search_tasks");
            expect(help.operations.length).toBeGreaterThan(10);

            // Verify key operations are documented
            const operationNames = help.operations.map((op) => op.name);
            expect(operationNames).toContain("get_me");
            expect(operationNames).toContain("search_tasks");
            expect(operationNames).toContain("list_project_tasks");
            expect(operationNames).toContain("create_task");
            expect(operationNames).toContain("update_task");
            expect(operationNames).toContain("delete_task");
            expect(operationNames).toContain("raw_api");
        });
    });

    describe("Connection Testing", () => {
        it("validates OAuth token using /users/me endpoint", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "123",
                        name: "Test User",
                        email: "test@example.com",
                    },
                }),
            });

            const result = await adapter.testConnection("test-access-token");

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(httpClient.get).toHaveBeenCalledWith(
                "https://app.asana.com/api/1.0/users/me",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-access-token",
                    }),
                })
            );
        });

        it("returns error for invalid OAuth token (401)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            });

            const result = await adapter.testConnection("invalid-token");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns error for expired token (403)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 403: Forbidden")),
            });

            const result = await adapter.testConnection("expired-token");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns error for rate limit (429)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            });

            const result = await adapter.testConnection("rate-limited-token");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("returns generic error for unknown failures", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("Network timeout")),
            });

            const result = await adapter.testConnection("test-token");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("Authentication", () => {
        it("returns friendly error when service not connected", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("asana is not connected")
            );

            const result = await adapter.execute("get_me", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("proceeds with valid OAuth credentials", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "default",
                accountDisplayName: "My Asana",
                isDefault: true,
            });

            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "123456",
                        name: "Test User",
                        email: "test@example.com",
                        workspaces: [{ gid: "ws-123", name: "My Workspace" }],
                    },
                }),
            } as never);

            const result = await adapter.execute("get_me", {}, testUserEmail);

            expect(result.isError).toBe(false);
            // getCredentials receives optional accountId as 3rd param (undefined here)
            expect(getCredentials).toHaveBeenCalledWith(
                testUserEmail,
                "asana",
                undefined
            );
        });

        it("handles authentication errors in raw_api consistently", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockRejectedValue(
                new ValidationError("asana is not connected")
            );

            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "/users/me",
                    method: "GET",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });
    });

    describe("Parameter Validation", () => {
        it("validates required workspace_gid for search_tasks", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-token",
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute(
                "search_tasks",
                { text: "test" }, // Missing workspace_gid
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("validates required project_gid for list_project_tasks", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-token",
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute(
                "list_project_tasks",
                {}, // Missing project_gid
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("validates required task_gid for get_task", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-token",
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute(
                "get_task",
                {}, // Missing task_gid
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("validates required name for create_task", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-token",
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute(
                "create_task",
                { workspace_gid: "123" }, // Missing name
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("validates raw_api endpoint format", async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-token",
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });

            const result = await adapter.execute(
                "raw_api",
                {
                    endpoint: "invalid/endpoint", // Missing leading /
                    method: "GET",
                },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });
    });

    describe("Operation Execution", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "default",
                accountDisplayName: "Test Account",
                isDefault: true,
            });
        });

        it("executes get_me operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "123456",
                        name: "Test User",
                        email: "test@example.com",
                        workspaces: [
                            { gid: "ws-001", name: "Personal" },
                            { gid: "ws-002", name: "Work" },
                        ],
                    },
                }),
            } as never);

            const result = await adapter.execute("get_me", {}, testUserEmail);

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.user_gid).toBe("123456");
                expect(responseData.name).toBe("Test User");
                expect(responseData.workspaces).toHaveLength(2);
            }
        });

        it("executes list_workspaces operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        { gid: "ws-001", name: "Personal" },
                        { gid: "ws-002", name: "Work" },
                    ],
                }),
            } as never);

            const result = await adapter.execute("list_workspaces", {}, testUserEmail);

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.workspaces).toHaveLength(2);
            }
        });

        it("executes search_tasks operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            gid: "task-001",
                            name: "Complete project",
                            notes: "Important task",
                            completed: false,
                            assignee: { name: "Test User" },
                            due_on: "2026-01-20",
                            projects: [{ name: "Work" }],
                            tags: [{ name: "urgent" }],
                            permalink_url: "https://app.asana.com/task/001",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "search_tasks",
                { workspace_gid: "ws-001", assignee: "me", completed: false },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.tasks).toHaveLength(1);
                expect(responseData.tasks[0].name).toBe("Complete project");
                expect(responseData.tasks[0].assignee).toBe("Test User");
            }
        });

        it("executes list_project_tasks operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            gid: "task-001",
                            name: "Task 1",
                            completed: false,
                            assignee: { name: "User 1" },
                        },
                        {
                            gid: "task-002",
                            name: "Task 2",
                            completed: true,
                            assignee: { name: "User 2" },
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_project_tasks",
                { project_gid: "proj-001", limit: 10 },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.tasks).toHaveLength(2);
            }
        });

        it("executes get_task operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "task-001",
                        name: "Complete project",
                        notes: "Full description here",
                        completed: false,
                        assignee: { name: "Test User", email: "test@example.com" },
                        due_on: "2026-01-20",
                        projects: [{ gid: "proj-001", name: "Work" }],
                        tags: [{ name: "urgent" }],
                        custom_fields: [
                            { gid: "cf-001", name: "Priority", display_value: "High" },
                        ],
                        created_at: "2026-01-10T10:00:00Z",
                        modified_at: "2026-01-15T14:30:00Z",
                        permalink_url: "https://app.asana.com/task/001",
                        num_subtasks: 3,
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "get_task",
                { task_gid: "task-001" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.name).toBe("Complete project");
                expect(responseData.customFields[0].name).toBe("Priority");
                expect(responseData.subtaskCount).toBe(3);
            }
        });

        it("executes create_task operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "new-task-001",
                        name: "New Task",
                        permalink_url: "https://app.asana.com/task/new-001",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "create_task",
                {
                    workspace_gid: "ws-001",
                    name: "New Task",
                    notes: "Description",
                    assignee: "me",
                    due_on: "2026-01-25",
                },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.success).toBe(true);
                expect(responseData.task_gid).toBe("new-task-001");
            }
        });

        it("executes update_task operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.put as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "task-001",
                        name: "Updated Task",
                        completed: true,
                        permalink_url: "https://app.asana.com/task/001",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "update_task",
                { task_gid: "task-001", completed: true },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.success).toBe(true);
                expect(responseData.completed).toBe(true);
            }
        });

        it("executes delete_task operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.delete as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({}),
            } as never);

            const result = await adapter.execute(
                "delete_task",
                { task_gid: "task-001" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.success).toBe(true);
            }
        });

        it("executes get_stories operation (comments)", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            gid: "story-001",
                            created_at: "2026-01-15T10:00:00Z",
                            created_by: { name: "User 1" },
                            text: "Great progress!",
                            resource_subtype: "comment_added",
                        },
                        {
                            gid: "story-002",
                            created_at: "2026-01-16T11:00:00Z",
                            created_by: { name: "User 2" },
                            text: "Agreed!",
                            resource_subtype: "comment_added",
                        },
                        {
                            gid: "story-003",
                            created_at: "2026-01-14T09:00:00Z",
                            resource_subtype: "assigned", // System event, should be filtered
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "get_stories",
                { task_gid: "task-001" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                // Should only include comment_added, not system events
                expect(responseData.comments).toHaveLength(2);
                expect(responseData.comments[0].text).toBe("Great progress!");
            }
        });

        it("executes add_comment operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "comment-001",
                        created_at: "2026-01-18T12:00:00Z",
                        text: "New comment",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "add_comment",
                { task_gid: "task-001", text: "New comment" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.success).toBe(true);
                expect(responseData.comment_gid).toBe("comment-001");
            }
        });

        it("executes list_projects operation", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: [
                        {
                            gid: "proj-001",
                            name: "Project A",
                            color: "light-green",
                            notes: "Description A",
                            permalink_url: "https://app.asana.com/proj/001",
                        },
                        {
                            gid: "proj-002",
                            name: "Project B",
                            color: "blue",
                            permalink_url: "https://app.asana.com/proj/002",
                        },
                    ],
                }),
            } as never);

            const result = await adapter.execute(
                "list_projects",
                { workspace_gid: "ws-001" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
            const content = result.content[0];
            expect(content.type).toBe("text");
            if (content.type === "text") {
                const responseData = JSON.parse(content.text!);
                expect(responseData.projects).toHaveLength(2);
                expect(responseData.projects[0].name).toBe("Project A");
            }
        });
    });

    describe("Error Handling", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-access-token",
                accountId: "default",
                accountDisplayName: "Test Account",
                isDefault: true,
            });
        });

        it("handles 401 authentication errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
            } as never);

            const result = await adapter.execute("get_me", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("handles 429 rate limit errors", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 429: Too Many Requests")),
            } as never);

            const result = await adapter.execute("get_me", {}, testUserEmail);

            expect(result.isError).toBe(true);
        });

        it("handles 402 premium-only text search errors gracefully", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi
                    .fn()
                    .mockRejectedValue(new Error("HTTP 402: Payment Required")),
            } as never);

            const result = await adapter.execute(
                "search_tasks",
                { workspace_gid: "ws-001", text: "search text" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            const content = result.content[0];
            if (content.type === "text") {
                // Should provide helpful error about premium requirement
                expect(content.text).toContain("Premium");
            }
        });

        it("handles 404 not found errors in raw_api", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.get as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("HTTP 404: Not Found")),
            } as never);

            const result = await adapter.execute(
                "raw_api",
                { endpoint: "/nonexistent", method: "GET" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
            const content = result.content[0];
            if (content.type === "text") {
                expect(content.text).toContain("Endpoint not found");
            }
        });

        it("handles unknown action errors", async () => {
            const result = await adapter.execute("invalid_action", {}, testUserEmail);

            expect(result.isError).toBe(true);
            const content = result.content[0];
            if (content.type === "text") {
                // Base adapter validates actions and returns friendly message
                expect(content.text).toContain("don't recognize");
            }
        });
    });

    describe("Create Task Validation", () => {
        beforeEach(async () => {
            const { getCredentials } =
                await import("@/lib/integrations/connection-manager");
            (getCredentials as Mock).mockResolvedValue({
                type: "oauth",
                accessToken: "test-token",
                accountId: "default",
                accountDisplayName: "Test",
                isDefault: true,
            });
        });

        it("requires either workspace_gid or projects for create_task", async () => {
            const { httpClient } = await import("@/lib/http-client");
            // Mock will be called only if validation passes
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockRejectedValue(new Error("Should not be called")),
            } as never);

            const result = await adapter.execute(
                "create_task",
                { name: "Task without workspace or projects" },
                testUserEmail
            );

            expect(result.isError).toBe(true);
        });

        it("accepts task creation with workspace_gid only", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "new-task",
                        name: "Task",
                        permalink_url: "https://app.asana.com/task/new",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "create_task",
                { workspace_gid: "ws-001", name: "Task" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
        });

        it("accepts task creation with projects only", async () => {
            const { httpClient } = await import("@/lib/http-client");
            (httpClient.post as Mock).mockReturnValue({
                json: vi.fn().mockResolvedValue({
                    data: {
                        gid: "new-task",
                        name: "Task",
                        permalink_url: "https://app.asana.com/task/new",
                    },
                }),
            } as never);

            const result = await adapter.execute(
                "create_task",
                { projects: ["proj-001"], name: "Task" },
                testUserEmail
            );

            expect(result.isError).toBe(false);
        });
    });
});
