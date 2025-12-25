/**
 * Benchmark data loading and utilities
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// ============================================================================
// Types (matching competitive-runner.ts output)
// ============================================================================

export type BenchmarkCategory =
    | "reasoning"
    | "web-search"
    | "tool-integration"
    | "edge-cases"
    | "real-world";

export type Difficulty = "standard" | "hard" | "expert";

export interface BenchmarkQuery {
    id: string;
    query: string;
    category: BenchmarkCategory;
    difficulty: Difficulty;
    rationale: string;
    primaryDimensions: string[];
    tags: string[];
    source?: string;
    expectedTool?: string;
}

export interface ModelResponse {
    model: string;
    text: string;
    latencyMs: number;
    error?: string;
}

export interface PairwiseResult {
    competitor: string;
    winner: "carmenta" | "competitor" | "tie";
    confidence: number;
    reasoning: string;
}

export interface QueryResult {
    query: BenchmarkQuery;
    carmentaResponse: ModelResponse;
    competitorResponses: ModelResponse[];
    pairwiseResults: PairwiseResult[];
}

export interface CategoryScore {
    category: BenchmarkCategory;
    total: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
}

export interface CompetitorScore {
    competitor: string;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
}

export interface BenchmarkResults {
    timestamp: string;
    totalQueries: number;
    queriesRun: number;
    overall: {
        wins: number;
        losses: number;
        ties: number;
        winRate: number;
    };
    byCategory: CategoryScore[];
    byCompetitor: CompetitorScore[];
    queryResults: QueryResult[];
}

// ============================================================================
// Data Loading
// ============================================================================

const RESULTS_DIR = join(process.cwd(), "evals", "benchmark", "results");

/**
 * Get the most recent benchmark results file
 */
export function getLatestBenchmarkResults(): BenchmarkResults | null {
    try {
        const files = readdirSync(RESULTS_DIR)
            .filter((f) => f.startsWith("benchmark-") && f.endsWith(".json"))
            .sort()
            .reverse();

        if (files.length === 0) {
            return null;
        }

        const latestFile = files[0];
        const content = readFileSync(join(RESULTS_DIR, latestFile), "utf-8");
        return JSON.parse(content) as BenchmarkResults;
    } catch {
        return null;
    }
}

/**
 * Get results for a specific date
 */
export function getBenchmarkResultsByDate(date: string): BenchmarkResults | null {
    try {
        const filename = `benchmark-${date}.json`;
        const content = readFileSync(join(RESULTS_DIR, filename), "utf-8");
        return JSON.parse(content) as BenchmarkResults;
    } catch {
        return null;
    }
}

/**
 * List all available benchmark result dates
 */
export function listBenchmarkDates(): string[] {
    try {
        return readdirSync(RESULTS_DIR)
            .filter((f) => f.startsWith("benchmark-") && f.endsWith(".json"))
            .map((f) => f.replace("benchmark-", "").replace(".json", ""))
            .sort()
            .reverse();
    } catch {
        return [];
    }
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format win rate as percentage string
 */
export function formatWinRate(rate: number): string {
    return `${Math.round(rate * 100)}%`;
}

/**
 * Format date from ISO string
 */
export function formatBenchmarkDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/**
 * Get emoji for winner
 */
export function getWinnerDisplay(winner: "carmenta" | "competitor" | "tie"): {
    emoji: string;
    label: string;
    colorClass: string;
} {
    switch (winner) {
        case "carmenta":
            return {
                emoji: "🏆",
                label: "Win",
                colorClass: "text-green-500",
            };
        case "competitor":
            return {
                emoji: "❌",
                label: "Loss",
                colorClass: "text-red-500",
            };
        case "tie":
            return {
                emoji: "🤝",
                label: "Tie",
                colorClass: "text-yellow-500",
            };
    }
}

/**
 * Get color classes for win rate
 */
export function getWinRateColorClass(winRate: number): string {
    if (winRate >= 0.6) return "text-green-500";
    if (winRate >= 0.4) return "text-yellow-500";
    return "text-red-500";
}

/**
 * Get background color classes for win rate bar
 */
export function getWinRateBarClass(winRate: number): string {
    if (winRate >= 0.6) return "bg-green-500";
    if (winRate >= 0.4) return "bg-yellow-500";
    return "bg-red-500";
}

/**
 * Format category name for display
 */
export function formatCategoryName(category: BenchmarkCategory): string {
    return category
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Format W/L/T record
 */
export function formatRecord(wins: number, losses: number, ties: number): string {
    return `${wins}W/${losses}L/${ties}T`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
}

/**
 * Get color class for win rate display
 */
export function getWinRateColor(winRate: number): string {
    if (winRate >= 0.6) return "text-green-500";
    if (winRate >= 0.4) return "text-yellow-500";
    return "text-red-500";
}

/**
 * Get query results grouped by query ID for easy lookup
 */
export function getQueryResultsById(
    results: BenchmarkResults
): Map<string, QueryResult> {
    const map = new Map<string, QueryResult>();
    for (const qr of results.queryResults) {
        map.set(qr.query.id, qr);
    }
    return map;
}

/**
 * Get all pairwise results for a specific competitor
 */
export function getResultsForCompetitor(
    results: BenchmarkResults,
    competitorName: string
): Array<{ query: BenchmarkQuery; pairwise: PairwiseResult }> {
    const competitorResults: Array<{
        query: BenchmarkQuery;
        pairwise: PairwiseResult;
    }> = [];

    for (const qr of results.queryResults) {
        const pairwise = qr.pairwiseResults.find(
            (p) => p.competitor === competitorName
        );
        if (pairwise) {
            competitorResults.push({ query: qr.query, pairwise });
        }
    }

    return competitorResults;
}
