"use client";

import { Search, ExternalLink, AlertCircle } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface SearchResultItem {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
}

interface WebSearchResultsProps {
    toolCallId: string;
    status: ToolStatus;
    query: string;
    results?: SearchResultItem[];
    error?: string;
}

/**
 * Tool UI for displaying web search results.
 *
 * Renders search results with title, snippet, and link.
 */
export function WebSearchResults({
    status,
    query,
    results,
    error,
}: WebSearchResultsProps) {
    // Loading state
    if (status === "running") {
        return (
            <div className="glass-card max-w-2xl animate-pulse">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                        Searching for &quot;{query}&quot;...
                    </span>
                </div>
                <div className="mt-4 space-y-3">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="glass-card max-w-2xl border-destructive/50 bg-destructive/10">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                        {error ||
                            `Search for "${query}" didn't come through. Try again?`}
                    </p>
                </div>
            </div>
        );
    }

    // Empty results
    if (!results || results.length === 0) {
        return (
            <div className="glass-card max-w-2xl">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                        No results found for &quot;{query}&quot;
                    </span>
                </div>
            </div>
        );
    }

    // Success state
    return (
        <div className="glass-card max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>
                    {results.length} results for &quot;{query}&quot;
                </span>
            </div>

            <div className="space-y-4">
                {results.map((item, index) => (
                    <div key={index} className="group">
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 text-primary hover:underline"
                        >
                            <span className="font-medium">{item.title}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            <MarkdownRenderer content={item.snippet} inline />
                        </div>
                        {item.publishedDate && (
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                {item.publishedDate}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
