/**
 * MCP Gateway
 *
 * Exposes user-configured MCP servers as AI SDK tools using the gateway pattern.
 * Each MCP server becomes a single tool with progressive disclosure:
 *   - action='describe' returns available operations from the server
 *   - Other actions are forwarded as tool calls to the MCP server
 *
 * This pattern reduces token usage by ~95% vs exposing all tools individually.
 * Based on patterns from mcp-hubby.
 */

import * as Sentry from "@sentry/nextjs";
import { tool } from "ai";
import { z } from "zod";

import {
    listEnabledMcpServers,
    getMcpServerByIdentifier,
    getMcpServerCredentials,
    updateMcpServer,
    logMcpEvent,
} from "@/lib/db/mcp-servers";
import type { McpServer } from "@/lib/db/schema";
import {
    listMcpTools,
    callMcpTool,
    initializeMcpConnection,
    sendInitializedNotification,
    type McpClientConfig,
    type McpTool,
} from "./client";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

/** Tool input schema for MCP gateway tools */
const mcpGatewaySchema = z.object({
    action: z
        .string()
        .describe(
            "Action to perform. Use 'describe' to see available operations from this MCP server."
        ),
    params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Parameters for the action (see describe for details)"),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build MCP client config from server record
 * Throws if auth is required but credentials are missing/corrupted
 */
async function buildClientConfig(server: McpServer): Promise<McpClientConfig> {
    const config: McpClientConfig = {
        url: server.url,
        transport: server.transport as "sse" | "http",
        authType: server.authType as "none" | "bearer" | "header",
    };

    // Get decrypted credentials if auth is required
    if (server.authType !== "none") {
        const credentials = await getMcpServerCredentials(server.id);
        if (!credentials?.token) {
            throw new Error(
                `Authentication required for '${server.identifier}' but credentials are missing or corrupted. ` +
                    `Re-configure credentials at /integrations/mcp.`
            );
        }
        config.token = credentials.token;
        if (server.authType === "header" && server.authHeaderName) {
            config.headerName = server.authHeaderName;
        }
    }

    return config;
}

/**
 * Initialize MCP connection (required before tool operations)
 * MCP protocol requires initialize + initialized handshake before requests
 */
async function ensureInitialized(config: McpClientConfig): Promise<void> {
    await initializeMcpConnection(config);
    await sendInitializedNotification(config);
}

/**
 * Format MCP tools list for display
 */
function formatToolsForDescription(tools: McpTool[]): string {
    if (tools.length === 0) {
        return "No tools available from this server.";
    }

    const toolDescriptions = tools.map((t) => {
        const desc = t.description ? `: ${t.description}` : "";
        return `- ${t.name}${desc}`;
    });

    return `Available operations (${tools.length}):\n${toolDescriptions.join("\n")}`;
}

/**
 * Build tool description from server manifest
 */
function buildToolDescription(server: McpServer): string {
    const manifest = server.serverManifest as {
        toolCount?: number;
        tools?: string[];
        name?: string;
    } | null;

    const toolCount = manifest?.toolCount ?? 0;
    const topTools = manifest?.tools?.slice(0, 4) ?? [];
    const serverName = manifest?.name ?? server.displayName;

    if (topTools.length > 0) {
        const remaining = toolCount - topTools.length;
        const moreText = remaining > 0 ? ` +${remaining} more` : "";
        return `${serverName}. Top operations: ${topTools.join(", ")}${moreText}. Use action='describe' for full list.`;
    }

    return `${serverName}. Use action='describe' to see available operations.`;
}

// ============================================================================
// CORE GATEWAY FUNCTIONS
// ============================================================================

/**
 * Describe available operations from an MCP server
 *
 * Fetches the tools list from the server and returns formatted documentation.
 */
export async function describeMcpOperations(
    serverIdentifier: string,
    userEmail: string,
    accountId = "default"
): Promise<{ server: string; description: string; tools: McpTool[] }> {
    const childLogger = logger.child({ serverIdentifier, userEmail });

    // Find the server
    const server = await getMcpServerByIdentifier(
        userEmail,
        serverIdentifier,
        accountId
    );

    if (!server) {
        return {
            server: serverIdentifier,
            description: `MCP server '${serverIdentifier}' not found. Check your connected servers at /integrations/mcp.`,
            tools: [],
        };
    }

    if (!server.enabled) {
        return {
            server: serverIdentifier,
            description: `MCP server '${serverIdentifier}' is disabled. Enable it at /integrations/mcp.`,
            tools: [],
        };
    }

    try {
        const config = await buildClientConfig(server);
        await ensureInitialized(config);
        const tools = await listMcpTools(config);

        childLogger.info({ toolCount: tools.length }, "Fetched MCP server tools");

        // Update cached manifest (don't let DB errors mask successful operations)
        try {
            await updateMcpServer(server.id, {
                serverManifest: {
                    name: server.displayName,
                    toolCount: tools.length,
                    tools: tools.map((t) => t.name),
                },
                status: "connected",
            });
        } catch (dbError) {
            childLogger.error({ dbError }, "Failed to update server manifest");
        }

        return {
            server: server.displayName,
            description: formatToolsForDescription(tools),
            tools,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        childLogger.error({ error }, "Failed to describe MCP operations");

        // Update server status (don't let this shadow the original error)
        try {
            await updateMcpServer(server.id, {
                status: "error",
                errorMessage,
            });
        } catch (dbError) {
            childLogger.error({ dbError }, "Failed to update server error status");
        }

        await logMcpEvent({
            userEmail,
            serverIdentifier,
            accountId,
            eventType: "connection_error",
            eventSource: "system",
            errorMessage,
        });

        return {
            server: serverIdentifier,
            description: `Failed to connect to '${serverIdentifier}': ${errorMessage}. Check the server is running and credentials are valid.`,
            tools: [],
        };
    }
}

/**
 * Execute an action on an MCP server
 *
 * Routes the call to the appropriate server and returns the result.
 */
export async function executeMcpAction(
    serverIdentifier: string,
    action: string,
    params: Record<string, unknown> | undefined,
    userEmail: string,
    accountId = "default"
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const childLogger = logger.child({ serverIdentifier, action, userEmail });

    // Handle describe action
    if (action === "describe") {
        const description = await describeMcpOperations(
            serverIdentifier,
            userEmail,
            accountId
        );
        return { success: true, result: description };
    }

    // Find the server
    const server = await getMcpServerByIdentifier(
        userEmail,
        serverIdentifier,
        accountId
    );

    if (!server) {
        return {
            success: false,
            error: `MCP server '${serverIdentifier}' not found. Use action='describe' to see available servers, or configure new ones at /integrations/mcp.`,
        };
    }

    if (!server.enabled) {
        return {
            success: false,
            error: `MCP server '${serverIdentifier}' is disabled. Enable it at /integrations/mcp to use its tools.`,
        };
    }

    try {
        childLogger.debug(
            { paramKeys: Object.keys(params ?? {}) },
            "Executing MCP action"
        );

        const config = await buildClientConfig(server);
        await ensureInitialized(config);
        const result = await callMcpTool(config, action, params ?? {});

        // Update last connected timestamp (don't let DB errors mask successful operations)
        try {
            await updateMcpServer(server.id, { status: "connected" });
        } catch (dbError) {
            childLogger.error({ dbError }, "Failed to update server status");
        }

        // Check for error response from server
        if (result.isError) {
            const errorText = result.content
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("\n");

            childLogger.warn({ errorText }, "MCP tool returned error");

            return {
                success: false,
                error: errorText || "Tool execution failed",
            };
        }

        // Extract result content
        const textContent = result.content.find((c) => c.type === "text");
        if (textContent && "text" in textContent) {
            try {
                // Try to parse as JSON for structured responses
                return {
                    success: true,
                    result: JSON.parse(textContent.text as string),
                };
            } catch {
                return { success: true, result: textContent.text };
            }
        }

        // Handle image/resource content
        const otherContent = result.content.find((c) => c.type !== "text");
        if (otherContent) {
            return { success: true, result: otherContent };
        }

        return { success: true, result: "Operation completed successfully" };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        childLogger.error({ error }, "MCP action execution failed");

        Sentry.captureException(error, {
            tags: { component: "mcp-gateway", action, server: serverIdentifier },
            extra: { userEmail },
        });

        // Update server status on connection errors (don't let this shadow the original error)
        try {
            await updateMcpServer(server.id, {
                status: "error",
                errorMessage,
            });
        } catch (dbError) {
            childLogger.error({ dbError }, "Failed to update server error status");
        }

        await logMcpEvent({
            userEmail,
            serverIdentifier,
            accountId,
            eventType: "connection_error",
            eventSource: "system",
            errorMessage,
        });

        return {
            success: false,
            error: `Failed to execute '${action}' on '${serverIdentifier}': ${errorMessage}`,
        };
    }
}

/**
 * Create a tool for an MCP server
 */
function createMcpServerTool(server: McpServer, userEmail: string) {
    return tool({
        description: buildToolDescription(server),
        inputSchema: mcpGatewaySchema,
        execute: async ({ action, params }) => {
            const result = await executeMcpAction(
                server.identifier,
                action,
                params,
                userEmail,
                server.accountId
            );

            if (!result.success) {
                return { error: true, message: result.error };
            }

            return result.result;
        },
    });
}

/** Type for MCP gateway tools */
type McpGatewayTool = ReturnType<typeof createMcpServerTool>;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a unique tool name for an MCP server
 *
 * Uses "mcp_" prefix to avoid collisions with built-in tools.
 * Appends accountId for multi-account scenarios (e.g., multiple GitHub accounts).
 */
function getToolName(server: McpServer): string {
    const base = `mcp_${server.identifier}`;
    if (server.accountId && server.accountId !== "default") {
        return `${base}_${server.accountId}`;
    }
    return base;
}

/**
 * Get all MCP gateway tools for a user
 *
 * Returns a Record of tool name → tool that can be spread into streamText's tools option.
 * Each enabled MCP server becomes a single tool using the gateway pattern.
 *
 * Tool names are prefixed with "mcp_" to avoid collisions with built-in tools.
 * For multi-account servers, the accountId is appended (e.g., "mcp_github_work").
 *
 * @param userEmail - User's email address
 *
 * @example
 * ```ts
 * const mcpTools = await getMcpGatewayTools(userEmail);
 * const result = await streamText({
 *     model: openrouter.chat(modelId),
 *     tools: { ...builtInTools, ...mcpTools },
 *     // ...
 * });
 * ```
 */
export async function getMcpGatewayTools(
    userEmail: string
): Promise<Record<string, McpGatewayTool>> {
    const tools: Record<string, McpGatewayTool> = {};

    try {
        // Get user's enabled MCP servers
        const servers = await listEnabledMcpServers(userEmail);

        if (servers.length === 0) {
            return tools;
        }

        // Create a tool for each server
        for (const server of servers) {
            try {
                const toolName = getToolName(server);

                // Check for duplicate tool names (shouldn't happen but log if it does)
                if (tools[toolName]) {
                    logger.warn(
                        { toolName, serverIdentifier: server.identifier, userEmail },
                        "Duplicate MCP tool name - skipping server"
                    );
                    continue;
                }

                tools[toolName] = createMcpServerTool(server, userEmail);
            } catch (error) {
                logger.error(
                    { error, serverIdentifier: server.identifier, userEmail },
                    "Failed to create MCP gateway tool"
                );
            }
        }

        logger.info(
            { userEmail, servers: Object.keys(tools) },
            `MCP gateway tools loaded (${Object.keys(tools).length})`
        );
    } catch (error) {
        logger.error({ error, userEmail }, "Failed to load MCP gateway tools");
        Sentry.captureException(error, {
            tags: { component: "mcp-gateway", operation: "load_tools" },
            extra: { userEmail },
        });
    }

    return tools;
}
