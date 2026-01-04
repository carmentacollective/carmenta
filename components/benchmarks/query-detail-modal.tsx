"use client";

/**
 * Query Detail Modal
 *
 * Modal showing detailed comparison between Carmenta and a competitor.
 * Uses shadcn Dialog (Radix) for proper modal behavior.
 */

import { Clock, Trophy, WarningCircle, Handshake } from "@phosphor-icons/react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { QueryResult, PairwiseResult } from "@/lib/benchmarks/types";

interface QueryDetailModalProps {
    query: QueryResult | null;
    pairwise: PairwiseResult | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Modal showing detailed comparison between Carmenta and a competitor
 */
export function QueryDetailModal({
    query,
    pairwise,
    open,
    onOpenChange,
}: QueryDetailModalProps) {
    // Derive competitor response when data is available
    const competitorResponse = query?.competitorResponses.find(
        (r) => r.model === pairwise?.competitor
    );

    // Always render Dialog to allow Radix to manage animations and cleanup
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {query && pairwise && (
                <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0">
                    {/* Hidden title for accessibility - visible title is in header */}
                    <DialogTitle className="sr-only">
                        Query Comparison: {query.query.query}
                    </DialogTitle>

                    {/* Header */}
                    <div className="border-border flex shrink-0 items-start justify-between border-b p-6">
                        <div className="flex-1 pr-8">
                            <div className="flex items-center gap-2">
                                <WinnerIcon winner={pairwise.winner} />
                                <span
                                    className={`text-sm font-medium ${getWinnerColor(pairwise.winner)}`}
                                >
                                    {pairwise.winner === "carmenta"
                                        ? "Carmenta Won"
                                        : pairwise.winner === "competitor"
                                          ? `${pairwise.competitor} Won`
                                          : "Tie"}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                    ({Math.round(pairwise.confidence * 100)}%
                                    confidence)
                                </span>
                            </div>
                            <h2 className="text-foreground mt-2 text-lg font-medium">
                                {query.query.query}
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                    {query.query.category}
                                </span>
                                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                    {query.query.difficulty}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Judge's Reasoning */}
                    <div className="border-border bg-muted/50 shrink-0 border-b p-6">
                        <h3 className="text-muted-foreground text-sm font-medium">
                            Judge&apos;s Reasoning
                        </h3>
                        <p className="text-foreground mt-2 leading-relaxed">
                            {pairwise.reasoning}
                        </p>
                    </div>

                    {/* Responses Comparison */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Carmenta Response */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-foreground font-medium">
                                        Carmenta
                                    </h3>
                                    <div className="text-muted-foreground flex items-center gap-1 text-sm">
                                        <Clock className="h-3 w-3" />
                                        {formatLatency(
                                            query.carmentaResponse.latencyMs
                                        )}
                                    </div>
                                </div>
                                <div className="border-border bg-muted/30 rounded-lg border p-4">
                                    <pre className="text-foreground/80 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
                                        {truncate(query.carmentaResponse.text, 2000)}
                                    </pre>
                                </div>
                            </div>

                            {/* Competitor Response */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-foreground font-medium">
                                        {pairwise.competitor}
                                    </h3>
                                    {competitorResponse && (
                                        <div className="text-muted-foreground flex items-center gap-1 text-sm">
                                            <Clock className="h-3 w-3" />
                                            {formatLatency(
                                                competitorResponse.latencyMs
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="border-border bg-muted/30 rounded-lg border p-4">
                                    <pre className="text-foreground/80 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
                                        {competitorResponse
                                            ? truncate(competitorResponse.text, 2000)
                                            : "Response not available"}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
}

function WinnerIcon({ winner }: { winner: "carmenta" | "competitor" | "tie" }) {
    const iconClass = "h-4 w-4";

    switch (winner) {
        case "carmenta":
            return <Trophy className={`${iconClass} text-green-500`} />;
        case "competitor":
            return <WarningCircle className={`${iconClass} text-red-500`} />;
        case "tie":
            return <Handshake className={`${iconClass} text-yellow-500`} />;
    }
}

function getWinnerColor(winner: "carmenta" | "competitor" | "tie"): string {
    switch (winner) {
        case "carmenta":
            return "text-green-500";
        case "competitor":
            return "text-red-500";
        case "tie":
            return "text-yellow-500";
    }
}

function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
}
