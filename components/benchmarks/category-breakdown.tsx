"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { CategoryScore, QueryResult } from "@/lib/benchmarks";
import {
    formatCategoryName,
    getWinRateColor,
    getWinRateBarClass,
} from "@/lib/benchmarks";

interface CategoryBreakdownProps {
    categories: CategoryScore[];
    queryResults: QueryResult[];
}

/**
 * Accordion showing performance breakdown by category
 */
export function CategoryBreakdown({
    categories,
    queryResults,
}: CategoryBreakdownProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    // Filter to only show categories with data
    const categoriesWithData = categories.filter((c) => c.total > 0);

    if (categoriesWithData.length === 0) {
        return (
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-6 text-center">
                <p className="text-foreground/70">No category data available yet.</p>
            </div>
        );
    }

    const getQueriesForCategory = (category: string) => {
        return queryResults.filter((qr) => qr.query.category === category);
    };

    return (
        <div className="overflow-hidden rounded-xl border border-foreground/10">
            {categoriesWithData.map((category, idx) => {
                const isExpanded = expandedCategory === category.category;
                const queries = getQueriesForCategory(category.category);
                const isLast = idx === categoriesWithData.length - 1;

                return (
                    <div
                        key={category.category}
                        className={!isLast ? "border-b border-foreground/10" : ""}
                    >
                        <button
                            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-foreground/5"
                            onClick={() =>
                                setExpandedCategory(
                                    isExpanded ? null : category.category
                                )
                            }
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-foreground/40" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-foreground/40" />
                                )}
                                <div>
                                    <span className="font-medium text-foreground">
                                        {formatCategoryName(category.category)}
                                    </span>
                                    <span className="ml-2 text-sm text-foreground/50">
                                        ({queries.length} queries)
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span
                                    className={`font-medium ${getWinRateColor(category.winRate)}`}
                                >
                                    {Math.round(category.winRate * 100)}%
                                </span>
                                <div className="hidden sm:block">
                                    <WinRateBar winRate={category.winRate} />
                                </div>
                                <span className="text-sm text-foreground/50">
                                    <span className="text-green-500">
                                        {category.wins}W
                                    </span>{" "}
                                    /{" "}
                                    <span className="text-red-500">
                                        {category.losses}L
                                    </span>{" "}
                                    /{" "}
                                    <span className="text-yellow-500">
                                        {category.ties}T
                                    </span>
                                </span>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-foreground/5 bg-foreground/[0.02] p-4">
                                <div className="space-y-3">
                                    {queries.map((qr) => (
                                        <QuerySummaryCard
                                            key={qr.query.id}
                                            queryResult={qr}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function QuerySummaryCard({ queryResult }: { queryResult: QueryResult }) {
    const { query, pairwiseResults } = queryResult;

    // Count outcomes
    const wins = pairwiseResults.filter((p) => p.winner === "carmenta").length;
    const losses = pairwiseResults.filter((p) => p.winner === "competitor").length;
    const ties = pairwiseResults.filter((p) => p.winner === "tie").length;

    return (
        <div className="rounded-lg border border-foreground/5 bg-background/50 p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <p className="text-sm leading-relaxed text-foreground">
                        {query.query}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                            {query.difficulty}
                        </span>
                        {query.tags?.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/50"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1">
                        {wins > 0 && (
                            <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                                {wins}W
                            </span>
                        )}
                        {losses > 0 && (
                            <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                                {losses}L
                            </span>
                        )}
                        {ties > 0 && (
                            <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
                                {ties}T
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function WinRateBar({ winRate }: { winRate: number }) {
    return (
        <div className="h-2 w-20 overflow-hidden rounded-full bg-foreground/10">
            <div
                className={`h-full transition-all duration-300 ${getWinRateBarClass(winRate)}`}
                style={{ width: `${winRate * 100}%` }}
            />
        </div>
    );
}
