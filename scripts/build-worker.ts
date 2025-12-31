/**
 * Build Worker Script
 *
 * Bundles the Temporal worker code for production deployment.
 * Uses esbuild for fast bundling with proper externalization of native modules.
 */

import * as esbuild from "esbuild";
import { resolve } from "path";

async function build() {
    const outdir = resolve(process.cwd(), "dist/worker");

    console.log("Building Temporal worker...");

    await esbuild.build({
        entryPoints: [resolve(process.cwd(), "worker/index.ts")],
        bundle: true,
        platform: "node",
        target: "node20",
        outdir,
        format: "cjs",
        sourcemap: true,
        // Externalize native modules and dependencies that shouldn't be bundled
        external: [
            // Temporal native bindings
            "@temporalio/core-bridge",
            "@temporalio/worker",
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
        ],
        define: {
            "process.env.NODE_ENV": '"production"',
        },
    });

    console.log(`Worker built to ${outdir}`);
}

build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
