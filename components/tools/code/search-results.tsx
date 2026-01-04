"use client";

/**
 * SearchResults - Grep search results display
 *
 * Shows search results inline with clear visibility:
 * - Pattern and path display in header
 * - Results grouped by file
 * - Line numbers with highlighted matches
 * - Match count badges
 * - Content visible immediately (not hidden)
 */

import { useMemo, useState } from "react";
import {
    MagnifyingGlass,
    FileText,
    CaretDown,
    CaretUp,
    CaretRight,
    Hash,
    CircleNotch,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface SearchResultsProps {
    toolCallId: string;
    status: ToolStatus;
    pattern?: string;
    path?: string;
    glob?: string;
    type?: string;
    outputMode?: "content" | "files_with_matches" | "count";
    files?: string[];
    matches?: Array<{
        file: string;
        line: number;
        content: string;
    }>;
    counts?: Array<{
        file: string;
        count: number;
    }>;
    error?: string;
}

/**
 * Extract filename from full path
 */
function getFileName(path: string): string {
    return path.split("/").pop() ?? path;
}

/**
 * Highlight pattern matches in text
 */
function highlightMatches(text: string, pattern: string): React.ReactNode {
    if (!pattern) return text;

    try {
        // Create regex from pattern, case-insensitive
        const regex = new RegExp(`(${pattern})`, "gi");
        const parts = text.split(regex);

        return parts.map((part, idx) =>
            regex.test(part) ? (
                <mark
                    key={idx}
                    className="rounded bg-yellow-200 px-0.5 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-200"
                >
                    {part}
                </mark>
            ) : (
                part
            )
        );
    } catch {
        // If pattern is invalid regex, return plain text
        return text;
    }
}

export function SearchResults({
    toolCallId,
    status,
    pattern,
    path,
    glob,
    type,
    outputMode = "files_with_matches",
    files,
    matches,
    counts,
    error,
}: SearchResultsProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const isCompleted = status === "completed";
    const isRunning = status === "running";

    // Match type for grouped results
    type Match = { file: string; line: number; content: string };

    // Group matches by file
    const matchesByFile = useMemo(() => {
        if (!matches) return new Map<string, Match[]>();
        const grouped = new Map<string, Match[]>();
        for (const match of matches) {
            const existing = grouped.get(match.file) ?? [];
            existing.push(match);
            grouped.set(match.file, existing);
        }
        return grouped;
    }, [matches]);

    // Calculate totals
    const fileCount = files?.length ?? matchesByFile.size ?? counts?.length ?? 0;
    const matchCount =
        matches?.length ?? counts?.reduce((sum, c) => sum + c.count, 0) ?? fileCount;

    // Collapsed limits
    const MAX_FILES_COLLAPSED = 8;
    const needsExpansion = fileCount > MAX_FILES_COLLAPSED;

    const toggleFileExpanded = (file: string) => {
        setExpandedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(file)) {
                next.delete(file);
            } else {
                next.add(file);
            }
            return next;
        });
    };

    return (
        <div
            className="border-border bg-card mb-3 w-full overflow-hidden rounded-lg border"
            data-tool-call-id={toolCallId}
        >
            {/* Header */}
            <div className="border-border bg-muted/50 flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <MagnifyingGlass className="text-muted-foreground h-4 w-4 shrink-0" />
                    <code className="bg-muted text-foreground truncate rounded px-1.5 py-0.5 font-mono text-sm">
                        {pattern}
                    </code>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning && (
                        <CircleNotch className="text-muted-foreground h-4 w-4 animate-spin" />
                    )}
                    {isCompleted && (
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span>
                                {fileCount} file{fileCount !== 1 ? "s" : ""}
                            </span>
                            {outputMode === "content" && matches && (
                                <>
                                    <span className="text-border">·</span>
                                    <span>
                                        {matchCount} match{matchCount !== 1 ? "es" : ""}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Search scope */}
            {(path || glob || type) && (
                <div className="border-border bg-muted/30 text-muted-foreground flex flex-wrap gap-2 border-b px-3 py-1.5 text-xs">
                    {path && <span>in {path}</span>}
                    {glob && (
                        <span className="bg-muted rounded px-1">glob: {glob}</span>
                    )}
                    {type && (
                        <span className="bg-muted rounded px-1">type: {type}</span>
                    )}
                </div>
            )}

            {/* Results - VISIBLE BY DEFAULT */}
            <div className="max-h-96 overflow-auto">
                {/* Loading state */}
                {isRunning && (
                    <div className="text-muted-foreground flex items-center gap-2 p-4">
                        <MagnifyingGlass className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Searching...</span>
                    </div>
                )}

                {/* Files only mode */}
                {isCompleted && outputMode === "files_with_matches" && files && (
                    <ul className="divide-border divide-y">
                        {(needsExpansion && !isExpanded
                            ? files.slice(0, MAX_FILES_COLLAPSED)
                            : files
                        ).map((file, idx) => (
                            <li
                                key={`${file}-${idx}`}
                                className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2"
                            >
                                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                                <span className="text-foreground truncate font-mono text-sm">
                                    {file}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Count mode */}
                {isCompleted && outputMode === "count" && counts && (
                    <ul className="divide-border divide-y">
                        {(needsExpansion && !isExpanded
                            ? counts.slice(0, MAX_FILES_COLLAPSED)
                            : counts
                        ).map((item, idx) => (
                            <li
                                key={`${item.file}-${idx}`}
                                className="hover:bg-muted/50 flex items-center justify-between gap-2 px-3 py-2"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                                    <span className="text-foreground truncate font-mono text-sm">
                                        {item.file}
                                    </span>
                                </div>
                                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                                    {item.count}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Content mode with line matches */}
                {isCompleted && outputMode === "content" && matchesByFile.size > 0 && (
                    <div className="divide-border divide-y">
                        {Array.from(matchesByFile.entries())
                            .slice(
                                0,
                                needsExpansion && !isExpanded
                                    ? MAX_FILES_COLLAPSED
                                    : undefined
                            )
                            .map(([file, fileMatches]) => {
                                const isFileExpanded = expandedFiles.has(file);
                                const fileName = getFileName(file);

                                return (
                                    <div key={file}>
                                        {/* File header */}
                                        <button
                                            onClick={() => toggleFileExpanded(file)}
                                            className="bg-muted/30 hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left"
                                        >
                                            <CaretRight
                                                className={cn(
                                                    "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
                                                    isFileExpanded && "rotate-90"
                                                )}
                                            />
                                            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                                            <span className="text-foreground truncate font-mono text-sm">
                                                {fileName}
                                            </span>
                                            <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs">
                                                {fileMatches.length}
                                            </span>
                                        </button>

                                        {/* Line matches */}
                                        {isFileExpanded && (
                                            <ul className="overflow-hidden">
                                                {fileMatches.map((match, idx) => (
                                                    <li
                                                        key={`${match.line}-${idx}`}
                                                        className="border-border/50 bg-background flex items-start gap-2 border-t px-3 py-1.5 font-mono text-sm"
                                                    >
                                                        <span className="text-muted-foreground flex w-12 shrink-0 items-center justify-end gap-1 text-xs">
                                                            <Hash className="h-3 w-3" />
                                                            {match.line}
                                                        </span>
                                                        <code className="text-foreground flex-1 overflow-hidden text-ellipsis whitespace-pre">
                                                            {highlightMatches(
                                                                match.content,
                                                                pattern ?? ""
                                                            )}
                                                        </code>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* No results */}
                {isCompleted &&
                    !files?.length &&
                    !matchesByFile.size &&
                    !counts?.length &&
                    !error && (
                        <div className="text-muted-foreground p-4 text-center text-sm">
                            No matches found
                        </div>
                    )}

                {/* Error message */}
                {error && <div className="p-4 text-sm text-red-500">{error}</div>}
            </div>

            {/* Expand/collapse */}
            {needsExpansion && isCompleted && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "border-border flex w-full items-center justify-center gap-1.5 border-t py-2",
                        "text-muted-foreground text-sm transition-colors",
                        "hover:bg-muted/50 hover:text-foreground"
                    )}
                >
                    {isExpanded ? (
                        <>
                            <CaretUp className="h-4 w-4" />
                            Collapse
                        </>
                    ) : (
                        <>
                            <CaretDown className="h-4 w-4" />
                            Show all {fileCount} files
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
