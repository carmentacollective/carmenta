"use client";

import { useState } from "react";
import {
    Search,
    ExternalLink,
    AlertCircle,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

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

function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

/**
 * Tool UI for displaying web search results.
 *
 * Progressive disclosure design - collapsed by default, expand to see results.
 */
export function WebSearchResults({
    status,
    query,
    results,
    error,
}: WebSearchResultsProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedResultIndex, setExpandedResultIndex] = useState<number | null>(null);

    // Loading state - minimal and elegant
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4 animate-pulse" />
                <span>Exploring the web for &quot;{query}&quot;...</span>
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
                            `We couldn't reach the web for "${query}". Let's try that again.`}
                    </p>
                </div>
            </div>
        );
    }

    // Empty results
    if (!results || results.length === 0) {
        return (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>
                    Nothing came up for &quot;{query}&quot;. Want to try a different
                    search?
                </span>
            </div>
        );
    }

    // Success state - collapsed by default
    return (
        <div className="max-w-2xl">
            {/* Collapsed summary - always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="group flex w-full items-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <Search className="h-4 w-4 flex-shrink-0" />
                <span>
                    We found {results.length}{" "}
                    {results.length === 1 ? "result" : "results"} for &quot;{query}
                    &quot;
                </span>
                {isExpanded ? (
                    <ChevronUp className="ml-auto h-4 w-4 flex-shrink-0" />
                ) : (
                    <ChevronDown className="ml-auto h-4 w-4 flex-shrink-0" />
                )}
            </button>

            {/* Expanded results - progressive disclosure */}
            {isExpanded && (
                <div className="mt-3 space-y-2 duration-200 animate-in fade-in slide-in-from-top-2">
                    {results.map((item, index) => {
                        const domain = extractDomain(item.url);
                        const isResultExpanded = expandedResultIndex === index;

                        return (
                            <div
                                key={index}
                                className="glass-card transition-all hover:border-border/60"
                            >
                                <button
                                    onClick={() =>
                                        setExpandedResultIndex(
                                            isResultExpanded ? null : index
                                        )
                                    }
                                    className="flex w-full items-start gap-3 text-left"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-medium text-foreground group-hover:text-primary">
                                                {item.title}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{domain}</span>
                                            {item.publishedDate && (
                                                <>
                                                    <span>·</span>
                                                    <span>{item.publishedDate}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                            aria-label={`Open ${item.title} in new tab`}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                        {isResultExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {/* Expanded snippet */}
                                {isResultExpanded && (
                                    <div className="mt-3 border-t pt-3 text-sm text-muted-foreground duration-150 animate-in fade-in slide-in-from-top-1">
                                        <MarkdownRenderer
                                            content={item.snippet}
                                            inline
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
