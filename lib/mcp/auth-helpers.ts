/**
 * MCP Server Authentication Helpers
 *
 * Shared utilities for parsing auth configuration from headers.
 */

export interface ParsedAuth {
    authType: "none" | "bearer" | "header";
    token?: string;
    authHeaderName?: string;
}

/**
 * Parse authentication configuration from headers object.
 *
 * Supports:
 * - Bearer tokens: {"Authorization": "Bearer <token>"}
 * - Custom headers: {"X-API-Key": "<key>"} (first header used)
 *
 * @param headers - Key-value pairs of HTTP headers
 * @returns Parsed auth configuration
 */
export function parseAuthHeaders(
    headers: Record<string, string> | undefined
): ParsedAuth {
    if (!headers || Object.keys(headers).length === 0) {
        return { authType: "none" };
    }

    // Check for Bearer token in Authorization header
    const authHeader = headers["Authorization"] || headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
        return {
            authType: "bearer",
            token: authHeader.slice(7), // Remove "Bearer " prefix
        };
    }

    // Use the first header as custom header auth
    const [headerName, headerValue] = Object.entries(headers)[0];
    return {
        authType: "header",
        token: headerValue,
        authHeaderName: headerName,
    };
}
