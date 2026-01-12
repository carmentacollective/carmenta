/**
 * MCP Config Tool Integration Tests
 *
 * Tests the update and delete actions for MCP server configuration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { createTestUser } from "@/__tests__/fixtures/integration-fixtures";
import { createMcpConfigTool } from "@/lib/ai-team/agents/mcp-config-tool";
import { createMcpServer, getMcpServerByIdentifier } from "@/lib/db/mcp-servers";
import type {
    SubagentContext,
    SubagentResult,
    SubagentDescription,
} from "@/lib/ai-team/dcos/types";

setupTestDb();

type ToolResult = SubagentResult<any> | SubagentDescription;

/**
 * Helper to execute tool and get typed result
 */
async function executeTool(
    tool: ReturnType<typeof createMcpConfigTool>,
    params: Parameters<
        NonNullable<ReturnType<typeof createMcpConfigTool>["execute"]>
    >[0]
): Promise<ToolResult> {
    const result = await tool.execute!(params, { toolCallId: "test", messages: [] });
    return result as ToolResult;
}

/**
 * Create a minimal SubagentContext for testing
 */
function createTestContext(userId: string, userEmail: string): SubagentContext {
    return {
        userId,
        userEmail,
        writer: {
            write: () => {},
            close: () => {},
        } as unknown as SubagentContext["writer"],
    };
}

/**
 * Create a test MCP server
 */
async function createTestMcpServer(options: {
    userEmail: string;
    identifier: string;
    displayName?: string;
    url?: string;
}) {
    return createMcpServer({
        userEmail: options.userEmail,
        identifier: options.identifier,
        displayName: options.displayName || options.identifier,
        url: options.url || "https://test.example.com/mcp",
        transport: "sse",
        authType: "none",
    });
}

describe("MCP Config Tool", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let mcpConfigTool: ReturnType<typeof createMcpConfigTool>;
    let context: SubagentContext;

    beforeEach(async () => {
        testUser = await createTestUser();
        context = createTestContext(testUser.id, testUser.email);
        mcpConfigTool = createMcpConfigTool(context);
    });

    describe("describe action", () => {
        it("includes update and delete operations", async () => {
            const result = (await executeTool(mcpConfigTool, {
                action: "describe",
            })) as SubagentDescription;

            expect(result.operations).toBeDefined();
            const operationNames = result.operations.map((op) => op.name);
            expect(operationNames).toContain("update");
            expect(operationNames).toContain("delete");
        });
    });

    describe("update action", () => {
        it("updates an existing server URL", async () => {
            // Create a test server first
            await createTestMcpServer({
                userEmail: testUser.email,
                identifier: "test-server",
                url: "https://old.example.com/mcp",
            });

            // Update it
            const result = (await executeTool(mcpConfigTool, {
                action: "update",
                identifier: "test-server",
                url: "https://new.example.com/mcp",
            })) as SubagentResult<any>;

            expect(result.success).toBe(true);
            expect(result.data?.server?.url).toBe("https://new.example.com/mcp");

            // Verify in database
            const updated = await getMcpServerByIdentifier(
                testUser.email,
                "test-server"
            );
            expect(updated?.url).toBe("https://new.example.com/mcp");
        });

        it("updates server display name", async () => {
            await createTestMcpServer({
                userEmail: testUser.email,
                identifier: "my-server",
                displayName: "Old Name",
            });

            const result = (await executeTool(mcpConfigTool, {
                action: "update",
                identifier: "my-server",
                displayName: "New Display Name",
            })) as SubagentResult<any>;

            expect(result.success).toBe(true);
            expect(result.data?.server?.displayName).toBe("New Display Name");
        });

        it("returns error for non-existent server", async () => {
            const result = (await executeTool(mcpConfigTool, {
                action: "update",
                identifier: "does-not-exist",
                url: "https://example.com/mcp",
            })) as SubagentResult<any>;

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("not found");
        });

        it("requires at least one field to update", async () => {
            await createTestMcpServer({
                userEmail: testUser.email,
                identifier: "test-server",
            });

            const result = (await executeTool(mcpConfigTool, {
                action: "update",
                identifier: "test-server",
                // No fields to update
            })) as SubagentResult<any>;

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("At least one of");
        });
    });

    describe("delete action", () => {
        it("deletes an existing server", async () => {
            await createTestMcpServer({
                userEmail: testUser.email,
                identifier: "to-delete",
            });

            // Verify it exists first
            const beforeDelete = await getMcpServerByIdentifier(
                testUser.email,
                "to-delete"
            );
            expect(beforeDelete).toBeDefined();

            // Delete it
            const result = (await executeTool(mcpConfigTool, {
                action: "delete",
                identifier: "to-delete",
            })) as SubagentResult<any>;

            expect(result.success).toBe(true);
            expect(result.data?.identifier).toBe("to-delete");

            // Verify it's gone
            const afterDelete = await getMcpServerByIdentifier(
                testUser.email,
                "to-delete"
            );
            expect(afterDelete).toBeUndefined();
        });

        it("returns error for non-existent server", async () => {
            const result = (await executeTool(mcpConfigTool, {
                action: "delete",
                identifier: "does-not-exist",
            })) as SubagentResult<any>;

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("not found");
        });

        it("requires identifier", async () => {
            const result = (await executeTool(mcpConfigTool, {
                action: "delete",
                // Missing identifier
            })) as SubagentResult<any>;

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("identifier is required");
        });
    });
});
