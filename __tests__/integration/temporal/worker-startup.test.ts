/**
 * Worker Startup Smoke Test
 *
 * Verifies the Temporal worker bundle is correctly built and can start.
 * The worker will fail to connect (no Temporal server), but should NOT fail
 * due to bundling issues like MODULE_NOT_FOUND.
 *
 * This catches esbuild configuration bugs where external modules aren't
 * properly bundled or externalized.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ChildProcess, spawn, execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const WORKER_DIR = path.resolve(process.cwd(), "dist/worker");
const WORKER_ENTRY = path.join(WORKER_DIR, "index.cjs");
const WORKFLOWS_BUNDLE = path.join(WORKER_DIR, "workflows.cjs");

describe("Temporal Worker Startup", () => {
    beforeAll(() => {
        try {
            execSync("pnpm run build:worker", {
                stdio: "pipe",
                timeout: 60000,
            });
        } catch (error) {
            const execError = error as {
                stderr?: Buffer;
                stdout?: Buffer;
                message: string;
            };
            throw new Error(
                `Failed to build worker bundle.\n` +
                    `stdout: ${execError.stdout?.toString() ?? ""}\n` +
                    `stderr: ${execError.stderr?.toString() ?? ""}\n` +
                    `error: ${execError.message}`
            );
        }
    });

    it("should produce worker bundle files", () => {
        expect(existsSync(WORKER_ENTRY)).toBe(true);
        expect(existsSync(WORKFLOWS_BUNDLE)).toBe(true);
    });

    it("should resolve workflows module from worker", () => {
        // This is the exact check that catches the bug we fixed
        const resolvedPath = require.resolve("./workflows.cjs", {
            paths: [WORKER_DIR],
        });
        expect(resolvedPath).toBe(WORKFLOWS_BUNDLE);
    });

    it("should start without MODULE_NOT_FOUND errors", async () => {
        const result = await runWorkerWithTimeout(5000);

        // Worker should fail - but for the RIGHT reason
        // Expected: Missing TEMPORAL_ADDRESS or connection refused
        // NOT expected: MODULE_NOT_FOUND, bundling errors

        const bundlingErrors = [
            "MODULE_NOT_FOUND",
            "Cannot find module",
            "Error: Cannot find package",
        ];

        const hasBundlingError = bundlingErrors.some(
            (err) => result.stderr.includes(err) || result.stdout.includes(err)
        );

        if (hasBundlingError) {
            // Fail with helpful output
            console.error("Worker stdout:", result.stdout);
            console.error("Worker stderr:", result.stderr);
            throw new Error(
                `Worker failed with bundling error. This indicates an esbuild configuration issue.\n\n` +
                    `stderr: ${result.stderr}\n` +
                    `stdout: ${result.stdout}`
            );
        }

        // Verify we got the expected startup behavior
        // Either missing env var message OR connection error (both are valid)
        const expectedErrors = [
            "TEMPORAL_ADDRESS environment variable is not set",
            "ECONNREFUSED",
            "getaddrinfo",
            "connect ENOTFOUND",
        ];

        const hasExpectedError = expectedErrors.some(
            (err) => result.stderr.includes(err) || result.stdout.includes(err)
        );

        expect(hasExpectedError).toBe(true);
    });
});

/**
 * Runs the worker and captures output until it exits or times out.
 */
function runWorkerWithTimeout(
    timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        let resolved = false;

        // Remove TEMPORAL_ADDRESS from env to ensure consistent test behavior
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { TEMPORAL_ADDRESS, ...envWithoutTemporal } = process.env;

        const worker = spawn("node", [WORKER_ENTRY], {
            env: {
                ...envWithoutTemporal,
                NODE_ENV: "test",
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        // Handle spawn errors (ENOENT, permissions, etc.)
        worker.on("error", (error) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            reject(
                new Error(
                    `Failed to spawn worker process: ${error.message}\n` +
                        `Attempted to run: node ${WORKER_ENTRY}`
                )
            );
        });

        worker.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        worker.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        const timeout = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            killProcess(worker);
            resolve({ stdout, stderr, exitCode: null });
        }, timeoutMs);

        worker.on("close", (code) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            resolve({ stdout, stderr, exitCode: code });
        });
    });
}

/**
 * Kills a process with SIGTERM, then SIGKILL if it doesn't exit.
 */
function killProcess(proc: ChildProcess): void {
    proc.kill("SIGTERM");
    setTimeout(() => {
        if (!proc.killed) {
            proc.kill("SIGKILL");
        }
    }, 1000);
}
