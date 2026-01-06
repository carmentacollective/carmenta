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
 * - "Show diff" button to compare against previous version (on-demand)
 */

import { useState, useMemo, useCallback } from "react";
import {
    FilePlusIcon,
    CheckCircleIcon,
    CopyIcon,
    CheckIcon,
    CaretDownIcon,
    CaretUpIcon,
    CircleNotchIcon,
    GitDiffIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { useConnection } from "@/components/connection/connection-context";
import { DiffViewer } from "./diff-viewer";
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
    const { projectPath } = useConnection();
    const isCopied = copiedId === toolCallId;
    const [isExpanded, setIsExpanded] = useState(false);
    const [showDiff, setShowDiff] = useState(false);
    const [previousContent, setPreviousContent] = useState<string | null>(null);
    const [isLoadingDiff, setIsLoadingDiff] = useState(false);
    const [isNewFile, setIsNewFile] = useState(false);
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

    /**
     * Fetch previous content from git to show diff
     */
    const handleShowDiff = useCallback(async () => {
        if (!filePath || !projectPath) return;

        setIsLoadingDiff(true);
        try {
            // Derive repo slug and relative path
            // Strip trailing slash before extracting repo name
            const normalizedPath = projectPath.replace(/\/+$/, "");
            const repoSlug = normalizedPath.split("/").pop() ?? "";
            const relativePath = filePath.startsWith(projectPath)
                ? filePath.slice(projectPath.length)
                : filePath;

            // Fetch previous content from git HEAD
            const response = await fetch(
                `/api/code/${repoSlug}/files/content?path=${encodeURIComponent(relativePath)}&ref=HEAD`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch previous content");
            }

            const data = await response.json();

            if (data.isNewFile || data.content === null) {
                // File is new (doesn't exist in git)
                setIsNewFile(true);
                setPreviousContent("");
            } else {
                setPreviousContent(data.content);
            }
            setShowDiff(true);
        } catch (err) {
            // If we can't fetch, assume it's a new file
            setIsNewFile(true);
            setPreviousContent("");
            setShowDiff(true);
        } finally {
            setIsLoadingDiff(false);
        }
    }, [filePath, projectPath]);

    return (
        <div
            className="border-border bg-card mb-3 w-full overflow-hidden rounded-lg border"
            data-tool-call-id={toolCallId}
        >
            {/* Header */}
            <div className="border-border bg-muted/50 flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    {isCompleted && !error ? (
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                        <FilePlusIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                    <span className="text-foreground truncate font-mono text-sm">
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
                        <CircleNotchIcon className="text-muted-foreground h-4 w-4 animate-spin" />
                    )}

                    {/* Show diff button - on demand comparison to git HEAD */}
                    {isCompleted && content && projectPath && !showDiff && (
                        <button
                            onClick={handleShowDiff}
                            disabled={isLoadingDiff}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
                            aria-label="Show diff against previous version"
                        >
                            {isLoadingDiff ? (
                                <CircleNotchIcon className="h-3 w-3 animate-spin" />
                            ) : (
                                <GitDiffIcon className="h-3 w-3" />
                            )}
                            <span>Show diff</span>
                        </button>
                    )}

                    {/* Hide diff button */}
                    {showDiff && (
                        <button
                            onClick={() => setShowDiff(false)}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                        >
                            <span>Hide diff</span>
                        </button>
                    )}

                    {/* Copy button */}
                    {isCompleted && content && (
                        <button
                            onClick={handleCopy}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
                            aria-label="Copy content"
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

            {/* File path */}
            {filePath && filePath !== fileName && (
                <div className="border-border bg-muted/30 border-b px-3 py-1">
                    <span className="text-muted-foreground font-mono text-xs">
                        {filePath}
                    </span>
                </div>
            )}

            {/* Stats bar */}
            {isCompleted && content && (
                <div className="border-border bg-muted/20 text-muted-foreground flex items-center gap-3 border-b px-3 py-1.5 text-xs">
                    <span>{lineCount.toLocaleString()} lines</span>
                    <span className="text-border">|</span>
                    <span>{charCount.toLocaleString()} characters</span>
                </div>
            )}

            {/* Content - VISIBLE BY DEFAULT */}
            <div className="relative">
                {/* Loading state */}
                {isRunning && (
                    <div className="text-muted-foreground flex items-center gap-2 p-4">
                        <FilePlusIcon className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Writing file...</span>
                    </div>
                )}

                {/* Diff view - on demand comparison to git HEAD */}
                {isCompleted && content && showDiff && previousContent !== null && (
                    <div className="p-2">
                        {isNewFile ? (
                            <div className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
                                <FilePlusIcon className="h-4 w-4 text-green-500" />
                                <span>New file - no previous version to compare</span>
                            </div>
                        ) : (
                            <DiffViewer
                                oldValue={previousContent}
                                newValue={content}
                                oldTitle="HEAD"
                                newTitle="New"
                                filePath={filePath}
                            />
                        )}
                    </div>
                )}

                {/* Content preview with syntax highlighting */}
                {isCompleted && content && !showDiff && (
                    <div
                        className={cn(
                            "[&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!border-0",
                            isCollapsed && "max-h-[400px] overflow-hidden"
                        )}
                    >
                        <MarkdownRenderer content={displayContent} />

                        {/* Gradient fade when collapsed */}
                        {isCollapsed && (
                            <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent" />
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
                        "border-border flex w-full items-center justify-center gap-1.5 border-t py-2",
                        "text-muted-foreground text-sm transition-colors",
                        "hover:bg-muted/50 hover:text-foreground"
                    )}
                >
                    {isCollapsed ? (
                        <>
                            <CaretDownIcon className="h-4 w-4" />
                            Show all {lineCount} lines
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
