"use client";

/**
 * FileWriter - Display for Write tool showing file creation/overwrite
 *
 * Shows file write inline with clear visibility:
 * - File path with success/error indicator
 * - Content preview with syntax highlighting
 * - Character/line count
 * - Expand/collapse for long content
 * - Content visible immediately (not hidden)
 */

import { useState, useMemo, useCallback } from "react";
import {
    FilePlus,
    FileCheck,
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
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
    const isCopied = copiedId === toolCallId;
    const [isExpanded, setIsExpanded] = useState(false);
    const isCompleted = status === "completed";
    const isRunning = status === "running";

    const language = useMemo(() => {
        if (!filePath) return "text";
        return getLanguageFromPath(filePath);
    }, [filePath]);

    const fileName = filePath ? getFileName(filePath) : "file";

    // Stats
    const lines = useMemo(() => content?.split("\n") ?? [], [content]);
    const lineCount = lines.length;
    const charCount = content?.length ?? 0;

    // Truncate for collapsed preview
    const MAX_PREVIEW_LINES = 15;
    const needsExpansion = lineCount > MAX_PREVIEW_LINES;
    const isCollapsed = needsExpansion && !isExpanded;

    const displayContent = useMemo(() => {
        if (!content) return "";
        const displayLines = isCollapsed ? lines.slice(0, MAX_PREVIEW_LINES) : lines;
        return `\`\`\`${language}\n${displayLines.join("\n")}\n\`\`\``;
    }, [content, language, isCollapsed, lines]);

    const handleCopy = useCallback(() => {
        if (content) copy(content, toolCallId);
    }, [content, copy, toolCallId]);

    return (
        <div
            className="mb-3 w-full overflow-hidden rounded-lg border border-border bg-card"
            data-tool-call-id={toolCallId}
        >
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

                <div className="flex items-center gap-2">
                    {/* Loading indicator */}
                    {isRunning && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}

                    {/* Copy button */}
                    {isCompleted && content && (
                        <button
                            onClick={handleCopy}
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

            {/* Content - VISIBLE BY DEFAULT */}
            <div className="relative">
                {/* Loading state */}
                {isRunning && (
                    <div className="flex items-center gap-2 p-4 text-muted-foreground">
                        <FilePlus className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Writing file...</span>
                    </div>
                )}

                {/* Content preview with syntax highlighting */}
                {isCompleted && content && (
                    <div
                        className={cn(
                            "[&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!border-0",
                            isCollapsed && "max-h-[400px] overflow-hidden"
                        )}
                    >
                        <MarkdownRenderer content={displayContent} />

                        {/* Gradient fade when collapsed */}
                        {isCollapsed && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
                        )}
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
                        "flex w-full items-center justify-center gap-1.5 border-t border-border py-2",
                        "text-sm text-muted-foreground transition-colors",
                        "hover:bg-muted/50 hover:text-foreground"
                    )}
                >
                    {isCollapsed ? (
                        <>
                            <ChevronDown className="h-4 w-4" />
                            Show all {lineCount} lines
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
    );
}
