"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Search, ExternalLink, AlertCircle } from "lucide-react";

interface WebSearchArgs {
    query: string;
    maxResults?: number;
}

interface SearchResultItem {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
}

interface WebSearchResult {
    error: boolean;
    message?: string;
    results: SearchResultItem[];
    query: string;
}

/**
 * Tool UI for displaying web search results.
 *
 * Renders when the AI calls the webSearch tool, showing:
 * - Search query
 * - List of results with title, snippet, and link
 */
export const WebSearchToolUI = makeAssistantToolUI<WebSearchArgs, WebSearchResult>({
    toolName: "webSearch",
    render: ({ args, result, status }) => {
        // Loading state
        if (status.type === "running") {
            return (
                <div className="glass-card max-w-2xl animate-pulse">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                            Searching for &quot;{args.query}&quot;...
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

        // Error/incomplete state
        if (status.type === "incomplete" || !result || result.error) {
            return (
                <div className="glass-card max-w-2xl border-destructive/50 bg-destructive/10">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <p className="text-sm text-destructive">
                            {result?.message ||
                                `Search for "${args.query}" didn't come through. Try again?`}
                        </p>
                    </div>
                </div>
            );
        }

        // Empty results
        if (result.results.length === 0) {
            return (
                <div className="glass-card max-w-2xl">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                            No results found for &quot;{args.query}&quot;
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
                        {result.results.length} results for &quot;{result.query}&quot;
                    </span>
                </div>

                <div className="space-y-4">
                    {result.results.map((item, index) => (
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
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {item.snippet}
                            </p>
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
    },
});
