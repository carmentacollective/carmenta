import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import os from "os";

// Dynamic worker count based on available cores
// CI: Use all available cores (typically 2-4)
// Local: Use 70% of cores to prevent main thread bottleneck
const cpuCount = os.cpus().length;
const maxWorkers = process.env.CI ? cpuCount : Math.max(2, Math.floor(cpuCount * 0.7));

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
        poolOptions: {
            threads: {
                singleThread: false,
                isolate: true,
                maxThreads: maxWorkers,
            },
        },
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
