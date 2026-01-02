/**
 * Build Worker Script
 *
 * Bundles the Temporal worker code for production deployment.
 * Uses esbuild for fast bundling with proper externalization of native modules.
 *
 * Temporal requires workflows to be bundled separately for deterministic execution.
 * We build:
 *   1. index.js - Main worker entry point
 *   2. workflows.js - Workflows bundle for Temporal's sandbox
 */

import * as esbuild from "esbuild";
import { resolve } from "path";

async function build() {
    const outdir = resolve(process.cwd(), "dist/worker");

    console.log("Building Temporal worker...");

    const commonConfig: esbuild.BuildOptions = {
        bundle: true,
        platform: "node",
        target: "node20",
        outdir,
        format: "cjs",
        sourcemap: true,
        define: {
            "process.env.NODE_ENV": '"production"',
        },
    };

    const nodeExternals = [
        // Node built-ins
        "fs",
        "path",
        "crypto",
        "stream",
        "http",
        "https",
        "net",
        "tls",
        "zlib",
        "events",
        "buffer",
        "url",
        "util",
        "os",
        "child_process",
        "worker_threads",
        // Database
        "pg-native",
        "better-sqlite3",
    ];

    // Build main worker entry point
    await esbuild.build({
        ...commonConfig,
        entryPoints: [resolve(process.cwd(), "worker/index.ts")],
        external: [
            // Temporal native bindings
            "@temporalio/core-bridge",
            "@temporalio/worker",
            // Workflows are bundled separately
            "./workflows",
            ...nodeExternals,
        ],
    });

    // Build workflows bundle separately for Temporal's deterministic sandbox
    await esbuild.build({
        bundle: true,
        platform: "node",
        target: "node20",
        format: "cjs",
        sourcemap: true,
        define: {
            "process.env.NODE_ENV": '"production"',
        },
        entryPoints: [resolve(process.cwd(), "worker/workflows/index.ts")],
        outfile: resolve(outdir, "workflows.js"),
        external: [
            // Temporal workflow API
            "@temporalio/workflow",
            ...nodeExternals,
        ],
    });

    console.log(`Worker built to ${outdir}`);
}

build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
