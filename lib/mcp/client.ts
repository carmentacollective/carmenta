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
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        childLogger.error({ error }, "MCP connection failed");

        Sentry.captureException(error, {
            tags: { component: "mcp-client" },
            extra: { url: config.url },
        });

        return { success: false, error: errorMessage };
    }
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
    return url.toLowerCase().includes("sse") ? "sse" : "http";
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
