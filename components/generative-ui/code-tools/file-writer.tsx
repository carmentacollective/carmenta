"use client";

/**
 * FileWriter - Display for Write tool showing file creation/overwrite
 *
 * Features:
 * - File path with success/error indicator
 * - Collapsible content preview
 * - Syntax highlighting
 * - Character/line count
 */

import { useState, useMemo } from "react";
import { FilePlus, FileCheck, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ToolRenderer } from "../tool-renderer";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface FileWriterProps {
    toolCallId: string;
    status: ToolStatus;
    filePath?: string;
    content?: string;
    error?: string;
}

/**
 * Get file extension for syntax highlighting
 */
function getLanguageFromPath(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "tsx",
        js: "javascript",
        jsx: "jsx",
        py: "python",
        rb: "ruby",
        rs: "rust",
        go: "go",
        java: "java",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        md: "markdown",
        mdx: "mdx",
        html: "html",
        css: "css",
        scss: "scss",
        sql: "sql",
        sh: "bash",
        bash: "bash",
    };
    return langMap[ext] ?? "text";
}

/**
 * Extract filename from path
 */
function getFileName(filePath: string): string {
    return filePath.split("/").pop() ?? filePath;
}

export function FileWriter({
    toolCallId,
    status,
    filePath,
    content,
    error,
}: FileWriterProps) {
    const { copy, copiedId } = useCopyToClipboard();
    const isCopied = copiedId === "content";
    const [isExpanded, setIsExpanded] = useState(false);
    const isCompleted = status === "completed";

    const language = useMemo(() => {
        if (!filePath) return "text";
        return getLanguageFromPath(filePath);
    }, [filePath]);

    const fileName = filePath ? getFileName(filePath) : "file";

    // Stats
    const lineCount = content?.split("\n").length ?? 0;
    const charCount = content?.length ?? 0;

    // Truncate for collapsed preview
    const MAX_PREVIEW_LINES = 10;
    const lines = useMemo(() => content?.split("\n") ?? [], [content]);
    const needsExpansion = lines.length > MAX_PREVIEW_LINES;

    const displayContent = useMemo(() => {
        if (!content) return "";
        const displayLines =
            needsExpansion && !isExpanded ? lines.slice(0, MAX_PREVIEW_LINES) : lines;
        return `\`\`\`${language}\n${displayLines.join("\n")}\n\`\`\``;
    }, [content, language, needsExpansion, isExpanded, lines, MAX_PREVIEW_LINES]);

    return (
        <ToolRenderer
            toolName="Write"
            toolCallId={toolCallId}
            status={status}
            input={{ file_path: filePath }}
            output={
                isCompleted ? { lines: lineCount, characters: charCount } : undefined
            }
            error={error}
        >
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {isCompleted && !error ? (
                            <FileCheck className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                            <FilePlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-mono text-sm text-foreground">
                            {fileName}
                        </span>
                        {isCompleted && !error && (
                            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Written
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        {isCompleted && content && (
                            <button
                                onClick={() => copy(content, "content")}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="Copy content"
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
                    <div className="border-b border-border bg-muted/30 px-3 py-1">
                        <span className="font-mono text-xs text-muted-foreground">
                            {filePath}
                        </span>
                    </div>
                )}

                {/* Stats bar */}
                {isCompleted && content && (
                    <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                        <span>{lineCount.toLocaleString()} lines</span>
                        <span className="text-border">|</span>
                        <span>{charCount.toLocaleString()} characters</span>
                    </div>
                )}

                {/* Content preview */}
                <div className="max-h-80 overflow-auto">
                    <AnimatePresence mode="wait">
                        {status === "running" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-4 text-muted-foreground"
                            >
                                <FilePlus className="h-4 w-4 animate-pulse" />
                                <span className="text-sm">Writing file...</span>
                            </motion.div>
                        )}

                        {isCompleted && content && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="[&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!border-0"
                            >
                                <MarkdownRenderer content={displayContent} />
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
                                Show all {lineCount} lines
                            </>
                        )}
                    </button>
                )}
            </div>
        </ToolRenderer>
    );
}
