"use client";

/**
 * DiffViewer - Side-by-side or unified diff display for Edit tool
 *
 * Features:
 * - Visual diff with red (removed) / green (added) highlighting
 * - File path header
 * - Replace all indicator
 * - Compact inline view for small changes
 */

import { useMemo } from "react";
import { FileEdit, Minus, Plus, ArrowRight, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import { ToolRenderer } from "../tool-renderer";
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
    const isCopied = copiedId === "newString";
    const isCompleted = status === "completed";

    const fileName = filePath ? getFileName(filePath) : "file";

    // Determine display mode
    const isMultiLineChange = useMemo(() => {
        return isMultiLine(oldString ?? "") || isMultiLine(newString ?? "");
    }, [oldString, newString]);

    // Line counts for stats
    const oldLines = oldString?.split("\n").length ?? 0;
    const newLines = newString?.split("\n").length ?? 0;
    const linesDelta = newLines - oldLines;

    return (
        <ToolRenderer
            toolName="Edit"
            toolCallId={toolCallId}
            status={status}
            input={{ file_path: filePath, replace_all: replaceAll }}
            output={
                isCompleted ? { old_lines: oldLines, new_lines: newLines } : undefined
            }
            error={error}
        >
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <FileEdit className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="truncate font-mono text-sm text-foreground">
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

                    {/* Copy new content */}
                    {isCompleted && newString && (
                        <button
                            onClick={() => copy(newString, "newString")}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

                {/* File path */}
                {filePath && filePath !== fileName && (
                    <div className="border-b border-border bg-muted/30 px-3 py-1">
                        <span className="font-mono text-xs text-muted-foreground">
                            {filePath}
                        </span>
                    </div>
                )}

                {/* Stats */}
                {isCompleted && oldString !== undefined && newString !== undefined && (
                    <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1 text-red-500">
                            <Minus className="h-3 w-3" />
                            {oldLines} line{oldLines !== 1 ? "s" : ""}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
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

                {/* Diff content */}
                <div className="max-h-96 overflow-auto">
                    <AnimatePresence mode="wait">
                        {status === "running" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-4 text-muted-foreground"
                            >
                                <FileEdit className="h-4 w-4 animate-pulse" />
                                <span className="text-sm">Editing file...</span>
                            </motion.div>
                        )}

                        {isCompleted &&
                            oldString !== undefined &&
                            newString !== undefined && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-mono text-sm"
                                >
                                    {isMultiLineChange ? (
                                        // Multi-line unified diff style
                                        <div className="divide-y divide-border">
                                            {/* Removed block */}
                                            <div className="bg-red-50 dark:bg-red-950/30">
                                                <div className="border-b border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-900/50 dark:text-red-400">
                                                    Removed
                                                </div>
                                                <pre className="overflow-x-auto whitespace-pre-wrap break-words p-3 text-red-700 dark:text-red-300">
                                                    {oldString}
                                                </pre>
                                            </div>
                                            {/* Added block */}
                                            <div className="bg-green-50 dark:bg-green-950/30">
                                                <div className="border-b border-green-200 bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-900 dark:bg-green-900/50 dark:text-green-400">
                                                    Added
                                                </div>
                                                <pre className="overflow-x-auto whitespace-pre-wrap break-words p-3 text-green-700 dark:text-green-300">
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
                                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <code className="rounded bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                {newString || "(empty)"}
                                            </code>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                    </AnimatePresence>
                </div>
            </div>
        </ToolRenderer>
    );
}
