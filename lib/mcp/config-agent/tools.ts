/**
 * MCP Configuration Agent Tools
 *
 * Tools for the configuration agent to parse, test, and save MCP server configs.
 * Following the librarian pattern: factory function returns tools bound to user context.
 */

import { tool } from "ai";
import { z } from "zod";

import {
    parseMcpConfig,
    testMcpConnection,
    validateMcpUrl,
    detectTransportType,
    type McpClientConfig,
} from "@/lib/mcp/client";
import {
    createMcpServer,
    listMcpServers,
    getMcpServer,
    updateMcpServer,
    deleteMcpServer,
} from "@/lib/db/mcp-servers";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Creates configuration agent tools bound to a user's email
 */
export function createMcpConfigTools(userEmail: string) {
    const toolLogger = logger.child({ userEmail, component: "mcp-config-agent" });

    return {
        /**
         * Parse configuration from various input formats
         */
        parseConfig: tool({
            description:
                "Parse MCP server configuration from user input. Accepts URLs, JSON configs, or descriptions. Returns extracted configuration or parsing suggestions.",
            inputSchema: z.object({
                input: z
                    .string()
                    .describe("The user's input to parse (URL, JSON, or text)"),
            }),
            execute: async ({ input }) => {
                toolLogger.info({ inputLength: input.length }, "Parsing MCP config");

                try {
                    // Detect local/stdio servers early with helpful message
                    const localServerPatterns = [
                        {
                            pattern: /"transport"\s*:\s*"stdio"/i,
                            type: "stdio transport",
                        },
                        { pattern: /"command"\s*:/i, type: "command-based server" },
                        { pattern: /file:\/\//i, type: "file:// URL" },
                        { pattern: /npx\s+/i, type: "npx command" },
                        { pattern: /node\s+.*\.js/i, type: "Node.js command" },
                        { pattern: /python\s+/i, type: "Python command" },
                    ];

                    for (const { pattern, type } of localServerPatterns) {
                        if (pattern.test(input)) {
                            return {
                                success: false,
                                error: `This looks like a local MCP server (${type})`,
                                suggestion:
                                    "Carmenta only supports remote MCP servers over HTTPS. " +
                                    "Local servers using stdio transport run on your machine and can't be accessed from our cloud. " +
                                    "If your server has an HTTP endpoint, please provide that URL instead.",
                                isLocalServer: true,
                            };
                        }
                    }

                    const config = parseMcpConfig(input);

                    if (config && config.url) {
                        const validation = validateMcpUrl(config.url);
                        if (!validation.valid) {
                            return {
                                success: false,
                                error: validation.error,
                                suggestion: "Check the URL format and try again.",
                            };
                        }

                        // Normalize Claude Desktop's "streamable-http" to "http"
                        // parseMcpConfig's return type is "sse" | "http" | undefined, but raw JSON
                        // input may contain "streamable-http" which we normalize here
                        const normalizedTransport =
                            (config.transport as string) === "streamable-http"
                                ? "http"
                                : config.transport || detectTransportType(config.url);

                        return {
                            success: true,
                            config: {
                                url: config.url,
                                transport: normalizedTransport,
                                authType: config.authType || "none",
                                hasCredentials: !!config.token,
                                token: config.token, // Include token for testConnection/saveServer
                                headerName: config.headerName,
                            },
                        };
                    }

                    // Special handling for Smithery URLs (not yet supported)
                    if (input.includes("smithery.ai")) {
                        return {
                            success: false,
                            error: "Smithery server marketplace not yet supported",
                            suggestion:
                                "Smithery support coming in a future update. For now, please provide the direct MCP server URL from your Smithery deployment.",
                        };
                    }

                    // Check if it looks like a URL but failed parsing
                    if (input.includes("http")) {
                        return {
                            success: false,
                            error: "Could not parse as a valid MCP server URL",
                            suggestion:
                                "Make sure the URL starts with https:// and is complete.",
                        };
                    }

                    // Might be a natural language request
                    return {
                        success: false,
                        error: "Could not extract server configuration",
                        suggestion:
                            "Try pasting the server URL directly, or provide a JSON configuration.",
                        possibleIntent: input.toLowerCase().includes("connect")
                            ? "connection_request"
                            : "unknown",
                    };
                } catch (error) {
                    toolLogger.error({ error }, "Config parsing failed");
                    return {
                        success: false,
                        error: "Failed to parse configuration",
                    };
                }
            },
        }),

        /**
         * Test connection to an MCP server
         */
        testConnection: tool({
            description:
                "Test connection to an MCP server. Returns server info and available tools if successful, or error details if not.",
            inputSchema: z
                .object({
                    url: z.string().describe("The MCP server URL to test"),
                    transport: z
                        .enum(["sse", "http", "streamable-http"])
                        .optional()
                        .describe("Transport type (auto-detected if not provided)"),
                    authType: z
                        .enum(["none", "bearer", "header"])
                        .optional()
                        .describe("Authentication type"),
                    token: z
                        .string()
                        .optional()
                        .describe("Authentication token if required"),
                    headerName: z
                        .string()
                        .optional()
                        .describe("Custom header name for header auth"),
                })
                .transform((data) => ({
                    ...data,
                    // Map Claude Desktop's "streamable-http" to our "http"
                    transport:
                        data.transport === "streamable-http" ? "http" : data.transport,
                })),
            execute: async ({ url, transport, authType, token, headerName }) => {
                toolLogger.info({ url }, "Testing MCP connection");

                try {
                    const validation = validateMcpUrl(url);
                    if (!validation.valid) {
                        return {
                            success: false,
                            error: validation.error,
                        };
                    }

                    const config: McpClientConfig = {
                        url,
                        transport: transport || detectTransportType(url),
                        authType: authType || "none",
                        token,
                        headerName,
                    };

                    const result = await testMcpConnection(config);

                    if (result.success) {
                        return {
                            success: true,
                            toolCount: result.tools?.length ?? 0,
                            tools: result.tools?.slice(0, 10).map((t) => t.name) ?? [],
                            hasMoreTools: (result.tools?.length ?? 0) > 10,
                        };
                    }

                    // Check for auth-related errors
                    const needsAuth =
                        result.error?.includes("401") ||
                        result.error?.includes("Unauthorized");

                    return {
                        success: false,
                        error: result.error,
                        needsAuth,
                        suggestion: needsAuth
                            ? "This server requires authentication. Please provide an API key or token."
                            : "Check that the server is running and the URL is correct.",
                    };
                } catch (error) {
                    toolLogger.error({ error, url }, "Connection test failed");
                    Sentry.captureException(error, {
                        tags: {
                            component: "mcp-config-agent",
                            action: "test-connection",
                        },
                    });
                    return {
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Connection test failed",
                    };
                }
            },
        }),

        /**
         * Save a validated server configuration
         */
        saveServer: tool({
            description:
                "Save a validated MCP server configuration. Only call this after testConnection succeeds.",
            inputSchema: z
                .object({
                    url: z.string().describe("The MCP server URL"),
                    displayName: z
                        .string()
                        .describe("User-friendly name for the server"),
                    identifier: z
                        .string()
                        .describe(
                            "Unique identifier (lowercase, no spaces, e.g., 'github-mcp')"
                        ),
                    transport: z.enum(["sse", "http", "streamable-http"]).optional(),
                    authType: z.enum(["none", "bearer", "header"]).optional(),
                    token: z
                        .string()
                        .optional()
                        .describe("Authentication token (will be encrypted)"),
                    headerName: z.string().optional(),
                    serverName: z
                        .string()
                        .optional()
                        .describe("Server name from manifest"),
                    toolCount: z
                        .number()
                        .optional()
                        .describe("Number of tools discovered"),
                })
                .transform((data) => ({
                    ...data,
                    // Map Claude Desktop's "streamable-http" to our "http"
                    transport:
                        data.transport === "streamable-http" ? "http" : data.transport,
                })),
            execute: async ({
                url,
                displayName,
                identifier,
                transport,
                authType,
                token,
                headerName,
                serverName,
                toolCount,
            }) => {
                toolLogger.info({ identifier, url }, "Saving MCP server");

                try {
                    const server = await createMcpServer({
                        userEmail,
                        identifier: identifier.toLowerCase().replace(/\s+/g, "-"),
                        displayName,
                        url,
                        transport: transport || detectTransportType(url),
                        authType: authType || "none",
                        credentials: token ? { token } : undefined,
                        authHeaderName: headerName,
                        serverManifest: serverName
                            ? {
                                  name: serverName,
                                  toolCount: toolCount ?? 0,
                              }
                            : undefined,
                    });

                    return {
                        success: true,
                        serverId: server.id,
                        message: `Saved "${displayName}" configuration`,
                    };
                } catch (error) {
                    toolLogger.error({ error, identifier }, "Failed to save server");
                    Sentry.captureException(error, {
                        tags: { component: "mcp-config-agent", action: "save-server" },
                    });

                    // Check for duplicate
                    if (
                        error instanceof Error &&
                        error.message.includes("unique constraint")
                    ) {
                        return {
                            success: false,
                            error: "A server with this identifier already exists",
                            suggestion:
                                "Use a different identifier or update the existing configuration.",
                        };
                    }

                    return {
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Failed to save server",
                    };
                }
            },
        }),

        /**
         * List all configured servers
         */
        listServers: tool({
            description: "List all MCP servers configured for this user",
            inputSchema: z.object({}),
            execute: async () => {
                toolLogger.info("Listing MCP servers");

                try {
                    const servers = await listMcpServers(userEmail);

                    if (servers.length === 0) {
                        return {
                            success: true,
                            servers: [],
                            message: "No MCP servers configured yet.",
                        };
                    }

                    return {
                        success: true,
                        servers: servers.map((s) => ({
                            id: s.id,
                            identifier: s.identifier,
                            displayName: s.displayName,
                            url: s.url,
                            status: s.status,
                            enabled: s.enabled,
                            toolCount: s.serverManifest?.toolCount ?? 0,
                            lastConnected: s.lastConnectedAt?.toISOString(),
                        })),
                    };
                } catch (error) {
                    toolLogger.error({ error }, "Failed to list servers");
                    return {
                        success: false,
                        error: "Failed to list servers",
                    };
                }
            },
        }),

        /**
         * Remove a server configuration
         */
        removeServer: tool({
            description: "Remove an MCP server configuration",
            inputSchema: z.object({
                serverId: z.number().describe("The server ID to remove"),
            }),
            execute: async ({ serverId }) => {
                toolLogger.info({ serverId }, "Removing MCP server");

                try {
                    const server = await getMcpServer(serverId);
                    if (!server) {
                        return {
                            success: false,
                            error: "Server not found",
                        };
                    }

                    // Verify ownership
                    if (server.userEmail !== userEmail) {
                        return {
                            success: false,
                            error: "You don't have permission to remove this server",
                        };
                    }

                    await deleteMcpServer(serverId);

                    return {
                        success: true,
                        message: `Removed "${server.displayName}"`,
                    };
                } catch (error) {
                    toolLogger.error({ error, serverId }, "Failed to remove server");
                    return {
                        success: false,
                        error: "Failed to remove server",
                    };
                }
            },
        }),

        /**
         * Update server configuration
         */
        updateServer: tool({
            description: "Update an existing MCP server configuration",
            inputSchema: z.object({
                serverId: z.number().describe("The server ID to update"),
                displayName: z.string().optional(),
                enabled: z.boolean().optional(),
                token: z.string().optional().describe("New authentication token"),
            }),
            execute: async ({ serverId, displayName, enabled, token }) => {
                toolLogger.info({ serverId }, "Updating MCP server");

                try {
                    const server = await getMcpServer(serverId);
                    if (!server) {
                        return {
                            success: false,
                            error: "Server not found",
                        };
                    }

                    // Verify ownership
                    if (server.userEmail !== userEmail) {
                        return {
                            success: false,
                            error: "You don't have permission to update this server",
                        };
                    }

                    await updateMcpServer(serverId, {
                        displayName,
                        enabled,
                        credentials: token ? { token } : undefined,
                    });

                    return {
                        success: true,
                        message: `Updated "${server.displayName}"`,
                    };
                } catch (error) {
                    toolLogger.error({ error, serverId }, "Failed to update server");
                    return {
                        success: false,
                        error: "Failed to update server",
                    };
                }
            },
        }),
    };
}

export type McpConfigTools = ReturnType<typeof createMcpConfigTools>;
