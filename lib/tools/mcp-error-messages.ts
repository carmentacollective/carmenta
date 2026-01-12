/**
 * MCP Error Message Formatting
 *
 * Humanizes MCP server errors into actionable, user-friendly messages.
 * Transforms technical errors like "ECONNREFUSED" into "Server not responding".
 */

/**
 * Common error patterns and their human-readable messages.
 * Keys are substring matches or regex patterns.
 */
const ERROR_PATTERNS: Array<{
    pattern: string | RegExp;
    message: string;
    action?: string;
}> = [
    // Connection errors
    {
        pattern: "ECONNREFUSED",
        message: "Server not responding",
        action: "Check that the MCP server is running",
    },
    {
        pattern: "ETIMEDOUT",
        message: "Request timed out",
        action: "The server took too long to respond",
    },
    {
        pattern: "ENOTFOUND",
        message: "Server not found",
        action: "Check the server URL configuration",
    },
    {
        pattern: "ECONNRESET",
        message: "Connection was reset",
        action: "The server closed the connection unexpectedly",
    },

    // HTTP status codes
    {
        pattern: /\b401\b/,
        message: "Authentication required",
        action: "Check your API credentials",
    },
    {
        pattern: /\b403\b/,
        message: "Access denied",
        action: "You don't have permission for this action",
    },
    {
        pattern: /\b404\b/,
        message: "Resource not found",
        action: "The requested item doesn't exist",
    },
    {
        pattern: /\b429\b/,
        message: "Rate limited",
        action: "Too many requests - try again in a moment",
    },
    {
        pattern: /\b500\b/,
        message: "Server error",
        action: "The service is having issues",
    },
    {
        pattern: /\b502\b|bad gateway/i,
        message: "Service unavailable",
        action: "The upstream service is down",
    },
    {
        pattern: /\b503\b|service unavailable/i,
        message: "Service temporarily unavailable",
        action: "Try again in a moment",
    },

    // Auth errors
    {
        pattern: /unauthorized|invalid.*token|expired.*token/i,
        message: "Authentication expired",
        action: "Reconnect the integration",
    },
    {
        pattern: /invalid.*credentials|auth.*failed/i,
        message: "Invalid credentials",
        action: "Check your authentication settings",
    },

    // Common API errors
    {
        pattern: /rate.*limit/i,
        message: "Rate limited",
        action: "The service needs a break - try again shortly",
    },
    {
        pattern: /quota.*exceeded/i,
        message: "Quota exceeded",
        action: "You've hit a usage limit",
    },
    {
        pattern: /not.*found|does.*not.*exist/i,
        message: "Not found",
    },
    {
        pattern: /permission.*denied|access.*denied/i,
        message: "Permission denied",
    },
];

export interface FormattedError {
    /** Human-readable error message */
    message: string;
    /** Optional actionable hint */
    action?: string;
    /** The original raw error for debugging */
    raw: string;
}

/**
 * Format an MCP error into a human-readable message.
 *
 * @param error - Raw error string from MCP server
 * @param serverName - Name of the MCP server (for context)
 * @returns Formatted error with message and optional action
 */
export function formatMcpError(error: string, serverName?: string): FormattedError {
    const raw = error;

    // Try to match against known patterns
    for (const { pattern, message, action } of ERROR_PATTERNS) {
        const matches =
            typeof pattern === "string" ? error.includes(pattern) : pattern.test(error);

        if (matches) {
            return {
                message: serverName ? `${serverName}: ${message}` : message,
                action,
                raw,
            };
        }
    }

    // Strip stack traces for cleaner display
    const cleanedError = stripStackTrace(error);

    // If the error is very long, truncate it
    const truncatedError =
        cleanedError.length > 150 ? cleanedError.slice(0, 147) + "..." : cleanedError;

    return {
        message: serverName ? `${serverName} error: ${truncatedError}` : truncatedError,
        raw,
    };
}

/**
 * Strip stack traces from error messages for cleaner display.
 */
function stripStackTrace(error: string): string {
    // Remove everything after "at " indicating a stack trace
    const atIndex = error.indexOf("\n    at ");
    if (atIndex > 0) {
        return error.slice(0, atIndex).trim();
    }

    // Remove lines that look like stack frames
    const lines = error.split("\n");
    const nonStackLines = lines.filter(
        (line) => !line.trim().startsWith("at ") && !line.includes("(node:")
    );

    return nonStackLines.join("\n").trim();
}

/**
 * Extract server name from MCP tool name.
 * Handles both `mcp_server` and `mcp-server` patterns.
 *
 * @param toolName - Full tool name (e.g., "mcp_github", "mcp-slack")
 * @returns Server name (e.g., "GitHub", "Slack")
 */
export function getMcpServerName(toolName: string): string {
    const serverKey = toolName.replace(/^mcp[_-]/, "");

    // Capitalize known server names nicely
    const prettyNames: Record<string, string> = {
        github: "GitHub",
        slack: "Slack",
        notion: "Notion",
        dropbox: "Dropbox",
        "google-calendar-contacts": "Google Calendar",
        "google-drive": "Google Drive",
        "google-photos": "Google Photos",
        gmail: "Gmail",
        twitter: "Twitter",
        "twitter-x": "X",
        spotify: "Spotify",
        clickup: "ClickUp",
        fireflies: "Fireflies",
        limitless: "Limitless",
        coinmarketcap: "CoinMarketCap",
        giphy: "Giphy",
        miro: "Miro",
        linkedin: "LinkedIn",
        sentry: "Sentry",
        exa: "Exa",
        context7: "Context7",
        math: "Math",
        memory: "Memory",
        // MCP Hubby unified gateway
        "MCP-Hubby": "MCP Hub",
    };

    return prettyNames[serverKey] || capitalize(serverKey);
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
