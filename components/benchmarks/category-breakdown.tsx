"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

import type { CategoryScore, QueryResult } from "@/lib/benchmarks/types";
import {
    formatCategoryName,
    getWinRateColor,
    getWinRateBarClass,
} from "@/lib/benchmarks/utils";

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
            <div className="border-foreground/10 bg-foreground/5 rounded-xl border p-6 text-center">
                <p className="text-foreground/70">No category data available yet.</p>
            </div>
        );
    }

    const getQueriesForCategory = (category: string) => {
        return queryResults.filter((qr) => qr.query.category === category);
    };

    return (
        <div className="border-foreground/10 overflow-hidden rounded-xl border">
            {categoriesWithData.map((category, idx) => {
                const isExpanded = expandedCategory === category.category;
                const queries = getQueriesForCategory(category.category);
                const isLast = idx === categoriesWithData.length - 1;

                return (
                    <div
                        key={category.category}
                        className={!isLast ? "border-foreground/10 border-b" : ""}
                    >
                        <button
                            className="hover:bg-foreground/5 flex w-full items-center justify-between p-4 text-left transition-colors"
                            onClick={() =>
                                setExpandedCategory(
                                    isExpanded ? null : category.category
                                )
                            }
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <CaretUp className="text-foreground/40 h-4 w-4" />
                                ) : (
                                    <CaretDown className="text-foreground/40 h-4 w-4" />
                                )}
                                <div>
                                    <span className="text-foreground font-medium">
                                        {formatCategoryName(category.category)}
                                    </span>
                                    <span className="text-foreground/50 ml-2 text-sm">
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
                                <span className="text-foreground/50 text-sm">
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
                            <div className="border-foreground/5 bg-foreground/[0.02] border-t p-4">
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
        <div className="border-foreground/5 bg-background/50 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <p className="text-foreground text-sm leading-relaxed">
                        {query.query}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="bg-foreground/10 text-foreground/60 rounded-full px-2 py-0.5 text-xs">
                            {query.difficulty}
                        </span>
                        {query.tags?.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="bg-foreground/5 text-foreground/50 rounded-full px-2 py-0.5 text-xs"
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
        <div className="bg-foreground/10 h-2 w-20 overflow-hidden rounded-full">
            <div
                className={`h-full transition-all duration-300 ${getWinRateBarClass(winRate)}`}
                style={{ width: `${winRate * 100}%` }}
            />
        </div>
    );
}
