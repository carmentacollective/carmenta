import { Trophy, Target, Clock } from "lucide-react";
import { getWinRateBarClass } from "@/lib/benchmarks/utils";

interface BenchmarkSummaryProps {
    winRate: number;
    wins: number;
    losses: number;
    ties: number;
    queriesRun: number;
    totalQueries: number;
    lastUpdated: string;
}

/**
 * Hero section displaying key benchmark metrics
 */
export function BenchmarkSummary({
    winRate,
    wins,
    losses,
    ties,
    queriesRun,
    totalQueries,
    lastUpdated,
}: BenchmarkSummaryProps) {
    const winRatePercent = Math.round(winRate * 100);
    const totalComparisons = wins + losses + ties;

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {/* Win Rate */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-foreground/60">Win Rate</p>
                        <p className="mt-1 text-4xl font-light text-foreground">
                            {winRatePercent}%
                        </p>
                    </div>
                    <div className="rounded-lg bg-primary/20 p-2">
                        <Trophy className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <div className="mt-4">
                    <WinRateBar winRate={winRate} />
                </div>
            </div>

            {/* Record */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-foreground/60">Record</p>
                        <p className="mt-1 text-4xl font-light text-foreground">
                            <span className="text-green-500">{wins}</span>
                            <span className="text-foreground/40">-</span>
                            <span className="text-red-500">{losses}</span>
                            <span className="text-foreground/40">-</span>
                            <span className="text-yellow-500">{ties}</span>
                        </p>
                    </div>
                    <div className="rounded-lg bg-primary/20 p-2">
                        <Target className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <p className="mt-4 text-sm text-foreground/60">
                    {totalComparisons} comparisons across {queriesRun} queries
                </p>
            </div>

            {/* Last Updated */}
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-foreground/60">Last Updated</p>
                        <p className="mt-1 text-2xl font-light text-foreground">
                            {lastUpdated}
                        </p>
                    </div>
                    <div className="rounded-lg bg-primary/20 p-2">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <p className="mt-4 text-sm text-foreground/60">
                    {queriesRun} of {totalQueries} queries evaluated
                </p>
            </div>
        </div>
    );
}

function WinRateBar({ winRate }: { winRate: number }) {
    return (
        <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
                className={`h-full transition-all duration-500 ${getWinRateBarClass(winRate)}`}
                style={{ width: `${winRate * 100}%` }}
            />
        </div>
    );
}
