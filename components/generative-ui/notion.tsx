"use client";

/**
 * Notion Tool UI - Compact Status Display
 *
 * Notion results are intermediate data the AI processes. The user cares about
 * the AI's synthesized response, not raw API output. This component shows
 * minimal status: what happened, with optional expansion for debugging.
 */

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolIcon } from "./tool-icon";

interface NotionToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Compact Notion tool result.
 * Shows a single line summary with optional raw data expansion.
 */
export function NotionToolResult({
    status,
    action,
    input,
    output,
    error,
}: NotionToolResultProps) {
    const [expanded, setExpanded] = useState(false);

    // Loading state - single line with pulse animation
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <ToolIcon toolName="notion" className="h-3.5 w-3.5 animate-pulse" />
                <span>{getStatusMessage(action, input, "running")}</span>
            </div>
        );
    }

    // Error state - red text, clear message
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error || `Notion ${action} failed`}</span>
            </div>
        );
    }

    // Success - compact summary with optional JSON expansion
    const summary = getStatusMessage(action, input, "completed", output);

    return (
        <div className="py-1">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ToolIcon toolName="notion" className="h-3.5 w-3.5" />
                <span className="flex-1">{summary}</span>
                {output &&
                    (expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                    ))}
            </button>

            {expanded && output && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(output, null, 2)}
                </pre>
            )}
        </div>
    );
}

/**
 * Generate a human-readable status message based on action and result.
 * Uses Notion-aware language that feels natural for workspace operations.
 */
function getStatusMessage(
    action: string,
    input: Record<string, unknown>,
    status: "running" | "completed",
    output?: Record<string, unknown>
): string {
    const isRunning = status === "running";

    switch (action) {
        case "search": {
            const query = input.query as string | undefined;
            if (isRunning) {
                return query
                    ? `Searching for "${truncate(query, 30)}"...`
                    : "Searching Notion...";
            }
            const count = countResults(output);
            return `Found ${count} result${count === 1 ? "" : "s"}`;
        }

        case "get_page": {
            if (isRunning) return "Loading page...";
            const title = extractPageTitle(output);
            return title ? `Loaded: ${truncate(title, 40)}` : "Page loaded";
        }

        case "create_page": {
            if (isRunning) return "Creating page...";
            const title = extractPageTitle(output);
            return title ? `Created: ${truncate(title, 40)}` : "Page created";
        }

        case "update_page": {
            if (isRunning) return "Updating page...";
            const title = extractPageTitle(output);
            return title ? `Updated: ${truncate(title, 40)}` : "Page updated";
        }

        case "query_database": {
            if (isRunning) return "Querying database...";
            const count = countResults(output);
            return `Found ${count} entr${count === 1 ? "y" : "ies"}`;
        }

        case "create_database_entry": {
            if (isRunning) return "Creating entry...";
            return "Entry created";
        }

        case "get_database": {
            if (isRunning) return "Loading database...";
            const title = extractDatabaseTitle(output);
            return title ? `Loaded: ${truncate(title, 40)}` : "Database loaded";
        }

        case "list_databases": {
            if (isRunning) return "Listing databases...";
            const count = countResults(output);
            return `Found ${count} database${count === 1 ? "" : "s"}`;
        }

        case "get_block_children": {
            if (isRunning) return "Loading blocks...";
            const count = countResults(output);
            return `Loaded ${count} block${count === 1 ? "" : "s"}`;
        }

        case "append_block_children": {
            if (isRunning) return "Adding content...";
            return "Content added";
        }

        case "get_user": {
            if (isRunning) return "Loading user...";
            const name = extractUserName(output);
            return name ? `Loaded: ${name}` : "User loaded";
        }

        case "list_users": {
            if (isRunning) return "Loading team...";
            const count = countResults(output);
            return `Loaded ${count} member${count === 1 ? "" : "s"}`;
        }

        case "describe":
            return isRunning ? "Checking capabilities..." : "Capabilities loaded";

        case "raw_api": {
            const endpoint = input.endpoint as string;
            if (isRunning) return `Calling ${truncate(endpoint, 30)}...`;
            return "API call complete";
        }

        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}

/**
 * Count results in the response data
 */
function countResults(output?: Record<string, unknown>): number {
    if (!output) return 0;

    // Check common result array locations
    if (Array.isArray(output.results)) return output.results.length;
    if (Array.isArray(output.data)) return output.data.length;
    if (output.results && typeof output.results === "object") {
        return Object.keys(output.results).length;
    }

    return 0;
}

/**
 * Extract page title from Notion page response
 */
function extractPageTitle(output?: Record<string, unknown>): string | undefined {
    if (!output) return undefined;

    // Try to get title from properties.title or properties.Name
    const properties = output.properties as Record<string, unknown> | undefined;
    if (properties) {
        const titleProp =
            properties.title || properties.Title || properties.Name || properties.name;
        if (titleProp && typeof titleProp === "object") {
            const titleObj = titleProp as { title?: Array<{ plain_text?: string }> };
            if (Array.isArray(titleObj.title) && titleObj.title[0]?.plain_text) {
                return titleObj.title[0].plain_text;
            }
        }
    }

    // Try direct title array (some responses)
    if (Array.isArray(output.title)) {
        const firstTitle = output.title[0] as { plain_text?: string } | undefined;
        if (firstTitle?.plain_text) return firstTitle.plain_text;
    }

    return undefined;
}

/**
 * Extract database title from Notion database response
 */
function extractDatabaseTitle(output?: Record<string, unknown>): string | undefined {
    if (!output) return undefined;

    // Database title is usually in title array
    if (Array.isArray(output.title)) {
        const firstTitle = output.title[0] as { plain_text?: string } | undefined;
        if (firstTitle?.plain_text) return firstTitle.plain_text;
    }

    return undefined;
}

/**
 * Extract user name from Notion user response
 */
function extractUserName(output?: Record<string, unknown>): string | undefined {
    if (!output) return undefined;

    if (typeof output.name === "string") return output.name;

    // Sometimes wrapped in data
    const data = output.data as { name?: string } | undefined;
    if (data?.name) return data.name;

    return undefined;
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
