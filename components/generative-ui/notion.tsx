"use client";

/**
 * Notion Tool UI - Visual Search Results
 *
 * Renders Notion search results as clickable page cards for visual clarity.
 * Other actions show compact status via ToolWrapper.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolWrapper } from "./tool-wrapper";
import { NotionSearchResults } from "./notion-search-results";
import type { NotionPageData } from "./notion-page-card";

interface NotionToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Notion tool result using ToolWrapper for consistent status display.
 *
 * - Search action: Shows visual page cards in standard wrapper
 * - Other actions: Compact inline status
 */
export function NotionToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: NotionToolResultProps) {
    // For search action with results, render visual cards in standard wrapper
    // Only show visual content when completed to prevent stale data during running state
    const isSearchWithResults =
        status === "completed" && action === "search" && output?.results;

    if (isSearchWithResults) {
        const results = parseSearchResults(output);
        const query = input.query as string | undefined;
        const totalCount = output.totalCount as number | undefined;

        return (
            <ToolWrapper
                toolName="notion"
                toolCallId={toolCallId}
                status={status}
                input={input}
                output={output}
                error={error}
                variant="standard"
            >
                <NotionSearchResults
                    results={results}
                    query={query}
                    totalCount={totalCount ?? results.length}
                />
            </ToolWrapper>
        );
    }

    // All other actions: compact inline status
    return (
        <ToolWrapper
            toolName="notion"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
            variant="compact"
        />
    );
}

/**
 * Generate a human-readable status message based on action and result.
 * Uses Carmenta voice - warm, specific, and collaborative.
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
                    ? `Finding "${truncate(query, 30)}"...`
                    : "Exploring your workspace...";
            }
            const count = countResults(output);
            return `Found ${count} result${count === 1 ? "" : "s"}`;
        }

        case "get_page": {
            if (isRunning) return "Opening page...";
            const title = extractPageTitle(output);
            return title ? `Page ready: ${truncate(title, 40)}` : "Page ready";
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
            if (isRunning) return "Looking through your database...";
            const count = countResults(output);
            return `Found ${count} entr${count === 1 ? "y" : "ies"}`;
        }

        case "create_database_entry": {
            if (isRunning) return "Creating entry...";
            return "Entry created";
        }

        case "get_database": {
            if (isRunning) return "Opening database...";
            const title = extractDatabaseTitle(output);
            return title ? `Database ready: ${truncate(title, 40)}` : "Database ready";
        }

        case "list_databases": {
            if (isRunning) return "Finding your databases...";
            const count = countResults(output);
            return `Found ${count} database${count === 1 ? "" : "s"}`;
        }

        case "get_block_children": {
            if (isRunning) return "Loading content...";
            const count = countResults(output);
            return `Loaded ${count} block${count === 1 ? "" : "s"}`;
        }

        case "append_block_children": {
            if (isRunning) return "Adding content...";
            return "Content added";
        }

        case "get_user": {
            if (isRunning) return "Finding teammate...";
            const name = extractUserName(output);
            return name ? `Found: ${name}` : "Teammate found";
        }

        case "list_users": {
            if (isRunning) return "Loading team...";
            const count = countResults(output);
            return `Found ${count} teammate${count === 1 ? "" : "s"}`;
        }

        case "describe":
            return isRunning ? "Connecting..." : "Ready";

        case "raw_api": {
            const endpoint = input.endpoint as string | undefined;
            if (isRunning) {
                return endpoint
                    ? `Calling ${truncate(endpoint, 30)}...`
                    : "Calling API...";
            }
            return "Done";
        }

        default:
            return isRunning ? `Working on ${action}...` : "Done";
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
    return text.slice(0, maxLength - 1) + "...";
}

/**
 * Parse Notion search API response into NotionPageData array
 */
function parseSearchResults(output: Record<string, unknown>): NotionPageData[] {
    const results = output.results as Array<{
        id?: string;
        type?: string;
        title?: string;
        url?: string;
        last_edited?: string;
    }>;

    if (!Array.isArray(results)) return [];

    return results.map((item) => ({
        id: item.id || "",
        type: (item.type as "page" | "database") || "page",
        title: item.title || "Untitled",
        url: item.url || "",
        last_edited: item.last_edited,
    }));
}
