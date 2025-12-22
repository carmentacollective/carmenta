"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { glass, border } from "@/lib/design-tokens";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ToolWrapper } from "./tool-wrapper";

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
 * Uses ToolWrapper for consistent status display.
 * Progressive disclosure design - expand individual results to see snippets.
 */
export function WebSearchResults({
    toolCallId,
    status,
    query,
    results,
    error,
}: WebSearchResultsProps) {
    // Use compact wrapper for inline status, standard when we have results
    // Only show visual content when completed to prevent stale data during running state
    const hasResults = status === "completed" && results && results.length > 0;
    const variant = hasResults ? "standard" : "compact";

    return (
        <ToolWrapper
            toolName="webSearch"
            toolCallId={toolCallId}
            status={status}
            input={{ query }}
            output={results ? { results } : undefined}
            error={error}
            variant={variant}
        >
            {hasResults && <SearchResultsList results={results} />}
        </ToolWrapper>
    );
}

/**
 * Renders the list of search results with expandable snippets.
 */
function SearchResultsList({ results }: { results: SearchResultItem[] }) {
    const [expandedResultIndex, setExpandedResultIndex] = useState<number | null>(null);

    return (
        <div className="max-w-2xl space-y-2">
            {results.map((item, index) => {
                const domain = extractDomain(item.url);
                const isResultExpanded = expandedResultIndex === index;

                return (
                    <div
                        key={index}
                        className={cn(
                            "rounded-lg p-3 transition-all",
                            glass.subtle,
                            border.container,
                            "hover:border-border/60"
                        )}
                    >
                        <button
                            onClick={() =>
                                setExpandedResultIndex(isResultExpanded ? null : index)
                            }
                            className="flex w-full items-start gap-3 text-left"
                        >
                            <div className="flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-medium text-foreground">
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
                            <div className="mt-3 border-t border-white/10 pt-3 text-sm text-muted-foreground duration-150 animate-in fade-in slide-in-from-top-1">
                                <MarkdownRenderer content={item.snippet} inline />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
