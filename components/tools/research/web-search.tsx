"use client";

import { useState } from "react";
import { ArrowSquareOut, CaretDown, CaretUp } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { glass, border } from "@/lib/design-tokens";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ToolRenderer } from "../shared";

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
 * Uses ToolRenderer for consistent collapsed state.
 * Progressive disclosure - click to expand, then expand individual results.
 */
export function WebSearchResults({
    toolCallId,
    status,
    query,
    results,
    error,
}: WebSearchResultsProps) {
    const hasResults = status === "completed" && results && results.length > 0;

    return (
        <ToolRenderer
            toolName="webSearch"
            toolCallId={toolCallId}
            status={status}
            input={{ query }}
            output={results ? { results } : undefined}
            error={error}
        >
            {hasResults && <SearchResultsList results={results} />}
        </ToolRenderer>
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
                                    <span className="text-foreground font-medium">
                                        {item.title}
                                    </span>
                                </div>
                                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
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
                                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1 transition-colors"
                                    aria-label={`Open ${item.title} in new tab`}
                                >
                                    <ArrowSquareOut className="h-3.5 w-3.5" />
                                </a>
                                {isResultExpanded ? (
                                    <CaretUp className="text-muted-foreground h-4 w-4" />
                                ) : (
                                    <CaretDown className="text-muted-foreground h-4 w-4" />
                                )}
                            </div>
                        </button>

                        {/* Expanded snippet */}
                        {isResultExpanded && (
                            <div className="text-muted-foreground animate-in fade-in slide-in-from-top-1 mt-3 border-t border-white/10 pt-3 text-sm duration-150">
                                <MarkdownRenderer content={item.snippet} inline />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
