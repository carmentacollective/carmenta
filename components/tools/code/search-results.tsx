"use client";

/**
 * SearchResults - Grep search results display
 *
 * Features:
 * - Pattern and path display
 * - Results grouped by file
 * - Line numbers with highlighted matches
 * - Match count badges
 */

import { useMemo, useState } from "react";
import {
    Search,
    FileText,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { ToolRenderer } from "@/components/generative-ui/tool-renderer";
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
    const MAX_FILES_COLLAPSED = 5;
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
        <ToolRenderer
            toolName="Grep"
            toolCallId={toolCallId}
            status={status}
            input={{ pattern, path, glob, type, output_mode: outputMode }}
            output={isCompleted ? { files: fileCount, matches: matchCount } : undefined}
            error={error}
        >
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                            {pattern}
                        </code>
                    </div>
                    {isCompleted && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

                {/* Search scope */}
                {(path || glob || type) && (
                    <div className="flex flex-wrap gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                        {path && <span>in {path}</span>}
                        {glob && (
                            <span className="rounded bg-muted px-1">glob: {glob}</span>
                        )}
                        {type && (
                            <span className="rounded bg-muted px-1">type: {type}</span>
                        )}
                    </div>
                )}

                {/* Results */}
                <div className="max-h-96 overflow-auto">
                    <AnimatePresence mode="wait">
                        {status === "running" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-4 text-muted-foreground"
                            >
                                <Search className="h-4 w-4 animate-pulse" />
                                <span className="text-sm">Searching...</span>
                            </motion.div>
                        )}

                        {/* Files only mode */}
                        {isCompleted &&
                            outputMode === "files_with_matches" &&
                            files && (
                                <motion.ul
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="divide-y divide-border"
                                >
                                    {(needsExpansion && !isExpanded
                                        ? files.slice(0, MAX_FILES_COLLAPSED)
                                        : files
                                    ).map((file, idx) => (
                                        <li
                                            key={`${file}-${idx}`}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50"
                                        >
                                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="truncate font-mono text-sm text-foreground">
                                                {file}
                                            </span>
                                        </li>
                                    ))}
                                </motion.ul>
                            )}

                        {/* Count mode */}
                        {isCompleted && outputMode === "count" && counts && (
                            <motion.ul
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="divide-y divide-border"
                            >
                                {(needsExpansion && !isExpanded
                                    ? counts.slice(0, MAX_FILES_COLLAPSED)
                                    : counts
                                ).map((item, idx) => (
                                    <li
                                        key={`${item.file}-${idx}`}
                                        className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="truncate font-mono text-sm text-foreground">
                                                {item.file}
                                            </span>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                            {item.count}
                                        </span>
                                    </li>
                                ))}
                            </motion.ul>
                        )}

                        {/* Content mode with line matches */}
                        {isCompleted &&
                            outputMode === "content" &&
                            matchesByFile.size > 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="divide-y divide-border"
                                >
                                    {Array.from(matchesByFile.entries())
                                        .slice(
                                            0,
                                            needsExpansion && !isExpanded
                                                ? MAX_FILES_COLLAPSED
                                                : undefined
                                        )
                                        .map(([file, fileMatches]) => {
                                            const isFileExpanded =
                                                expandedFiles.has(file);
                                            const fileName = getFileName(file);

                                            return (
                                                <div key={file}>
                                                    {/* File header */}
                                                    <button
                                                        onClick={() =>
                                                            toggleFileExpanded(file)
                                                        }
                                                        className="flex w-full items-center gap-2 bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
                                                    >
                                                        <ChevronRight
                                                            className={cn(
                                                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                                                isFileExpanded &&
                                                                    "rotate-90"
                                                            )}
                                                        />
                                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        <span className="truncate font-mono text-sm text-foreground">
                                                            {fileName}
                                                        </span>
                                                        <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                            {fileMatches.length}
                                                        </span>
                                                    </button>

                                                    {/* Line matches */}
                                                    <AnimatePresence>
                                                        {isFileExpanded && (
                                                            <motion.ul
                                                                initial={{
                                                                    opacity: 0,
                                                                    height: 0,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    height: "auto",
                                                                }}
                                                                exit={{
                                                                    opacity: 0,
                                                                    height: 0,
                                                                }}
                                                                className="overflow-hidden"
                                                            >
                                                                {fileMatches.map(
                                                                    (match, idx) => (
                                                                        <li
                                                                            key={`${match.line}-${idx}`}
                                                                            className="flex items-start gap-2 border-t border-border/50 bg-background px-3 py-1.5 font-mono text-sm"
                                                                        >
                                                                            <span className="flex w-12 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground">
                                                                                <Hash className="h-3 w-3" />
                                                                                {
                                                                                    match.line
                                                                                }
                                                                            </span>
                                                                            <code className="flex-1 overflow-hidden text-ellipsis whitespace-pre text-foreground">
                                                                                {highlightMatches(
                                                                                    match.content,
                                                                                    pattern ??
                                                                                        ""
                                                                                )}
                                                                            </code>
                                                                        </li>
                                                                    )
                                                                )}
                                                            </motion.ul>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                </motion.div>
                            )}

                        {/* No results */}
                        {isCompleted &&
                            !files?.length &&
                            !matchesByFile.size &&
                            !counts?.length && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-4 text-center text-sm text-muted-foreground"
                                >
                                    No matches found
                                </motion.div>
                            )}
                    </AnimatePresence>
                </div>

                {/* Expand/collapse */}
                {needsExpansion && isCompleted && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex w-full items-center justify-center gap-1 border-t border-border bg-muted/30 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="h-3 w-3" />
                                Show less
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-3 w-3" />
                                Show all {fileCount} files
                            </>
                        )}
                    </button>
                )}
            </div>
        </ToolRenderer>
    );
}
