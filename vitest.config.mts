import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import os from "os";

/**
 * Detect if we're running a targeted test (single file/directory) vs full suite.
 * Targeted tests have limited parallelization potential.
 */
function isTargetedTest(): boolean {
    // Check for file/directory arguments (anything that's not a flag)
    const args = process.argv.slice(2);
    return args.some((arg) => !arg.startsWith("-") && (arg.includes("/") || arg.includes(".")));
}

/**
 * Intelligent worker count based on test scope and system load.
 *
 * The algorithm adapts to:
 * 1. Test scope: Single file tests use fewer workers (limited parallelization)
 * 2. System load: Tiered reduction only when system is actually struggling
 *
 * Full test suite strategy (DX-focused):
 * - Load ratio < 1.2: Use 8 workers (optimal speed)
 * - Load ratio 1.2-1.8: Use 6 workers (modest reduction)
 * - Load ratio > 1.8: Use 4 workers (system struggling)
 *
 * Single file tests: Use 2-4 workers max (limited parallelization benefit)
 *
 * Benchmark results (14-core M3 Max, 2026-01-09):
 * - 8 workers: 19.77s (OPTIMAL - virtually tied with 10)
 * - 10 workers: 19.75s (0.02s faster, not meaningful)
 * - 14 workers: 20.64s (+4.4% slower - resource contention)
 * - 20 workers: 20.07s (+1.5% slower)
 * - 28 workers: 24.09s (+21.9% slower)
 *
 * Conclusion: Optimal is ~57% of cores (8/14 = 0.57). Performance degrades above
 * this due to resource contention. This ratio scales across different CPU counts.
 */
function calculateOptimalWorkers(): {
    workers: number;
    cpuCount: number;
    loadAvg: number;
    isTargeted: boolean;
} {
    const cpuCount = os.cpus().length;
    const MIN_WORKERS = 2;
    const isTargeted = isTargetedTest();

    // Guard against containerized environments where cpuCount may be 0
    if (cpuCount === 0) {
        return { workers: MIN_WORKERS, cpuCount: 0, loadAvg: 0, isTargeted };
    }

    // Get 1-minute load average (lightweight kernel read)
    // Note: Windows returns [0,0,0], so we'll use all cores there (same as CI)
    const [loadAvg] = os.loadavg();

    // CI: Always use all cores (dedicated environment)
    if (process.env.CI) {
        return { workers: cpuCount, cpuCount, loadAvg, isTargeted };
    }

    // Manual override via environment variable
    if (process.env.VITEST_WORKERS) {
        const manual = parseInt(process.env.VITEST_WORKERS, 10);
        if (!isNaN(manual) && manual > 0) {
            return { workers: Math.min(manual, cpuCount), cpuCount, loadAvg, isTargeted };
        }
    }

    // Single file/directory tests: Use fewer workers (limited parallelization)
    if (isTargeted) {
        const targetedWorkers = Math.min(4, Math.max(MIN_WORKERS, Math.floor(cpuCount / 2)));
        return { workers: targetedWorkers, cpuCount, loadAvg, isTargeted };
    }

    // Full test suite: Scale workers based on system load
    // Optimal is ~57% of cores based on benchmark results (8/14 = 0.57)
    // This ratio balances parallelization with resource contention across different CPU counts
    const OPTIMAL_RATIO = 0.57;
    const OPTIMAL_WORKERS = Math.max(4, Math.ceil(cpuCount * OPTIMAL_RATIO));

    // Calculate load ratio (0 = idle, 1 = fully loaded, >1 = overloaded)
    const loadRatio = loadAvg / cpuCount;

    // DX-focused scaling: Keep tests fast unless system is actually struggling
    // Use tiered approach instead of linear scaling
    let workers: number;
    if (loadRatio < 1.2) {
        // Low to moderate load: Full speed ahead
        workers = OPTIMAL_WORKERS;
    } else if (loadRatio < 1.8) {
        // High load: Modest reduction (75% capacity)
        workers = 6;
    } else {
        // Very high load: System struggling, back off more (50% capacity)
        workers = 4;
    }

    return { workers, cpuCount, loadAvg, isTargeted };
}

const { workers: maxWorkers, cpuCount, loadAvg, isTargeted } = calculateOptimalWorkers();

// Log the decision for visibility (only in non-CI, when not silent)
if (!process.env.CI && !process.argv.includes("--silent")) {
    let reason = "";
    const scope = isTargeted ? "targeted test" : "full suite";

    if (process.env.VITEST_WORKERS) {
        reason = `manual override (VITEST_WORKERS=${process.env.VITEST_WORKERS})`;
    } else if (cpuCount === 0) {
        reason = "containerized environment fallback";
    } else if (isTargeted) {
        reason = `${scope} - limited parallelization`;
    } else if (loadAvg === 0) {
        reason = `${scope} - Windows/no load data`;
    } else {
        const loadRatio = loadAvg / cpuCount;
        if (loadRatio < 1.2) {
            reason = `${scope} - optimal speed (low/moderate load)`;
        } else if (loadRatio < 1.8) {
            reason = `${scope} - reduced load (ratio: ${loadRatio.toFixed(2)}, high load)`;
        } else {
            reason = `${scope} - reduced load (ratio: ${loadRatio.toFixed(2)}, system struggling)`;
        }
    }

    console.log(
        `\x1b[36m⚡ Vitest workers: ${maxWorkers}/${cpuCount} cores (load: ${loadAvg.toFixed(1)}) - ${reason}\x1b[0m`
    );
}

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        setupFiles: [path.resolve(__dirname, "./vitest.setup.ts")],
        include: [
            "__tests__/unit/**/*.{test,spec}.{ts,tsx}",
            "__tests__/integration/**/*.{test,spec}.{ts,tsx}",
        ],
        pool: "threads",
        isolate: true,
        maxWorkers,
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                "__tests__/",
                "**/*.config.*",
                "**/*.d.ts",
                ".next/",
                "out/",
            ],
        },
        slowTestThreshold: 10000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./"),
        },
    },
});
