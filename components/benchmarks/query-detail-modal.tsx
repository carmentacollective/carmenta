"use client";

import { useEffect, useCallback } from "react";
import { X, Clock, Trophy, AlertCircle, Handshake } from "lucide-react";

import type { QueryResult, PairwiseResult } from "@/lib/benchmarks/types";

interface QueryDetailModalProps {
    query: QueryResult;
    pairwise: PairwiseResult;
    onClose: () => void;
}

/**
 * Modal showing detailed comparison between Carmenta and a competitor
 */
export function QueryDetailModal({ query, pairwise, onClose }: QueryDetailModalProps) {
    const competitorResponse = query.competitorResponses.find(
        (r) => r.model === pairwise.competitor
    );

    // Close on escape key
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [handleKeyDown]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-foreground/10 p-6">
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
                            <span className="text-sm text-foreground/50">
                                ({Math.round(pairwise.confidence * 100)}% confidence)
                            </span>
                        </div>
                        <h2 className="mt-2 text-lg font-medium text-foreground">
                            {query.query.query}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                                {query.query.category}
                            </span>
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                                {query.query.difficulty}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 transition-colors hover:bg-foreground/10"
                    >
                        <X className="h-5 w-5 text-foreground/60" />
                    </button>
                </div>

                {/* Judge's Reasoning */}
                <div className="border-b border-foreground/10 bg-foreground/5 p-6">
                    <h3 className="text-sm font-medium text-foreground/70">
                        Judge&apos;s Reasoning
                    </h3>
                    <p className="mt-2 leading-relaxed text-foreground">
                        {pairwise.reasoning}
                    </p>
                </div>

                {/* Responses Comparison */}
                <div className="max-h-[50vh] overflow-y-auto p-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Carmenta Response */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-foreground">
                                    Carmenta
                                </h3>
                                <div className="flex items-center gap-1 text-sm text-foreground/50">
                                    <Clock className="h-3 w-3" />
                                    {formatLatency(query.carmentaResponse.latencyMs)}
                                </div>
                            </div>
                            <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/80">
                                    {truncate(query.carmentaResponse.text, 2000)}
                                </pre>
                            </div>
                        </div>

                        {/* Competitor Response */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-foreground">
                                    {pairwise.competitor}
                                </h3>
                                {competitorResponse && (
                                    <div className="flex items-center gap-1 text-sm text-foreground/50">
                                        <Clock className="h-3 w-3" />
                                        {formatLatency(competitorResponse.latencyMs)}
                                    </div>
                                )}
                            </div>
                            <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/80">
                                    {competitorResponse
                                        ? truncate(competitorResponse.text, 2000)
                                        : "Response not available"}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function WinnerIcon({ winner }: { winner: "carmenta" | "competitor" | "tie" }) {
    const iconClass = "h-4 w-4";

    switch (winner) {
        case "carmenta":
            return <Trophy className={`${iconClass} text-green-500`} />;
        case "competitor":
            return <AlertCircle className={`${iconClass} text-red-500`} />;
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
