"use client";

/**
 * DiffViewer - Visual diff display for Edit tool
 *
 * GitHub-inspired diff viewer with:
 * - Unified diff view with word-level highlighting
 * - Syntax highlighting via Prism
 * - Red/green highlighting for removed/added content
 * - File path header with edit status
 * - Auto-expand for small diffs, collapse for large ones
 * - Fold unchanged lines with configurable context
 */

import { useMemo, useState, useCallback } from "react";
import {
    PencilSimpleLineIcon,
    MinusIcon,
    PlusIcon,
    ArrowRightIcon,
    CopyIcon,
    CheckIcon,
    CaretDownIcon,
    CaretUpIcon,
    CircleNotchIcon,
} from "@phosphor-icons/react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface DiffViewerProps {
    /** Tool call ID for copy functionality - optional for standalone use */
    toolCallId?: string;
    /** Tool status - defaults to "completed" for standalone use */
    status?: ToolStatus;
    filePath?: string;
    /** Old content - also accepts oldValue alias */
    oldString?: string;
    oldValue?: string;
    /** New content - also accepts newValue alias */
    newString?: string;
    newValue?: string;
    /** Labels for old/new columns */
    oldTitle?: string;
    newTitle?: string;
    replaceAll?: boolean;
    error?: string;
}

/** Auto-expand threshold - diffs with fewer changed lines expand automatically */
const AUTO_EXPAND_THRESHOLD = 20;

/** Lines of context to show around changes when folding */
const EXTRA_LINES_SURROUNDING_DIFF = 3;

/**
 * Extract filename from path
 */
function getFileName(filePath: string): string {
    return filePath.split("/").pop() ?? filePath;
}

/**
 * Compute actual diff statistics (additions, deletions, unchanged)
 * Uses a simple line-by-line comparison
 */
function computeDiffStats(
    oldStr: string,
    newStr: string
): {
    additions: number;
    deletions: number;
    totalChanged: number;
} {
    const oldLines = oldStr.split("\n");
    const newLines = newStr.split("\n");

    // Count occurrences of each line (handles duplicates correctly)
    const oldCounts = new Map<string, number>();
    const newCounts = new Map<string, number>();

    for (const line of oldLines) {
        oldCounts.set(line, (oldCounts.get(line) || 0) + 1);
    }

    for (const line of newLines) {
        newCounts.set(line, (newCounts.get(line) || 0) + 1);
    }

    // Calculate additions and deletions based on count differences
    let additions = 0;
    let deletions = 0;

    // Count deletions: lines in old but not in new, or reduced count
    for (const [line, oldCount] of oldCounts) {
        const newCount = newCounts.get(line) || 0;
        if (newCount < oldCount) {
            deletions += oldCount - newCount;
        }
    }

    // Count additions: lines in new but not in old, or increased count
    for (const [line, newCount] of newCounts) {
        const oldCount = oldCounts.get(line) || 0;
        if (newCount > oldCount) {
            additions += newCount - oldCount;
        }
    }

    return {
        additions,
        deletions,
        totalChanged: additions + deletions,
    };
}

/**
 * Determine if this is a single-line or multi-line change
 */
function isMultiLine(str: string): boolean {
    return str.includes("\n");
}

/**
 * Custom styles for the diff viewer that match our holographic aesthetic
 */
const getDiffStyles = (isDark: boolean) => ({
    variables: {
        dark: {
            // Dark mode holographic colors
            diffViewerBackground: "transparent",
            diffViewerColor: "rgb(var(--foreground))",
            addedBackground: "rgba(34, 197, 94, 0.15)",
            addedColor: "rgb(134, 239, 172)",
            removedBackground: "rgba(239, 68, 68, 0.15)",
            removedColor: "rgb(252, 165, 165)",
            wordAddedBackground: "rgba(34, 197, 94, 0.4)",
            wordRemovedBackground: "rgba(239, 68, 68, 0.4)",
            addedGutterBackground: "rgba(34, 197, 94, 0.25)",
            removedGutterBackground: "rgba(239, 68, 68, 0.25)",
            gutterBackground: "rgba(0, 0, 0, 0.2)",
            gutterBackgroundDark: "rgba(0, 0, 0, 0.3)",
            highlightBackground: "rgba(135, 110, 175, 0.3)", // Twilight Rose orchid violet
            highlightGutterBackground: "rgba(135, 110, 175, 0.4)",
            codeFoldGutterBackground: "rgba(0, 0, 0, 0.3)",
            codeFoldBackground: "rgba(0, 0, 0, 0.2)",
            emptyLineBackground: "transparent",
            codeFoldContentColor: "rgb(var(--muted-foreground))",
        },
        light: {
            // Light mode holographic colors
            diffViewerBackground: "transparent",
            diffViewerColor: "rgb(var(--foreground))",
            addedBackground: "rgba(34, 197, 94, 0.1)",
            addedColor: "rgb(22, 101, 52)",
            removedBackground: "rgba(239, 68, 68, 0.1)",
            removedColor: "rgb(153, 27, 27)",
            wordAddedBackground: "rgba(34, 197, 94, 0.3)",
            wordRemovedBackground: "rgba(239, 68, 68, 0.3)",
            addedGutterBackground: "rgba(34, 197, 94, 0.2)",
            removedGutterBackground: "rgba(239, 68, 68, 0.2)",
            gutterBackground: "rgba(0, 0, 0, 0.03)",
            gutterBackgroundDark: "rgba(0, 0, 0, 0.05)",
            highlightBackground: "rgba(135, 110, 175, 0.2)", // Twilight Rose orchid violet
            highlightGutterBackground: "rgba(135, 110, 175, 0.3)",
            codeFoldGutterBackground: "rgba(0, 0, 0, 0.05)",
            codeFoldBackground: "rgba(0, 0, 0, 0.02)",
            emptyLineBackground: "transparent",
            codeFoldContentColor: "rgb(var(--muted-foreground))",
        },
    },
    // Component-level style overrides
    line: {
        padding: "0 8px",
        fontSize: "13px",
        lineHeight: "1.6",
        fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },
    gutter: {
        minWidth: "40px",
        padding: "0 8px",
        fontSize: "12px",
    },
    content: {
        width: "100%",
    },
    contentText: {
        fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },
    wordDiff: {
        padding: "1px 2px",
        borderRadius: "2px",
    },
    codeFold: {
        fontSize: "12px",
        fontStyle: "italic",
    },
    codeFoldContent: {
        color: isDark ? "rgb(161, 161, 170)" : "rgb(113, 113, 122)",
    },
});

export function DiffViewer({
    toolCallId,
    status = "completed",
    filePath,
    oldString,
    oldValue,
    newString,
    newValue,
    oldTitle,
    newTitle,
    replaceAll,
    error,
}: DiffViewerProps) {
    const { copy, copiedId } = useCopyToClipboard();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    // Support both prop name conventions
    const oldContent = oldString ?? oldValue;
    const newContent = newString ?? newValue;

    const isCopied = toolCallId ? copiedId === toolCallId : false;
    const isCompleted = status === "completed";
    const isRunning = status === "running";

    const fileName = filePath ? getFileName(filePath) : "file";

    // Calculate diff statistics
    const { additions, deletions, shouldAutoExpand, isSimpleChange, totalLines } =
        useMemo(() => {
            const oldStr = oldContent ?? "";
            const newStr = newContent ?? "";
            const stats = computeDiffStats(oldStr, newStr);

            return {
                additions: stats.additions,
                deletions: stats.deletions,
                shouldAutoExpand: stats.totalChanged <= AUTO_EXPAND_THRESHOLD,
                isSimpleChange: !isMultiLine(oldStr) && !isMultiLine(newStr),
                totalLines: oldStr.split("\n").length + newStr.split("\n").length,
            };
        }, [oldContent, newContent]);

    // State for expand/collapse (defaults based on size)
    const [isExpanded, setIsExpanded] = useState(shouldAutoExpand);

    const handleCopy = useCallback(() => {
        if (newContent && toolCallId) copy(newContent, toolCallId);
    }, [newContent, copy, toolCallId]);

    // Get diff viewer styles
    const diffStyles = useMemo(() => getDiffStyles(isDark), [isDark]);

    return (
        <div
            className="border-border bg-card mb-3 w-full overflow-hidden rounded-lg border"
            data-tool-call-id={toolCallId}
        >
            {/* Header */}
            <div className="border-border bg-muted/50 flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <PencilSimpleLineIcon className="h-4 w-4 shrink-0 text-amber-500" />
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
                        <CircleNotchIcon className="text-muted-foreground h-4 w-4 animate-spin" />
                    )}

                    {/* Copy new content */}
                    {isCompleted && newContent && toolCallId && (
                        <button
                            onClick={handleCopy}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
                            aria-label="Copy new content"
                        >
                            {isCopied ? (
                                <CheckIcon className="h-4 w-4 text-green-500" />
                            ) : (
                                <CopyIcon className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* File path (if different from filename) */}
            {filePath && filePath !== fileName && (
                <div className="border-border bg-muted/30 border-b px-3 py-1">
                    <span className="text-muted-foreground font-mono text-xs">
                        {filePath}
                    </span>
                </div>
            )}

            {/* Stats bar - shows actual additions/deletions like GitHub */}
            {isCompleted && oldContent !== undefined && newContent !== undefined && (
                <div className="border-border bg-muted/20 flex items-center gap-3 border-b px-3 py-1.5 text-xs">
                    {deletions > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                            <MinusIcon className="h-3 w-3" />
                            {deletions}
                        </span>
                    )}
                    {additions > 0 && (
                        <span className="flex items-center gap-1 text-green-500">
                            <PlusIcon className="h-3 w-3" />
                            {additions}
                        </span>
                    )}
                    {additions === 0 && deletions === 0 && (
                        <span className="text-muted-foreground">No changes</span>
                    )}
                </div>
            )}

            {/* Diff content */}
            <div className="relative">
                {/* Loading state */}
                {isRunning && (
                    <div className="text-muted-foreground flex items-center gap-2 p-4">
                        <PencilSimpleLineIcon className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Editing file...</span>
                    </div>
                )}

                {/* Diff display */}
                {isCompleted &&
                    oldContent !== undefined &&
                    newContent !== undefined && (
                        <>
                            {isSimpleChange ? (
                                // Simple inline change for single-line edits
                                <div className="flex flex-wrap items-center gap-2 p-3">
                                    <code className="rounded bg-red-100 px-2 py-1 text-red-700 line-through dark:bg-red-900/30 dark:text-red-300">
                                        {oldContent || "(empty)"}
                                    </code>
                                    <ArrowRightIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                                    <code className="rounded bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                        {newContent || "(empty)"}
                                    </code>
                                </div>
                            ) : (
                                // Full diff viewer for multi-line changes
                                <div
                                    className={cn(
                                        "overflow-x-auto",
                                        !isExpanded && "max-h-[350px] overflow-hidden"
                                    )}
                                >
                                    <ReactDiffViewer
                                        oldValue={oldContent ?? ""}
                                        newValue={newContent ?? ""}
                                        leftTitle={oldTitle}
                                        rightTitle={newTitle}
                                        splitView={false}
                                        useDarkTheme={isDark}
                                        showDiffOnly={true}
                                        extraLinesSurroundingDiff={
                                            EXTRA_LINES_SURROUNDING_DIFF
                                        }
                                        compareMethod={DiffMethod.WORDS}
                                        styles={diffStyles}
                                        codeFoldMessageRenderer={(totalLines) => (
                                            <span className="text-muted-foreground text-xs">
                                                ↕ {totalLines} unchanged lines
                                            </span>
                                        )}
                                    />

                                    {/* Gradient fade when collapsed */}
                                    {!isExpanded && (
                                        <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent" />
                                    )}
                                </div>
                            )}
                        </>
                    )}

                {/* Error message */}
                {error && <div className="p-4 text-sm text-red-500">{error}</div>}
            </div>

            {/* Expand/collapse button for multi-line diffs */}
            {!isSimpleChange && isCompleted && oldContent && newContent && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "border-border flex w-full items-center justify-center gap-1.5 border-t py-2",
                        "text-muted-foreground text-sm transition-colors",
                        "hover:bg-muted/50 hover:text-foreground"
                    )}
                >
                    {!isExpanded ? (
                        <>
                            <CaretDownIcon className="h-4 w-4" />
                            Show full diff
                            <span className="text-muted-foreground/60">
                                ({additions + deletions} changes)
                            </span>
                        </>
                    ) : (
                        <>
                            <CaretUpIcon className="h-4 w-4" />
                            Collapse
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
