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
            <div className="border-foreground/10 bg-foreground/5 rounded-xl border p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-foreground/60 text-sm">Win Rate</p>
                        <p className="text-foreground mt-1 text-4xl font-light">
                            {winRatePercent}%
                        </p>
                    </div>
                    <div className="bg-primary/20 rounded-lg p-2">
                        <Trophy className="text-primary h-5 w-5" />
                    </div>
                </div>
                <div className="mt-4">
                    <WinRateBar winRate={winRate} />
                </div>
            </div>

            {/* Record */}
            <div className="border-foreground/10 bg-foreground/5 rounded-xl border p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-foreground/60 text-sm">Record</p>
                        <p className="text-foreground mt-1 text-4xl font-light">
                            <span className="text-green-500">{wins}</span>
                            <span className="text-foreground/40">-</span>
                            <span className="text-red-500">{losses}</span>
                            <span className="text-foreground/40">-</span>
                            <span className="text-yellow-500">{ties}</span>
                        </p>
                    </div>
                    <div className="bg-primary/20 rounded-lg p-2">
                        <Target className="text-primary h-5 w-5" />
                    </div>
                </div>
                <p className="text-foreground/60 mt-4 text-sm">
                    {totalComparisons} comparisons across {queriesRun} queries
                </p>
            </div>

            {/* Last Updated */}
            <div className="border-foreground/10 bg-foreground/5 rounded-xl border p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-foreground/60 text-sm">Last Updated</p>
                        <p className="text-foreground mt-1 text-2xl font-light">
                            {lastUpdated}
                        </p>
                    </div>
                    <div className="bg-primary/20 rounded-lg p-2">
                        <Clock className="text-primary h-5 w-5" />
                    </div>
                </div>
                <p className="text-foreground/60 mt-4 text-sm">
                    {queriesRun} of {totalQueries} queries evaluated
                </p>
            </div>
        </div>
    );
}

function WinRateBar({ winRate }: { winRate: number }) {
    return (
        <div className="bg-foreground/10 h-2 overflow-hidden rounded-full">
            <div
                className={`h-full transition-all duration-500 ${getWinRateBarClass(winRate)}`}
                style={{ width: `${winRate * 100}%` }}
            />
        </div>
    );
}
