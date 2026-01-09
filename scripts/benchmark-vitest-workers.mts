#!/usr/bin/env tsx

/**
 * Benchmark different vitest worker counts to find optimal performance.
 *
 * Tests various worker configurations and measures total execution time.
 * Helps find the sweet spot between parallelization and resource contention.
 *
 * Usage: pnpm tsx scripts/benchmark-vitest-workers.mts
 */

import { execSync } from "child_process";
import os from "os";

const cpuCount = os.cpus().length;
const MIN_WORKERS = 2;
const MAX_WORKERS = cpuCount * 2; // Test up to 2x CPU count (hyperthreading benefit)

// Worker counts to test: 2, 4, 6, 8, ..., up to 2x cpuCount
const workerCounts = Array.from(
    { length: Math.floor((MAX_WORKERS - MIN_WORKERS) / 2) + 1 },
    (_, i) => MIN_WORKERS + i * 2
);

// Add cpuCount if not already in the list
if (!workerCounts.includes(cpuCount)) {
    workerCounts.push(cpuCount);
    workerCounts.sort((a, b) => a - b);
}

interface BenchmarkResult {
    workers: number;
    times: number[];
    avgTime: number;
    minTime: number;
    maxTime: number;
}

const RUNS_PER_CONFIG = 3; // Run each config 3 times for consistency

console.log("🔥 Vitest Worker Count Benchmark\n");
console.log(`CPU Cores: ${cpuCount}`);
console.log(`Testing worker counts: ${workerCounts.join(", ")}`);
console.log(`Runs per configuration: ${RUNS_PER_CONFIG}\n`);

const results: BenchmarkResult[] = [];

for (const workers of workerCounts) {
    console.log(`\n📊 Testing ${workers} workers...`);
    const times: number[] = [];

    for (let run = 1; run <= RUNS_PER_CONFIG; run++) {
        try {
            const startTime = Date.now();

            // Run vitest with the specified worker count
            // Suppress output for cleaner benchmark results
            execSync(`VITEST_WORKERS=${workers} pnpm vitest run --silent`, {
                stdio: "pipe",
                encoding: "utf-8",
            });

            const duration = Date.now() - startTime;
            times.push(duration);

            console.log(`  Run ${run}: ${(duration / 1000).toFixed(2)}s`);
        } catch (error) {
            console.error(`  ❌ Run ${run} failed`);
            times.push(Infinity); // Mark failed runs
        }
    }

    const validTimes = times.filter((t) => t !== Infinity);
    if (validTimes.length === 0) {
        console.log(`  ⚠️  All runs failed for ${workers} workers`);
        continue;
    }

    const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const minTime = Math.min(...validTimes);
    const maxTime = Math.max(...validTimes);

    results.push({
        workers,
        times: validTimes,
        avgTime,
        minTime,
        maxTime,
    });

    console.log(`  ⏱️  Avg: ${(avgTime / 1000).toFixed(2)}s (range: ${(minTime / 1000).toFixed(2)}-${(maxTime / 1000).toFixed(2)}s)`);
}

// Find optimal configuration
console.log("\n\n📈 Results Summary\n");
console.log("Workers │ Avg Time │ Min Time │ Max Time │ vs Fastest");
console.log("────────┼──────────┼──────────┼──────────┼───────────");

const sortedResults = [...results].sort((a, b) => a.avgTime - b.avgTime);
const fastestTime = sortedResults[0]?.avgTime || 0;

for (const result of results) {
    const diff = ((result.avgTime - fastestTime) / fastestTime) * 100;
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : "FASTEST";

    console.log(
        `${result.workers.toString().padStart(7)} │ ${(result.avgTime / 1000).toFixed(2).padStart(8)}s │ ${(result.minTime / 1000).toFixed(2).padStart(8)}s │ ${(result.maxTime / 1000).toFixed(2).padStart(8)}s │ ${diffStr}`
    );
}

if (sortedResults.length > 0) {
    const optimal = sortedResults[0];
    console.log(`\n✨ Optimal configuration: ${optimal.workers} workers`);
    console.log(`   Average time: ${(optimal.avgTime / 1000).toFixed(2)}s`);

    // Provide recommendation
    if (optimal.workers === cpuCount) {
        console.log(`   💡 Recommendation: Use cpuCount (${cpuCount}) - matches physical cores`);
    } else if (optimal.workers < cpuCount) {
        console.log(
            `   💡 Recommendation: Use ${optimal.workers} workers - system benefits from lower concurrency`
        );
    } else {
        console.log(
            `   💡 Recommendation: Use ${optimal.workers} workers - hyperthreading/I-O benefits from higher concurrency`
        );
    }
}
