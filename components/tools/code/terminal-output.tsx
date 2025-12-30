"use client";

/**
 * TerminalOutput - Beautiful terminal-style display for Bash command results
 *
 * Renders command output with:
 * - Dark terminal aesthetic
 * - Command prompt with $ prefix
 * - Scrollable output area
 * - Copy button for output
 * - Exit code indicator
 */

import { useMemo } from "react";
import { Terminal, Copy, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import { ToolRenderer } from "@/components/generative-ui/tool-renderer";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface TerminalOutputProps {
    toolCallId: string;
    status: ToolStatus;
    command?: string;
    description?: string;
    output?: string;
    exitCode?: number;
    error?: string;
    cwd?: string;
    timeout?: number;
}

/**
 * Parse ANSI escape codes to styled spans (basic support)
 * Full ANSI support would need a library like ansi-to-html
 */
function formatTerminalOutput(output: string): string {
    // Strip ANSI codes for now - could enhance later with full color support

    return output.replace(/\x1b\[[0-9;]*m/g, "");
}

export function TerminalOutput({
    toolCallId,
    status,
    command,
    description,
    output,
    exitCode,
    error,
    cwd,
}: TerminalOutputProps) {
    const { copy, copiedId } = useCopyToClipboard();
    const isCopied = copiedId === "output";
    const isCompleted = status === "completed";
    const isError = status === "error" || (exitCode !== undefined && exitCode !== 0);

    const formattedOutput = useMemo(() => {
        if (!output) return "";
        return formatTerminalOutput(output);
    }, [output]);

    // Truncate very long output for display
    const MAX_LINES = 50;
    const lines = formattedOutput.split("\n");
    const isTruncated = lines.length > MAX_LINES;
    const displayOutput = isTruncated
        ? lines.slice(0, MAX_LINES).join("\n") +
          `\n... (${lines.length - MAX_LINES} more lines)`
        : formattedOutput;

    return (
        <ToolRenderer
            toolName="Bash"
            toolCallId={toolCallId}
            status={status}
            input={{ command, description, cwd }}
            output={output ? { output, exitCode } : undefined}
            error={error}
        >
            <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
                {/* Terminal header */}
                <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                        {/* Traffic light dots */}
                        <div className="flex gap-1.5">
                            <div className="h-3 w-3 rounded-full bg-red-500/80" />
                            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                            <div className="h-3 w-3 rounded-full bg-green-500/80" />
                        </div>
                        <span className="ml-2 text-xs text-zinc-400">
                            {cwd ? `${cwd}` : "Terminal"}
                        </span>
                    </div>

                    {/* Copy button */}
                    {isCompleted && output && (
                        <button
                            onClick={() => copy(output, "output")}
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                            aria-label="Copy output"
                        >
                            {isCopied ? (
                                <Check className="h-4 w-4 text-green-400" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>

                {/* Terminal content */}
                <div className="max-h-80 overflow-auto p-3 font-mono text-sm">
                    {/* Command prompt */}
                    {command && (
                        <div className="flex items-start gap-2 text-zinc-300">
                            <span className="select-none text-green-400">$</span>
                            <span className="whitespace-pre-wrap break-all">
                                {command}
                            </span>
                        </div>
                    )}

                    {/* Description */}
                    {description && (
                        <div className="mt-1 text-xs text-zinc-500">
                            # {description}
                        </div>
                    )}

                    {/* Output */}
                    <AnimatePresence mode="wait">
                        {status === "running" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mt-2 flex items-center gap-2 text-zinc-500"
                            >
                                <Terminal className="h-4 w-4 animate-pulse" />
                                <span>Running...</span>
                            </motion.div>
                        )}

                        {isCompleted && displayOutput && (
                            <motion.pre
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                    "mt-2 whitespace-pre-wrap break-words text-zinc-300",
                                    isError && "text-red-400"
                                )}
                            >
                                {displayOutput}
                            </motion.pre>
                        )}
                    </AnimatePresence>

                    {/* Error message */}
                    {error && (
                        <div className="mt-2 flex items-start gap-2 text-red-400">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="whitespace-pre-wrap">{error}</span>
                        </div>
                    )}
                </div>

                {/* Exit code footer */}
                {isCompleted && exitCode !== undefined && (
                    <div
                        className={cn(
                            "border-t border-zinc-700 px-3 py-1.5 text-xs",
                            exitCode === 0
                                ? "bg-green-900/20 text-green-400"
                                : "bg-red-900/20 text-red-400"
                        )}
                    >
                        Exit code: {exitCode}
                    </div>
                )}
            </div>
        </ToolRenderer>
    );
}
