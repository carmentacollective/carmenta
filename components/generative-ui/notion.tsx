"use client";

/**
 * Notion Tool UI - Visual Search Results
 *
 * Renders Notion search results as clickable page cards for visual clarity.
 * Uses ToolRenderer for consistent collapsed state.
 */

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";
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
 * Notion tool result using ToolRenderer for consistent collapsed state.
 *
 * - Search action: Expands to show visual page cards
 * - Other actions: Collapsed status only
 */
export function NotionToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: NotionToolResultProps) {
    const hasSearchResults =
        status === "completed" && action === "search" && Boolean(output?.results);

    const results = hasSearchResults ? parseSearchResults(output!) : [];
    const query = input.query as string | undefined;
    const totalCount = output?.totalCount as number | undefined;

    return (
        <ToolRenderer
            toolName="notion"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {hasSearchResults && (
                <NotionSearchResults
                    results={results}
                    query={query}
                    totalCount={totalCount ?? results.length}
                />
            )}
        </ToolRenderer>
    );
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
