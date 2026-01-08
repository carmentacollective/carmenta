/**
 * Bash Command Executor for Code Mode
 *
 * Executes shell commands directly when user types `!command` in code mode.
 * This bypasses the LLM entirely for quick shell operations.
 *
 * Security: Only available in code mode where:
 * - Connection ownership is validated
 * - Project path is validated to user's allowed directories
 * - User is authenticated
 */

import { spawn } from "child_process";
import { logger } from "@/lib/logger";

/**
 * Output chunks from bash execution
 */
export type BashChunk =
    | { type: "stdout"; text: string }
    | { type: "stderr"; text: string }
    | { type: "exit"; code: number; signal: string | null }
    | { type: "error"; message: string };

/** Default timeout for command execution (4 minutes) */
const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Execute a bash command and stream output
 *
 * @param command - The command to execute (without the `!` prefix)
 * @param cwd - Working directory for the command
 * @param abortSignal - Optional signal to abort execution
 * @param timeoutMs - Maximum execution time before killing process (default: 4 minutes)
 */
export async function* executeBash(
    command: string,
    cwd: string,
    abortSignal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): AsyncGenerator<BashChunk> {
    logger.info({ command, cwd }, "Code mode: executing bash command");

    // Check if already aborted
    if (abortSignal?.aborted) {
        logger.info({ command, cwd }, "Code mode: command aborted before execution");
        yield { type: "error", message: "Command aborted by user" };
        return;
    }

    // Filter environment to safe variables only
    // Security: Don't expose database credentials, API keys, or service tokens
    const safeEnv = {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        USER: process.env.USER,
        SHELL: process.env.SHELL,
        LANG: process.env.LANG,
        TZ: process.env.TZ, // Timezone for consistent date/time behavior
        // NODE_ENV included for commands that use it (e.g., npm scripts, build tools)
        // Does not leak sensitive info - just "development" or "production"
        NODE_ENV: process.env.NODE_ENV,
        // Enable color output where supported
        FORCE_COLOR: "1",
        TERM: "xterm-256color",
    };

    // Spawn shell process with shell=true (intentional for user-requested shell operations)
    // Security: This allows shell features like pipes, redirects, etc.
    // The security boundary is authentication + project path validation (see route.ts)
    const proc = spawn(command, {
        shell: true,
        cwd,
        env: safeEnv,
    });

    // Close stdin - we don't support interactive commands
    proc.stdin?.end();

    // Track completion state
    let done = false;
    let errorOccurred = false;
    let stdoutEnded = false;
    let stderrEnded = false;
    let exitChunk: BashChunk | null = null;
    // Track actual termination for SIGKILL fallback (not proc.killed which is set on kill() call)
    let processTerminated = false;

    // Create async iterator from process streams
    const chunks: BashChunk[] = [];
    let resolveNext: (() => void) | null = null;

    const pushChunk = (chunk: BashChunk) => {
        chunks.push(chunk);
        if (resolveNext) {
            resolveNext();
            resolveNext = null;
        }
    };

    // Handle abort signal
    let abortHandler: (() => void) | null = null;
    if (abortSignal) {
        abortHandler = () => {
            logger.info(
                { command, cwd, pid: proc.pid },
                "Code mode: killing process due to abort"
            );
            proc.kill("SIGTERM");

            // Force kill after timeout if process hasn't terminated
            // Note: proc.killed is set immediately after kill(), not when process exits
            // We need to check processTerminated flag instead
            setTimeout(() => {
                if (!processTerminated) {
                    logger.warn(
                        { command, pid: proc.pid },
                        "Process didn't terminate gracefully, force killing"
                    );
                    proc.kill("SIGKILL");
                }
            }, 5000);
        };
        abortSignal.addEventListener("abort", abortHandler, { once: true });
    }

    // Execution timeout - kill process if it exceeds time limit
    // This prevents runaway commands like `!sleep 999999` from holding resources
    const timeoutId = setTimeout(() => {
        if (!processTerminated) {
            logger.warn(
                { command, pid: proc.pid, timeoutMs },
                "Process exceeded timeout, killing"
            );
            pushChunk({
                type: "stderr",
                text: `\n[Process killed: exceeded ${Math.round(timeoutMs / 1000)}s timeout]\n`,
            });
            proc.kill("SIGTERM");

            // Force kill after 5s if SIGTERM didn't work
            setTimeout(() => {
                if (!processTerminated) {
                    logger.warn(
                        { command, pid: proc.pid },
                        "Process didn't terminate after timeout SIGTERM, force killing"
                    );
                    proc.kill("SIGKILL");
                }
            }, 5000);
        }
    }, timeoutMs);

    // Stream stdout with error boundary
    proc.stdout?.on("data", (data: Buffer) => {
        try {
            pushChunk({ type: "stdout", text: data.toString() });
        } catch (error) {
            logger.error({ error, command }, "Failed to process stdout");
            pushChunk({
                type: "error",
                message: `Output processing failed: ${error instanceof Error ? error.message : "unknown error"}`,
            });
        }
    });

    proc.stdout?.on("end", () => {
        stdoutEnded = true;
        checkComplete();
    });

    // Stream stderr with error boundary
    proc.stderr?.on("data", (data: Buffer) => {
        try {
            pushChunk({ type: "stderr", text: data.toString() });
        } catch (error) {
            logger.error({ error, command }, "Failed to process stderr");
            pushChunk({
                type: "error",
                message: `Error output processing failed: ${error instanceof Error ? error.message : "unknown error"}`,
            });
        }
    });

    proc.stderr?.on("end", () => {
        stderrEnded = true;
        checkComplete();
    });

    // Handle process exit - wait for streams to finish
    proc.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
        // Mark process as terminated for SIGKILL fallback check
        processTerminated = true;

        // Clear execution timeout - process has exited
        clearTimeout(timeoutId);

        // Don't emit exit if error already occurred
        if (errorOccurred) return;

        logger.info(
            { command, cwd, exitCode: code, signal },
            "Code mode: bash command completed"
        );
        exitChunk = {
            type: "exit",
            // If killed by signal, use non-zero code to indicate termination (not success)
            code: code ?? (signal ? 128 : 0),
            signal,
        };
        done = true;
        checkComplete();
    });

    // Handle spawn errors
    proc.on("error", (error: Error) => {
        logger.error({ error, command, cwd }, "Code mode: bash command failed");
        pushChunk({ type: "error", message: error.message });
        errorOccurred = true;
        done = true;
        if (resolveNext) {
            resolveNext();
            resolveNext = null;
        }
    });

    // Check if all streams and process are complete
    // Note: exitChunk is only set by the 'close' event, so this will only push
    // the exit chunk after the process has fully exited, even if stdout/stderr
    // finish earlier. This ordering ensures we don't emit exit before all output.
    const checkComplete = () => {
        if (done && stdoutEnded && stderrEnded && exitChunk) {
            pushChunk(exitChunk);
            if (resolveNext) {
                resolveNext();
                resolveNext = null;
            }
        }
    };

    try {
        // Yield chunks as they arrive - with race condition fix
        while (!done || chunks.length > 0) {
            if (chunks.length > 0) {
                yield chunks.shift()!;
            } else if (!done) {
                await new Promise<void>((resolve) => {
                    resolveNext = resolve;
                    // Re-check after assignment - chunk might have arrived during setup
                    if (chunks.length > 0 || done) {
                        resolve();
                    }
                });
            }
        }
    } finally {
        // Cleanup: remove abort listener if generator exits early
        if (abortHandler && abortSignal) {
            abortSignal.removeEventListener("abort", abortHandler);
        }

        // Clear execution timeout
        clearTimeout(timeoutId);

        // Kill orphaned process if generator exits early (e.g., client disconnect)
        if (!processTerminated) {
            logger.info(
                { command, pid: proc.pid },
                "Killing orphaned process - generator exited early"
            );
            proc.kill("SIGTERM");

            // Force kill after 5s if SIGTERM didn't work
            setTimeout(() => {
                if (!processTerminated) {
                    logger.warn(
                        { command, pid: proc.pid },
                        "Orphaned process didn't terminate gracefully, force killing"
                    );
                    proc.kill("SIGKILL");
                }
            }, 5000);
        }
    }
}
