import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { BenchmarkSummary } from "@/components/benchmarks/benchmark-summary";
import { CompetitorLeaderboard } from "@/components/benchmarks/competitor-leaderboard";
import { CategoryBreakdown } from "@/components/benchmarks/category-breakdown";
import { getLatestBenchmarkResults } from "@/lib/benchmarks/data";
import { formatBenchmarkDate } from "@/lib/benchmarks/utils";

export const metadata: Metadata = {
    title: "Benchmarks · Carmenta",
    description:
        "See how Carmenta performs against frontier AI models in real-world tasks.",
};

/**
 * Benchmarks Page
 *
 * Public page showing competitive benchmark results.
 * Displays win rates, head-to-head comparisons, and detailed query analysis.
 */
export default async function BenchmarksPage() {
    const results = getLatestBenchmarkResults();

    if (!results) {
        return (
            <div className="relative flex min-h-screen flex-col">
                <HolographicBackground />
                <div className="relative z-content flex flex-1 flex-col">
                    <SiteHeader bordered />
                    <main className="flex flex-1 items-center justify-center px-6 py-8">
                        <div className="text-center">
                            <h1 className="text-2xl font-light text-foreground">
                                No benchmark data available
                            </h1>
                            <p className="mt-2 text-foreground/70">
                                Check back soon for our latest results.
                            </p>
                        </div>
                    </main>
                    <Footer />
                </div>
            </div>
        );
    }

    const lastUpdated = formatBenchmarkDate(results.timestamp);

    return (
        <div className="relative flex min-h-screen flex-col">
            <HolographicBackground />

            <div className="relative z-content flex flex-1 flex-col">
                <SiteHeader bordered />

                <main className="flex-1 px-6 py-8">
                    <div className="mx-auto flex max-w-6xl flex-col gap-10">
                        {/* Header */}
                        <section className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/20 p-3">
                                    <BarChart3 className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-light tracking-tight text-foreground">
                                        Benchmarks
                                    </h1>
                                    <p className="text-foreground/70">
                                        How we compare to frontier AI models
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Summary Metrics */}
                        <BenchmarkSummary
                            winRate={results.overall.winRate}
                            wins={results.overall.wins}
                            losses={results.overall.losses}
                            ties={results.overall.ties}
                            queriesRun={results.queriesRun}
                            totalQueries={results.totalQueries}
                            lastUpdated={lastUpdated}
                        />

                        {/* Head-to-Head Results */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-medium text-foreground">
                                Head-to-Head Results
                            </h2>
                            <CompetitorLeaderboard
                                competitors={results.byCompetitor}
                                queryResults={results.queryResults}
                            />
                        </section>

                        {/* Category Breakdown */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-medium text-foreground">
                                Performance by Category
                            </h2>
                            <CategoryBreakdown
                                categories={results.byCategory}
                                queryResults={results.queryResults}
                            />
                        </section>

                        {/* Methodology Note */}
                        <section className="rounded-xl border border-foreground/10 bg-foreground/5 p-6">
                            <h3 className="font-medium text-foreground">Methodology</h3>
                            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                                We evaluate Carmenta against frontier models using an
                                LLM-as-judge approach (Arena-Hard style). Each query is
                                sent to Carmenta and competitor models, then an
                                independent judge model performs blind pairwise
                                comparisons. Results reflect real-world performance on
                                tasks spanning everyday questions, research, coding, and
                                more.
                            </p>
                        </section>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
}
