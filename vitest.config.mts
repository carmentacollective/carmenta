import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import os from "os";

/**
 * Intelligent worker count based on system load.
 *
 * The algorithm adapts to current system conditions:
 * - Low load (idle machine): Use all cores
 * - High load (busy machine): Scale back proportionally
 *
 * Formula: workers = cores * (1 - load_ratio * 0.5)
 * This ensures we use more cores when idle, fewer when busy.
 *
 * Testing showed optimal results at ~50-55% of cores when load ≈ cores.
 * At low load, using all cores is optimal.
 */
function calculateOptimalWorkers(): number {
    const cpuCount = os.cpus().length;
    const MIN_WORKERS = 2;

    // CI: Always use all cores (dedicated environment)
    if (process.env.CI) {
        return cpuCount;
    }

    // Manual override via environment variable
    if (process.env.VITEST_WORKERS) {
        const manual = parseInt(process.env.VITEST_WORKERS, 10);
        if (!isNaN(manual) && manual > 0) {
            return Math.min(manual, cpuCount);
        }
    }

    // Get 1-minute load average (lightweight kernel read)
    // Note: Windows returns [0,0,0], so we'll use all cores there (same as CI)
    const [loadAvg1m] = os.loadavg();

    // Calculate load ratio (0 = idle, 1 = fully loaded, >1 = overloaded)
    const loadRatio = Math.min(1.5, loadAvg1m / cpuCount);

    // Scale workers inversely with load:
    // - loadRatio 0 → use 100% of cores
    // - loadRatio 0.5 → use 75% of cores
    // - loadRatio 1.0 → use 50% of cores
    // - loadRatio 1.5 → use 25% of cores
    const scaleFactor = 1 - loadRatio * 0.5;
    const workers = Math.floor(cpuCount * scaleFactor);

    return Math.max(MIN_WORKERS, workers);
}

const maxWorkers = calculateOptimalWorkers();

// Log the decision for visibility (only in non-CI, when not silent)
if (!process.env.CI && !process.argv.includes("--silent")) {
    const [loadAvg] = os.loadavg();
    console.log(
        `\x1b[36m⚡ Vitest workers: ${maxWorkers}/${os.cpus().length} cores (load: ${loadAvg.toFixed(1)})\x1b[0m`
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
