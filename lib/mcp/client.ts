/**
 * MCP Client - Remote Server Connection
 *
 * Connects to remote MCP servers via SSE or Streamable HTTP transport.
 * Phase 1: No auth or bearer token auth only.
 *
 * Based on MCP 2025-03-26 specification.
 */

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

// ============================================================================
// TYPES
// ============================================================================

export interface McpClientConfig {
    url: string;
    transport: "sse" | "http";
    authType: "none" | "bearer" | "header";
    token?: string;
    headerName?: string;
}

export interface McpTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

export interface McpServerInfo {
    name: string;
    version?: string;
    protocolVersion?: string;
}

export interface McpServerCapabilities {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
}

export interface McpInitializeResult {
    serverInfo: McpServerInfo;
    capabilities: McpServerCapabilities;
}

export interface McpToolsListResult {
    tools: McpTool[];
}

export interface McpToolCallResult {
    content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

export interface McpConnectionResult {
    success: boolean;
    serverInfo?: McpServerInfo;
    tools?: McpTool[];
    error?: string;
}

// ============================================================================
// MCP CLIENT
// ============================================================================

/**
 * Creates authorization headers for MCP requests
 */
function createAuthHeaders(config: McpClientConfig): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (config.authType === "bearer" && config.token) {
        headers["Authorization"] = `Bearer ${config.token}`;
    } else if (config.authType === "header" && config.headerName && config.token) {
        headers[config.headerName] = config.token;
    }

    return headers;
}

/**
 * Makes an MCP JSON-RPC request
 */
async function mcpRequest<T>(
    config: McpClientConfig,
    method: string,
    params?: Record<string, unknown>
): Promise<T> {
    const headers = createAuthHeaders(config);
    const requestId = Math.random().toString(36).slice(2);

    const body = {
        jsonrpc: "2.0",
        id: requestId,
        method,
        params: params ?? {},
    };

    try {
        const response = await fetch(config.url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            throw new Error(
                `MCP request failed: ${response.status} ${response.statusText}`
            );
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "MCP request error");
        }

        return result.result as T;
    } catch (error) {
        // Provide clearer error messages for common failures
        if (error instanceof Error && error.name === "TimeoutError") {
            throw new Error("Connection timed out after 30 seconds");
        }
        if (error instanceof Error && error.name === "TypeError") {
            throw new Error(
                "Failed to connect to MCP server. Check the URL is correct."
            );
        }
        throw error;
    }
}

/**
 * Initializes connection to an MCP server
 */
export async function initializeMcpConnection(
    config: McpClientConfig
): Promise<McpInitializeResult> {
    return mcpRequest<McpInitializeResult>(config, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
            roots: { listChanged: false },
        },
        clientInfo: {
            name: "Carmenta",
            version: "1.0.0",
        },
    });
}

/**
 * Sends initialized notification to complete handshake
 */
export async function sendInitializedNotification(
    config: McpClientConfig
): Promise<void> {
    const headers = createAuthHeaders(config);

    const body = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
    };

    await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
    });
}

/**
 * Lists available tools from the MCP server
 */
export async function listMcpTools(config: McpClientConfig): Promise<McpTool[]> {
    const result = await mcpRequest<McpToolsListResult>(config, "tools/list");
    return result.tools ?? [];
}

/**
 * Calls a tool on the MCP server
 */
export async function callMcpTool(
    config: McpClientConfig,
    toolName: string,
    args: Record<string, unknown>
): Promise<McpToolCallResult> {
    return mcpRequest<McpToolCallResult>(config, "tools/call", {
        name: toolName,
        arguments: args,
    });
}

/**
 * Tests connection to an MCP server and returns server info + tools
 */
export async function testMcpConnection(
    config: McpClientConfig
): Promise<McpConnectionResult> {
    const childLogger = logger.child({
        url: config.url,
        transport: config.transport,
        authType: config.authType,
    });

    try {
        childLogger.info("Testing MCP server connection");

        // Initialize connection
        const initResult = await initializeMcpConnection(config);
        childLogger.info(
            { serverInfo: initResult.serverInfo },
            "MCP server initialized"
        );

        // Send initialized notification
        await sendInitializedNotification(config);

        // List tools if server supports them
        let tools: McpTool[] = [];
        if (initResult.capabilities?.tools) {
            tools = await listMcpTools(config);
            childLogger.info({ toolCount: tools.length }, "Listed MCP tools");
        }

        return {
            success: true,
            serverInfo: initResult.serverInfo,
            tools,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        childLogger.error({ error }, "MCP connection test failed");

        Sentry.captureException(error, {
            tags: { component: "mcp-client", action: "test-connection" },
            extra: { url: config.url, authType: config.authType },
        });

        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Validates an MCP server URL
 */
export function validateMcpUrl(url: string): { valid: boolean; error?: string } {
    try {
        const parsed = new URL(url);

        // Must be HTTPS in production (allow HTTP for localhost)
        const isLocalhost =
            parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        if (!isLocalhost && parsed.protocol !== "https:") {
            return { valid: false, error: "MCP server URL must use HTTPS" };
        }

        // Check for common MCP endpoints
        const hasValidPath =
            parsed.pathname.includes("/sse") ||
            parsed.pathname.includes("/mcp") ||
            parsed.pathname === "/" ||
            parsed.pathname.endsWith("/");

        if (!hasValidPath) {
            // Warn but don't fail - some servers use different paths
            logger.warn({ url }, "MCP URL has unusual path, may not be valid");
        }

        return { valid: true };
    } catch {
        return { valid: false, error: "Invalid URL format" };
    }
}

/**
 * Detects transport type from URL
 */
export function detectTransportType(url: string): "sse" | "http" {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("/sse") || lowerUrl.includes("sse")) {
        return "sse";
    }
    return "http";
}

/**
 * Parses MCP configuration from various input formats
 */
export function parseMcpConfig(input: string): Partial<McpClientConfig> | null {
    const trimmed = input.trim();

    // Try as URL
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const validation = validateMcpUrl(trimmed);
        if (validation.valid) {
            return {
                url: trimmed,
                transport: detectTransportType(trimmed),
                authType: "none",
            };
        }
    }

    // Try as JSON
    try {
        const parsed = JSON.parse(trimmed);

        // Standard MCP config format
        if (parsed.url) {
            return {
                url: parsed.url,
                transport: parsed.transport || detectTransportType(parsed.url),
                authType: parsed.authType || parsed.auth?.type || "none",
                token: parsed.token || parsed.auth?.token || parsed.apiKey,
                headerName: parsed.headerName || parsed.auth?.headerName,
            };
        }

        // mcpServers format (like Cursor/Claude Desktop)
        const serverKeys = Object.keys(parsed);
        if (serverKeys.length > 0 && parsed[serverKeys[0]]?.url) {
            const serverConfig = parsed[serverKeys[0]];
            return {
                url: serverConfig.url,
                transport:
                    serverConfig.transport || detectTransportType(serverConfig.url),
                authType: "none",
            };
        }
    } catch {
        // Not valid JSON
    }

    // Try as Smithery URL
    if (trimmed.includes("smithery.ai/server/")) {
        // Extract server ID from Smithery URL
        const match = trimmed.match(/smithery\.ai\/server\/(@?[\w-]+\/[\w-]+)/);
        if (match) {
            logger.info({ smitheryId: match[1] }, "Detected Smithery server URL");
            // Return partial config - agent will need to resolve the actual URL
            return {
                authType: "none",
            };
        }
    }

    return null;
}
