"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type {
    CompetitorScore,
    QueryResult,
    PairwiseResult,
} from "@/lib/benchmarks/types";
import { QueryDetailModal } from "./query-detail-modal";

interface CompetitorLeaderboardProps {
    competitors: CompetitorScore[];
    queryResults: QueryResult[];
}

/**
 * Table showing head-to-head results against each competitor
 */
export function CompetitorLeaderboard({
    competitors,
    queryResults,
}: CompetitorLeaderboardProps) {
    const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);
    const [selectedComparison, setSelectedComparison] = useState<{
        query: QueryResult;
        pairwise: PairwiseResult;
    } | null>(null);

    // Sort by win rate descending
    const sortedCompetitors = [...competitors].sort((a, b) => b.winRate - a.winRate);

    const getResultsForCompetitor = (competitorName: string) => {
        const results: Array<{ query: QueryResult; pairwise: PairwiseResult }> = [];
        for (const qr of queryResults) {
            const pairwise = qr.pairwiseResults.find(
                (p) => p.competitor === competitorName
            );
            if (pairwise) {
                results.push({ query: qr, pairwise });
            }
        }
        return results;
    };

    return (
        <>
            <div className="overflow-hidden rounded-xl border border-foreground/10">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-foreground/10 bg-foreground/5">
                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground/70">
                                Competitor
                            </th>
                            <th className="hidden px-4 py-3 text-center text-sm font-medium text-foreground/70 sm:table-cell">
                                Win Rate
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-foreground/70">
                                Record
                            </th>
                            <th className="hidden px-4 py-3 text-right text-sm font-medium text-foreground/70 md:table-cell">
                                Performance
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCompetitors.map((competitor) => {
                            const isExpanded =
                                expandedCompetitor === competitor.competitor;
                            const competitorResults = getResultsForCompetitor(
                                competitor.competitor
                            );

                            return (
                                <Fragment key={competitor.competitor}>
                                    <tr
                                        className="cursor-pointer border-b border-foreground/5 transition-colors hover:bg-foreground/5"
                                        onClick={() =>
                                            setExpandedCompetitor(
                                                isExpanded
                                                    ? null
                                                    : competitor.competitor
                                            )
                                        }
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                    <ChevronUp className="h-4 w-4 text-foreground/40" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-foreground/40" />
                                                )}
                                                <span className="font-medium text-foreground">
                                                    {competitor.competitor}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="hidden px-4 py-4 text-center sm:table-cell">
                                            <span
                                                className={`font-medium ${getWinRateColor(competitor.winRate)}`}
                                            >
                                                {Math.round(competitor.winRate * 100)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-sm text-foreground/70">
                                                <span className="text-green-500">
                                                    {competitor.wins}W
                                                </span>{" "}
                                                /{" "}
                                                <span className="text-red-500">
                                                    {competitor.losses}L
                                                </span>{" "}
                                                /{" "}
                                                <span className="text-yellow-500">
                                                    {competitor.ties}T
                                                </span>
                                            </span>
                                        </td>
                                        <td className="hidden px-4 py-4 md:table-cell">
                                            <div className="flex justify-end">
                                                <WinRateBar
                                                    winRate={competitor.winRate}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${competitor.competitor}-details`}>
                                            <td
                                                colSpan={4}
                                                className="bg-foreground/[0.02] px-4 py-3"
                                            >
                                                <div className="space-y-2">
                                                    {competitorResults.map(
                                                        ({ query, pairwise }) => (
                                                            <button
                                                                key={query.query.id}
                                                                className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-foreground/5"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedComparison(
                                                                        {
                                                                            query,
                                                                            pairwise,
                                                                        }
                                                                    );
                                                                }}
                                                            >
                                                                <div className="flex-1">
                                                                    <p className="text-sm text-foreground">
                                                                        {truncate(
                                                                            query.query
                                                                                .query,
                                                                            80
                                                                        )}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-foreground/50">
                                                                        {
                                                                            query.query
                                                                                .category
                                                                        }{" "}
                                                                        ·{" "}
                                                                        {
                                                                            query.query
                                                                                .difficulty
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <div className="ml-4 flex items-center gap-2">
                                                                    <WinnerBadge
                                                                        winner={
                                                                            pairwise.winner
                                                                        }
                                                                    />
                                                                    <span className="text-xs text-foreground/40">
                                                                        {Math.round(
                                                                            pairwise.confidence *
                                                                                100
                                                                        )}
                                                                        %
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedComparison && (
                <QueryDetailModal
                    query={selectedComparison.query}
                    pairwise={selectedComparison.pairwise}
                    onClose={() => setSelectedComparison(null)}
                />
            )}
        </>
    );
}

function WinRateBar({ winRate }: { winRate: number }) {
    const getBarColor = (rate: number) => {
        if (rate >= 0.6) return "bg-green-500";
        if (rate >= 0.4) return "bg-yellow-500";
        return "bg-red-500";
    };

    return (
        <div className="h-2 w-24 overflow-hidden rounded-full bg-foreground/10">
            <div
                className={`h-full transition-all duration-300 ${getBarColor(winRate)}`}
                style={{ width: `${winRate * 100}%` }}
            />
        </div>
    );
}

function WinnerBadge({ winner }: { winner: "carmenta" | "competitor" | "tie" }) {
    const config = {
        carmenta: {
            label: "Win",
            className: "bg-green-500/10 text-green-500",
        },
        competitor: {
            label: "Loss",
            className: "bg-red-500/10 text-red-500",
        },
        tie: {
            label: "Tie",
            className: "bg-yellow-500/10 text-yellow-500",
        },
    };

    const { label, className } = config[winner];

    return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
            {label}
        </span>
    );
}

function getWinRateColor(winRate: number): string {
    if (winRate >= 0.6) return "text-green-500";
    if (winRate >= 0.4) return "text-yellow-500";
    return "text-red-500";
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
}
