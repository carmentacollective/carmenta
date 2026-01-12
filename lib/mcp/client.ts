/**
 * MCP Client Utilities
 *
 * URL validation, config parsing, and connection testing.
 * Gateway uses @ai-sdk/mcp directly; these are helper utilities.
 */

import { createMCPClient } from "@ai-sdk/mcp";
import type { Tool } from "ai";

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

export interface McpConnectionResult {
    success: boolean;
    tools?: Array<{ name: string; description?: string }>;
    error?: string;
}

// ============================================================================
// CONNECTION TEST
// ============================================================================

// Connection timeout for MCP server tests (15 seconds)
// Tailscale/remote servers may take time to wake up, but shouldn't exceed this
const CONNECTION_TIMEOUT_MS = 15_000;

export async function testMcpConnection(
    config: McpClientConfig
): Promise<McpConnectionResult> {
    const childLogger = logger.child({
        url: config.url,
        transport: config.transport,
    });

    try {
        childLogger.info("Testing MCP connection");

        const transport: {
            type: "http" | "sse";
            url: string;
            headers?: Record<string, string>;
        } = {
            type: config.transport,
            url: config.url,
        };

        if (config.authType === "bearer" && config.token) {
            transport.headers = { Authorization: `Bearer ${config.token}` };
        } else if (config.authType === "header" && config.headerName && config.token) {
            transport.headers = { [config.headerName]: config.token };
        }

        // Race the connection against a timeout
        const result = await Promise.race([
            connectAndGetTools(transport, childLogger),
            timeoutPromise(CONNECTION_TIMEOUT_MS, config.url),
        ]);

        return result;
    } catch (error) {
        // Humanize timeout/abort errors for better UX
        const errorMessage = humanizeMcpConnectionError(error, config.url);
        childLogger.error({ error }, "MCP connection failed");

        Sentry.captureException(error, {
            tags: { component: "mcp-client" },
            extra: { url: config.url },
        });

        return { success: false, error: errorMessage };
    }
}

/**
 * Perform the actual MCP connection and tool retrieval.
 */
async function connectAndGetTools(
    transport: { type: "http" | "sse"; url: string; headers?: Record<string, string> },
    childLogger: typeof logger
): Promise<McpConnectionResult> {
    const client = await createMCPClient({ transport, name: "Carmenta" });

    try {
        const aiTools = await client.tools();
        const tools = Object.entries(aiTools).map(([name, t]) => ({
            name,
            description: (t as Tool).description,
        }));

        childLogger.info({ toolCount: tools.length }, "MCP connected");
        return { success: true, tools };
    } finally {
        await client.close();
    }
}

/**
 * Promise that rejects after a timeout with a user-friendly error.
 */
function timeoutPromise(ms: number, url: string): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => {
            const hostname = new URL(url).hostname;
            reject(
                new Error(
                    `Connection timed out after ${ms / 1000}s. Check that ${hostname} is accessible.`
                )
            );
        }, ms);
    });
}

/**
 * Convert technical MCP connection errors into user-friendly messages.
 */
function humanizeMcpConnectionError(error: unknown, url: string): string {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // Safe hostname extraction - URL parsing can fail if url is malformed
    const getHostname = (): string => {
        try {
            return new URL(url).hostname;
        } catch {
            return "the server";
        }
    };

    // Timeout/abort errors
    if (
        lowerMessage.includes("terminated") ||
        lowerMessage.includes("timeout") ||
        lowerMessage.includes("aborted") ||
        lowerMessage.includes("body timeout")
    ) {
        return `Server took too long to respond. Check that ${getHostname()} is accessible.`;
    }

    // Connection refused - use "connection" not "connect" to avoid false matches
    if (lowerMessage.includes("econnrefused") || lowerMessage.includes("connection")) {
        return `Cannot connect to server. Check that ${getHostname()} is running.`;
    }

    // DNS/network errors
    if (lowerMessage.includes("enotfound") || lowerMessage.includes("getaddrinfo")) {
        return `Server not found. Check that the URL is correct.`;
    }

    // SSL/TLS errors
    if (
        lowerMessage.includes("cert") ||
        lowerMessage.includes("ssl") ||
        lowerMessage.includes("tls")
    ) {
        return `SSL certificate error. The server's certificate may be invalid.`;
    }

    // Authentication errors
    if (lowerMessage.includes("401") || lowerMessage.includes("unauthorized")) {
        return `Authentication failed. Check your credentials.`;
    }

    // Permission errors
    if (lowerMessage.includes("403") || lowerMessage.includes("forbidden")) {
        return `Access denied. You may not have permission to access this server.`;
    }

    return message;
}

// ============================================================================
// URL UTILITIES
// ============================================================================

export function validateMcpUrl(url: string): { valid: boolean; error?: string } {
    try {
        const parsed = new URL(url);
        const isLocalhost =
            parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

        if (!isLocalhost && parsed.protocol !== "https:") {
            return { valid: false, error: "MCP server URL must use HTTPS" };
        }

        return { valid: true };
    } catch {
        return { valid: false, error: "Invalid URL format" };
    }
}

export function detectTransportType(url: string): "sse" | "http" {
    // Default to HTTP (streamable-http) - SSE is deprecated
    // Only use SSE if URL explicitly contains "sse" (legacy servers)
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("/sse") || lowerUrl.endsWith("/sse")) {
        return "sse";
    }
    return "http";
}

export function parseMcpConfig(input: string): Partial<McpClientConfig> | null {
    const trimmed = input.trim();

    // URL
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        if (validateMcpUrl(trimmed).valid) {
            return {
                url: trimmed,
                transport: detectTransportType(trimmed),
                authType: "none",
            };
        }
    }

    // JSON
    try {
        const parsed = JSON.parse(trimmed);

        if (parsed.url) {
            return {
                url: parsed.url,
                transport: parsed.transport || detectTransportType(parsed.url),
                authType: parsed.authType || parsed.auth?.type || "none",
                token: parsed.token || parsed.auth?.token || parsed.apiKey,
                headerName: parsed.headerName || parsed.auth?.headerName,
            };
        }

        // mcpServers format
        const keys = Object.keys(parsed);
        if (keys.length > 0 && parsed[keys[0]]?.url) {
            const cfg = parsed[keys[0]];
            return {
                url: cfg.url,
                transport: cfg.transport || detectTransportType(cfg.url),
                authType: "none",
            };
        }
    } catch {
        // Not JSON
    }

    return null;
}
