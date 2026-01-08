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

/**
 * Execute a bash command and stream output
 *
 * @param command - The command to execute (without the `!` prefix)
 * @param cwd - Working directory for the command
 * @param abortSignal - Optional signal to abort execution
 */
export async function* executeBash(
    command: string,
    cwd: string,
    abortSignal?: AbortSignal
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
        NODE_ENV: process.env.NODE_ENV,
        // Enable color output where supported
        FORCE_COLOR: "1",
        TERM: "xterm-256color",
    };

    // Spawn shell process
    const proc = spawn(command, {
        shell: true,
        cwd,
        env: safeEnv,
    });

    // Track completion state
    let done = false;
    let errorOccurred = false;
    let stdoutEnded = false;
    let stderrEnded = false;
    let exitChunk: BashChunk | null = null;

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

            // Force kill after timeout if graceful termination fails
            setTimeout(() => {
                if (!proc.killed) {
                    logger.warn(
                        { command, pid: proc.pid },
                        "Process didn't terminate, force killing"
                    );
                    proc.kill("SIGKILL");
                }
            }, 5000);
        };
        abortSignal.addEventListener("abort", abortHandler, { once: true });
    }

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
        // Don't emit exit if error already occurred
        if (errorOccurred) return;

        logger.info(
            { command, cwd, exitCode: code, signal },
            "Code mode: bash command completed"
        );
        exitChunk = {
            type: "exit",
            code: code ?? 0,
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
    }
}
