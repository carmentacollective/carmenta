"use client";

/**
 * DiffViewer - Visual diff display for Edit tool
 *
 * Shows edit operations inline with clear visibility:
 * - Red/green highlighting for removed/added content
 * - File path header with edit status
 * - Replace all indicator when applicable
 * - Content visible immediately (not hidden)
 */

import { useMemo, useState, useCallback } from "react";
import {
    PencilSimpleLine,
    Minus,
    Plus,
    ArrowRight,
    Copy,
    Check,
    CaretDown,
    CaretUp,
    CircleNotch,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface DiffViewerProps {
    toolCallId: string;
    status: ToolStatus;
    filePath?: string;
    oldString?: string;
    newString?: string;
    replaceAll?: boolean;
    error?: string;
}

const MAX_COLLAPSED_LINES = 20;

/**
 * Extract filename from path
 */
function getFileName(filePath: string): string {
    return filePath.split("/").pop() ?? filePath;
}

/**
 * Determine if this is a single-line or multi-line change
 */
function isMultiLine(str: string): boolean {
    return str.includes("\n");
}

export function DiffViewer({
    toolCallId,
    status,
    filePath,
    oldString,
    newString,
    replaceAll,
    error,
}: DiffViewerProps) {
    const { copy, copiedId } = useCopyToClipboard();
    const isCopied = copiedId === toolCallId;
    const isCompleted = status === "completed";
    const isRunning = status === "running";

    const fileName = filePath ? getFileName(filePath) : "file";

    // Determine display mode
    const isMultiLineChange = useMemo(() => {
        return isMultiLine(oldString ?? "") || isMultiLine(newString ?? "");
    }, [oldString, newString]);

    // Line counts for stats
    const oldLines = oldString?.split("\n").length ?? 0;
    const newLines = newString?.split("\n").length ?? 0;
    const totalLines = oldLines + newLines;
    const linesDelta = newLines - oldLines;
    const shouldCollapse = totalLines > MAX_COLLAPSED_LINES;
    const [isExpanded, setIsExpanded] = useState(false);
    const isCollapsed = shouldCollapse && !isExpanded;

    const handleCopy = useCallback(() => {
        if (newString) copy(newString, toolCallId);
    }, [newString, copy, toolCallId]);

    return (
        <div
            className="border-border bg-card mb-3 w-full overflow-hidden rounded-lg border"
            data-tool-call-id={toolCallId}
        >
            {/* Header */}
            <div className="border-border bg-muted/50 flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <PencilSimpleLine className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="text-foreground truncate font-mono text-sm">
                        {fileName}
                    </span>
                    {replaceAll && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Replace all
                        </span>
                    )}
                    {isCompleted && !error && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Edited
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Loading indicator */}
                    {isRunning && (
                        <CircleNotch className="text-muted-foreground h-4 w-4 animate-spin" />
                    )}

                    {/* Copy new content */}
                    {isCompleted && newString && (
                        <button
                            onClick={handleCopy}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
                            aria-label="Copy new content"
                        >
                            {isCopied ? (
                                <Check className="h-4 w-4 text-green-500" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* File path */}
            {filePath && filePath !== fileName && (
                <div className="border-border bg-muted/30 border-b px-3 py-1">
                    <span className="text-muted-foreground font-mono text-xs">
                        {filePath}
                    </span>
                </div>
            )}

            {/* Stats */}
            {isCompleted && oldString !== undefined && newString !== undefined && (
                <div className="border-border bg-muted/20 flex items-center gap-3 border-b px-3 py-1.5 text-xs">
                    <span className="flex items-center gap-1 text-red-500">
                        <Minus className="h-3 w-3" />
                        {oldLines} line{oldLines !== 1 ? "s" : ""}
                    </span>
                    <ArrowRight className="text-muted-foreground h-3 w-3" />
                    <span className="flex items-center gap-1 text-green-500">
                        <Plus className="h-3 w-3" />
                        {newLines} line{newLines !== 1 ? "s" : ""}
                    </span>
                    {linesDelta !== 0 && (
                        <span
                            className={cn(
                                "ml-auto",
                                linesDelta > 0 ? "text-green-500" : "text-red-500"
                            )}
                        >
                            ({linesDelta > 0 ? "+" : ""}
                            {linesDelta})
                        </span>
                    )}
                </div>
            )}

            {/* Diff content - VISIBLE BY DEFAULT */}
            <div className="relative">
                {/* Loading state */}
                {isRunning && (
                    <div className="text-muted-foreground flex items-center gap-2 p-4">
                        <PencilSimpleLine className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Editing file...</span>
                    </div>
                )}

                {/* Diff display */}
                {isCompleted && oldString !== undefined && newString !== undefined && (
                    <div
                        className={cn(
                            "font-mono text-sm",
                            isCollapsed && "max-h-[350px] overflow-hidden"
                        )}
                    >
                        {isMultiLineChange ? (
                            // Multi-line unified diff style
                            <div className="divide-border divide-y">
                                {/* Removed block */}
                                <div className="bg-red-50 dark:bg-red-950/30">
                                    <div className="border-b border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-900/50 dark:text-red-400">
                                        Removed
                                    </div>
                                    <pre className="overflow-x-auto p-3 break-words whitespace-pre-wrap text-red-700 dark:text-red-300">
                                        {oldString}
                                    </pre>
                                </div>
                                {/* Added block */}
                                <div className="bg-green-50 dark:bg-green-950/30">
                                    <div className="border-b border-green-200 bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-900 dark:bg-green-900/50 dark:text-green-400">
                                        Added
                                    </div>
                                    <pre className="overflow-x-auto p-3 break-words whitespace-pre-wrap text-green-700 dark:text-green-300">
                                        {newString}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            // Inline single-line change
                            <div className="flex items-center gap-2 p-3">
                                <code className="rounded bg-red-100 px-2 py-1 text-red-700 line-through dark:bg-red-900/30 dark:text-red-300">
                                    {oldString || "(empty)"}
                                </code>
                                <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
                                <code className="rounded bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    {newString || "(empty)"}
                                </code>
                            </div>
                        )}

                        {/* Gradient fade when collapsed */}
                        {isCollapsed && (
                            <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent" />
                        )}
                    </div>
                )}

                {/* Error message */}
                {error && <div className="p-4 text-sm text-red-500">{error}</div>}
            </div>

            {/* Expand/collapse button for large diffs */}
            {shouldCollapse && isCompleted && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "border-border flex w-full items-center justify-center gap-1.5 border-t py-2",
                        "text-muted-foreground text-sm transition-colors",
                        "hover:bg-muted/50 hover:text-foreground"
                    )}
                >
                    {isCollapsed ? (
                        <>
                            <CaretDown className="h-4 w-4" />
                            Show full diff
                            <span className="text-muted-foreground/60">
                                ({totalLines} total lines)
                            </span>
                        </>
                    ) : (
                        <>
                            <CaretUp className="h-4 w-4" />
                            Collapse
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
