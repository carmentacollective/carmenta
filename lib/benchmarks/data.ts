/**
 * Benchmark data loading - SERVER ONLY (uses Node.js fs APIs)
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import type {
    BenchmarkResults,
    QueryResult,
    BenchmarkQuery,
    PairwiseResult,
} from "./types";

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
