"use client";

/**
 * TerminalOutput - Terminal-style display for Bash command results
 *
 * Shows command output inline with Claude Code CLI aesthetics:
 * - Dark terminal theme with traffic light dots
 * - Command prompt with $ prefix
 * - Output visible immediately (not hidden behind click)
 * - Long output collapses with "Show all X lines" expansion
 * - Copy button and exit code indicator
 */

import { useState, useMemo, useCallback } from "react";
import {
    Terminal,
    Copy,
    Check,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Clock,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
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

const MAX_COLLAPSED_LINES = 15;

/**
 * Strip ANSI escape codes for clean display
 */
function stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
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
    const isCopied = copiedId === toolCallId;
    const isCompleted = status === "completed";
    const isRunning = status === "running";
    const isError = status === "error" || (exitCode !== undefined && exitCode !== 0);

    // Process output
    const cleanOutput = useMemo(() => (output ? stripAnsi(output) : ""), [output]);
    const lines = useMemo(() => cleanOutput.split("\n"), [cleanOutput]);
    const lineCount = lines.length;
    const shouldCollapse = lineCount > MAX_COLLAPSED_LINES;
    const [isExpanded, setIsExpanded] = useState(false);
    const isCollapsed = shouldCollapse && !isExpanded;

    const displayOutput = useMemo(() => {
        if (!isCollapsed) return cleanOutput;
        return lines.slice(0, MAX_COLLAPSED_LINES).join("\n");
    }, [cleanOutput, lines, isCollapsed]);

    const handleCopy = useCallback(() => {
        if (output) copy(output, toolCallId);
    }, [output, copy, toolCallId]);

    const hasOutput = cleanOutput.length > 0;

    return (
        <div
            className="mb-3 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
            data-tool-call-id={toolCallId}
        >
            {/* Terminal header */}
            <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    {/* Traffic light dots */}
                    <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                    </div>

                    {/* Directory path */}
                    <span className="ml-2 truncate text-xs text-zinc-400">
                        {cwd || "Terminal"}
                    </span>

                    {/* Running indicator */}
                    {isRunning && (
                        <span className="flex items-center gap-1 text-xs text-zinc-400">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                            </span>
                            running
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Exit code */}
                    {isCompleted && exitCode !== undefined && (
                        <span
                            className={cn(
                                "font-mono text-xs tabular-nums",
                                exitCode === 0 ? "text-emerald-400" : "text-red-400"
                            )}
                        >
                            exit {exitCode}
                        </span>
                    )}

                    {/* Copy button */}
                    {isCompleted && output && (
                        <button
                            onClick={handleCopy}
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
            </div>

            {/* Terminal content */}
            <div className="relative font-mono text-sm">
                <div className="p-3">
                    {/* Command prompt */}
                    {command && (
                        <div className="flex items-start gap-2 text-zinc-300">
                            <span className="text-green-400 select-none">$</span>
                            <span className="break-all whitespace-pre-wrap">
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

                    {/* Running state */}
                    {isRunning && !hasOutput && (
                        <div className="mt-2 flex items-center gap-2 text-zinc-500">
                            <Terminal className="h-4 w-4 animate-pulse" />
                            <span>Running...</span>
                        </div>
                    )}

                    {/* Output - VISIBLE BY DEFAULT */}
                    {hasOutput && (
                        <div
                            className={cn(
                                "mt-2",
                                isCollapsed && "max-h-[280px] overflow-hidden"
                            )}
                        >
                            <pre
                                className={cn(
                                    "break-words whitespace-pre-wrap text-zinc-300",
                                    isError && "text-red-400"
                                )}
                            >
                                {displayOutput}
                            </pre>

                            {/* Gradient fade when collapsed */}
                            {isCollapsed && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent" />
                            )}
                        </div>
                    )}

                    {/* No output message */}
                    {isCompleted && !hasOutput && !error && (
                        <div className="mt-2 text-xs text-zinc-500 italic">
                            No output
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="mt-2 flex items-start gap-2 text-red-400">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="whitespace-pre-wrap">{error}</span>
                        </div>
                    )}
                </div>

                {/* Expand/collapse button for long output */}
                {shouldCollapse && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={cn(
                            "flex w-full items-center justify-center gap-1.5 border-t border-zinc-700 py-2",
                            "text-sm text-zinc-400 transition-colors",
                            "hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                    >
                        {isCollapsed ? (
                            <>
                                <ChevronDown className="h-4 w-4" />
                                Show all {lineCount} lines
                                <span className="text-zinc-500">
                                    (+{lineCount - MAX_COLLAPSED_LINES} more)
                                </span>
                            </>
                        ) : (
                            <>
                                <ChevronUp className="h-4 w-4" />
                                Collapse
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
