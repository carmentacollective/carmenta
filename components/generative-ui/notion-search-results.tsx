"use client";

/**
 * NotionSearchResults - Grid display for Notion search results
 *
 * Renders search results as a list of clickable page cards.
 * Shows context about the query and total results.
 */

import Image from "next/image";

import { cn } from "@/lib/utils";
import { NotionPageCard, type NotionPageData } from "./notion-page-card";

interface NotionSearchResultsProps {
    results: NotionPageData[];
    /** Total count from API (may be more than displayed) */
    totalCount?: number;
    /** Search query (for display context) */
    query?: string;
    className?: string;
}

/**
 * Display Notion search results in a clean list layout.
 */
export function NotionSearchResults({
    results,
    totalCount,
    query,
    className,
}: NotionSearchResultsProps) {
    if (!results || results.length === 0) {
        return (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Image
                    src="/logos/notion.svg"
                    alt="Notion"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {query ? `No results found for "${query}"` : "No results found"}
                </span>
            </div>
        );
    }

    // Build context message
    const contextMessage = buildContextMessage(results.length, totalCount, query);

    return (
        <div className={cn("space-y-3", className)}>
            {/* Context header */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image
                    src="/logos/notion.svg"
                    alt="Notion"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>{contextMessage}</span>
            </div>

            {/* Results list */}
            <div className="space-y-2">
                {results.slice(0, 5).map((page) => (
                    <NotionPageCard key={page.id} page={page} />
                ))}
            </div>

            {/* Show "more available" hint if truncated */}
            {results.length > 5 && (
                <p className="text-xs text-muted-foreground/70">
                    + {results.length - 5} more result
                    {results.length - 5 > 1 ? "s" : ""}
                </p>
            )}
        </div>
    );
}

/**
 * Build context message for results header
 */
function buildContextMessage(
    count: number,
    totalCount: number | undefined,
    query: string | undefined
): string {
    const actualTotal = totalCount ?? count;

    if (query) {
        return `Found ${actualTotal} result${actualTotal === 1 ? "" : "s"} for "${truncate(query, 30)}"`;
    }
    return `Found ${actualTotal} result${actualTotal === 1 ? "" : "s"}`;
}

function truncate(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "...";
}
