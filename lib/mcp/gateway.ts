/**
 * MCP Gateway
 *
 * Exposes user-configured MCP servers as AI SDK tools using the gateway pattern.
 * Each MCP server becomes a single tool with progressive disclosure:
 *   - action='describe' returns available operations from the server
 *   - Other actions are forwarded as tool calls to the MCP server
 *
 * Uses @ai-sdk/mcp directly for MCP protocol handling.
 */

import { createMCPClient } from "@ai-sdk/mcp";
import * as Sentry from "@sentry/nextjs";
import { tool, type Tool } from "ai";
import { z } from "zod";

import {
    listEnabledMcpServers,
    getMcpServerByIdentifier,
    getMcpServerCredentials,
    updateMcpServer,
    logMcpEvent,
} from "@/lib/db/mcp-servers";
import type { McpServer } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis/client";

// ============================================================================
// TYPES
// ============================================================================

interface McpTool {
    name: string;
    description?: string;
}

interface GetToolsOptions {
    /** Cache TTL in seconds. undefined = no caching. 0 = clear cache. >0 = cache with TTL. */
    ttl?: number;
}

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
// CONSTANTS
// ============================================================================

const TOOLS_CACHE_PREFIX = "mcp:tools:";

// ============================================================================
// MCP CLIENT
// ============================================================================

async function createClient(server: McpServer) {
    const transport: {
        type: "http" | "sse";
        url: string;
        headers?: Record<string, string>;
    } = {
        type: server.transport as "http" | "sse",
        url: server.url,
    };

    if (server.authType !== "none") {
        const credentials = await getMcpServerCredentials(server.id);
        if (!credentials?.token) {
            throw new Error(
                `Authentication required for '${server.identifier}' but credentials are missing. ` +
                    `Re-configure at /integrations/mcp.`
            );
        }

        if (server.authType === "bearer") {
            transport.headers = { Authorization: `Bearer ${credentials.token}` };
        } else if (server.authType === "header" && server.authHeaderName) {
            transport.headers = { [server.authHeaderName]: credentials.token };
        }
    }

    return createMCPClient({ transport, name: "Carmenta" });
}

// ============================================================================
// TOOLS CACHE (Redis)
// ============================================================================

/**
 * Get tools for an MCP server with optional caching.
 *
 * @param server - The MCP server to get tools from
 * @param options.ttl - Cache TTL in seconds. undefined = no caching. 0 = clear cache. >0 = cache with TTL.
 * @returns Array of tools with name and description
 */
export async function getTools(
    server: McpServer,
    options: GetToolsOptions = {}
): Promise<McpTool[]> {
    const { ttl } = options;
    const cacheKey = `${TOOLS_CACHE_PREFIX}${server.id}`;

    // Check cache only if TTL is specified and > 0
    if (ttl !== undefined && ttl > 0) {
        try {
            const redis = await getRedisClient();
            if (redis) {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    logger.debug({ serverId: server.id }, "Tools cache hit");
                    return JSON.parse(cached) as McpTool[];
                }
            }
        } catch (error) {
            logger.warn({ error, serverId: server.id }, "Failed to read tools cache");
        }
    }

    // Fetch fresh from MCP server
    logger.debug({ serverId: server.id, ttl }, "Fetching tools from MCP server");
    const client = await createClient(server);

    try {
        const tools = await client.tools();
        const toolList = Object.entries(tools).map(([name, t]) => ({
            name,
            description: (t as Tool).description,
        }));

        // Handle caching based on TTL
        if (ttl !== undefined) {
            try {
                const redis = await getRedisClient();
                if (redis) {
                    if (ttl > 0) {
                        // Cache with TTL
                        await redis.set(cacheKey, JSON.stringify(toolList), {
                            EX: ttl,
                        });
                        logger.debug(
                            { serverId: server.id, toolCount: toolList.length, ttl },
                            "Tools cached"
                        );
                    } else {
                        // ttl=0 means clear the cache
                        await redis.del(cacheKey);
                        logger.info({ serverId: server.id }, "Tools cache cleared");
                    }
                }
            } catch (error) {
                logger.warn(
                    { error, serverId: server.id },
                    "Failed to update tools cache"
                );
            }
        }

        return toolList;
    } finally {
        await client
            .close()
            .catch((err) =>
                logger.warn({ err, serverId: server.id }, "Failed to close MCP client")
            );
    }
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

async function callTool(
    server: McpServer,
    action: string,
    params: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const client = await createClient(server);

    try {
        const tools = await client.tools();
        const toolNames = Object.keys(tools);

        // Gateway pattern: If server has single tool, always call it with action/params
        // This handles MCP servers that use progressive disclosure (one gateway tool)
        if (toolNames.length === 1) {
            const gatewayToolName = toolNames[0];
            const t = tools[gatewayToolName] as Tool<Record<string, unknown>, unknown>;
            if (!t?.execute) {
                return {
                    success: false,
                    error: `Gateway tool '${gatewayToolName}' not executable`,
                };
            }
            // Pass action and params to the gateway tool
            const result = await t.execute(
                { action, params },
                {
                    toolCallId: crypto.randomUUID(),
                    messages: [],
                }
            );
            return processToolResult(result);
        }

        // Multi-tool server: action IS the tool name
        const t = tools[action] as Tool<Record<string, unknown>, unknown>;
        if (!t?.execute) {
            return { success: false, error: `Tool '${action}' not found` };
        }

        const result = await t.execute(params, {
            toolCallId: crypto.randomUUID(),
            messages: [],
        });

        return processToolResult(result);
    } finally {
        await client
            .close()
            .catch((err) =>
                logger.warn({ err, serverId: server.id }, "Failed to close MCP client")
            );
    }
}

function processToolResult(result: unknown): {
    success: boolean;
    result?: unknown;
    error?: string;
} {
    // Check for MCP tool-level errors
    if (result && typeof result === "object" && "isError" in result && result.isError) {
        const content = "content" in result ? result.content : undefined;
        const errorText = Array.isArray(content)
            ? content
                  .filter((c: any) => c.type === "text")
                  .map((c: any) => c.text)
                  .join("\n")
            : String(result);

        return {
            success: false,
            error: errorText || "Tool execution failed",
        };
    }

    // Parse JSON if possible
    if (typeof result === "string") {
        try {
            return { success: true, result: JSON.parse(result) };
        } catch (parseErr) {
            logger.debug(
                { parseErr, resultPreview: result.slice(0, 100) },
                "MCP result is not JSON, returning as string"
            );
            return { success: true, result };
        }
    }

    return { success: true, result: result ?? "Success" };
}

// ============================================================================
// GATEWAY FUNCTIONS
// ============================================================================

function formatToolsForDescription(tools: McpTool[]): string {
    if (tools.length === 0) return "No tools available from this server.";

    return `Available operations (${tools.length}):\n${tools
        .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`)
        .join("\n")}`;
}

function buildToolDescription(server: McpServer): string {
    const manifest = server.serverManifest as {
        toolCount?: number;
        tools?: string[];
        name?: string;
        description?: string;
    } | null;

    // Single-tool servers (gateway pattern) - use the tool's own description
    // This provides much better semantic matching for the LLM
    if (manifest?.description) {
        return manifest.description;
    }

    const toolCount = manifest?.toolCount ?? 0;
    const topTools = manifest?.tools?.slice(0, 4) ?? [];
    const serverName = manifest?.name ?? server.displayName;

    if (topTools.length > 0) {
        const remaining = toolCount - topTools.length;
        const moreText = remaining > 0 ? ` +${remaining} more` : "";
        return `${serverName}. Top operations: ${topTools.join(", ")}${moreText}. Use action='describe' for full list.`;
    }

    const toolText = toolCount > 0 ? ` (${toolCount} tools)` : "";
    return `${serverName}${toolText}. Use action='describe' to see available operations.`;
}

export async function describeMcpOperations(
    serverIdentifier: string,
    userEmail: string,
    accountId = "default"
): Promise<{ server: string; description: string; tools: McpTool[] }> {
    const childLogger = logger.child({ serverIdentifier, userEmail });

    const server = await getMcpServerByIdentifier(
        userEmail,
        serverIdentifier,
        accountId
    );

    if (!server) {
        return {
            server: serverIdentifier,
            description: `MCP server '${serverIdentifier}' not found. Check /integrations/mcp.`,
            tools: [],
        };
    }

    if (!server.enabled) {
        return {
            server: serverIdentifier,
            description: `MCP server '${serverIdentifier}' is disabled. Enable at /integrations/mcp.`,
            tools: [],
        };
    }

    try {
        const tools = await getTools(server);
        childLogger.info({ toolCount: tools.length }, "Fetched MCP tools");

        // Update cached manifest
        // For single-tool servers (gateway pattern), store the tool description for better LLM matching
        const singleToolDescription =
            tools.length === 1 && tools[0].description
                ? tools[0].description
                : undefined;
        updateMcpServer(server.id, {
            serverManifest: {
                name: server.displayName,
                toolCount: tools.length,
                tools: tools.map((t) => t.name),
                // Single-tool servers use their tool description directly
                description: singleToolDescription,
            },
            status: "connected",
        }).catch((err) => childLogger.error({ err }, "Failed to update manifest"));

        return {
            server: server.displayName,
            description: formatToolsForDescription(tools),
            tools,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        childLogger.error({ error }, "Failed to describe MCP operations");

        updateMcpServer(server.id, { status: "error", errorMessage }).catch((err) =>
            childLogger.error({ err }, "Failed to update server status")
        );

        logMcpEvent({
            userEmail,
            serverIdentifier,
            accountId,
            eventType: "connection_error",
            eventSource: "system",
            errorMessage,
        }).catch((err) => childLogger.error({ err }, "Failed to log MCP event"));

        return {
            server: serverIdentifier,
            description: `Failed to connect to '${serverIdentifier}': ${errorMessage}`,
            tools: [],
        };
    }
}

export async function executeMcpAction(
    serverIdentifier: string,
    action: string,
    params: Record<string, unknown> | undefined,
    userEmail: string,
    accountId = "default"
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const childLogger = logger.child({ serverIdentifier, action, userEmail });

    if (action === "describe") {
        const description = await describeMcpOperations(
            serverIdentifier,
            userEmail,
            accountId
        );
        return { success: true, result: description };
    }

    const server = await getMcpServerByIdentifier(
        userEmail,
        serverIdentifier,
        accountId
    );

    if (!server) {
        return {
            success: false,
            error: `MCP server '${serverIdentifier}' not found. Check /integrations/mcp.`,
        };
    }

    if (!server.enabled) {
        return {
            success: false,
            error: `MCP server '${serverIdentifier}' is disabled. Enable at /integrations/mcp.`,
        };
    }

    try {
        childLogger.debug(
            { paramKeys: Object.keys(params ?? {}) },
            "Executing MCP action"
        );

        const result = await callTool(server, action, params ?? {});

        // Log the result - this is critical for debugging MCP tool failures
        if (result.success) {
            childLogger.info(
                {
                    resultPreview:
                        typeof result.result === "string"
                            ? result.result.slice(0, 200)
                            : JSON.stringify(result.result).slice(0, 200),
                },
                "MCP action succeeded"
            );
            updateMcpServer(server.id, { status: "connected" }).catch((err) =>
                childLogger.error({ err }, "Failed to update server status")
            );
        } else {
            // Tool returned an error (not an exception) - log as warning
            childLogger.warn({ error: result.error }, "MCP action returned error");
        }

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        childLogger.error({ error }, "MCP action failed");

        Sentry.captureException(error, {
            tags: { component: "mcp-gateway", action, server: serverIdentifier },
            extra: { userEmail },
        });

        updateMcpServer(server.id, { status: "error", errorMessage }).catch((err) =>
            childLogger.error({ err }, "Failed to update server status")
        );

        logMcpEvent({
            userEmail,
            serverIdentifier,
            accountId,
            eventType: "connection_error",
            eventSource: "system",
            errorMessage,
        }).catch((err) => childLogger.error({ err }, "Failed to log MCP event"));

        return {
            success: false,
            error: `Failed to execute '${action}' on '${serverIdentifier}': ${errorMessage}`,
        };
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

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

type McpGatewayTool = ReturnType<typeof createMcpServerTool>;

function getToolName(server: McpServer): string {
    const base = `mcp_${server.identifier}`;
    if (server.accountId && server.accountId !== "default") {
        return `${base}_${server.accountId}`;
    }
    return base;
}

export async function getMcpGatewayTools(
    userEmail: string
): Promise<Record<string, McpGatewayTool>> {
    const tools: Record<string, McpGatewayTool> = {};

    try {
        const servers = await listEnabledMcpServers(userEmail);

        logger.debug(
            {
                userEmail,
                serverCount: servers.length,
                serverIdentifiers: servers.map((s) => s.identifier),
            },
            "MCP gateway: servers found"
        );

        if (servers.length === 0) return tools;

        for (const server of servers) {
            try {
                const toolName = getToolName(server);

                if (tools[toolName]) {
                    logger.warn(
                        { toolName, serverIdentifier: server.identifier },
                        "Duplicate MCP tool name - skipping"
                    );
                    continue;
                }

                tools[toolName] = createMcpServerTool(server, userEmail);
            } catch (error) {
                logger.error(
                    { error, serverIdentifier: server.identifier },
                    "Failed to create MCP tool"
                );
            }
        }

        logger.info(
            { userEmail, servers: Object.keys(tools) },
            `MCP gateway: ${Object.keys(tools).length} tools loaded`
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
