"use client";

/**
 * FileViewer - Syntax-highlighted file content display for Read tool
 *
 * Shows file content inline with proper visibility:
 * - Syntax highlighting via Shiki/Prism (through MarkdownRenderer)
 * - Line numbers in code blocks
 * - File path header with icon
 * - Copy button
 * - Collapsible for large files (visible first, can expand/collapse)
 */

import { useMemo, useState, useCallback } from "react";
import {
    FileText,
    FileCode,
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

interface FileViewerProps {
    toolCallId: string;
    status: ToolStatus;
    filePath?: string;
    content?: string;
    offset?: number;
    limit?: number;
    error?: string;
}

const MAX_COLLAPSED_LINES = 25;

/**
 * Get language for syntax highlighting from file path
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
        kt: "kotlin",
        swift: "swift",
        c: "c",
        cpp: "cpp",
        h: "c",
        hpp: "cpp",
        cs: "csharp",
        php: "php",
        sh: "bash",
        bash: "bash",
        zsh: "bash",
        fish: "fish",
        ps1: "powershell",
        sql: "sql",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        xml: "xml",
        html: "html",
        css: "css",
        scss: "scss",
        less: "less",
        md: "markdown",
        mdx: "mdx",
        graphql: "graphql",
        gql: "graphql",
        dockerfile: "dockerfile",
        makefile: "makefile",
        cmake: "cmake",
        env: "dotenv",
    };
    return langMap[ext] ?? "text";
}

/**
 * Check if file is a code file (for icon selection)
 */
function isCodeFile(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const codeExts = [
        "ts",
        "tsx",
        "js",
        "jsx",
        "py",
        "rb",
        "rs",
        "go",
        "java",
        "kt",
        "swift",
        "c",
        "cpp",
        "h",
        "cs",
        "php",
    ];
    return codeExts.includes(ext);
}

/**
 * Extract filename from path
 */
function getFileName(filePath: string): string {
    return filePath.split("/").pop() ?? filePath;
}

export function FileViewer({
    toolCallId,
    status,
    filePath,
    content,
    offset,
    limit,
    error,
}: FileViewerProps) {
    const { copy, copiedId } = useCopyToClipboard();
    const isCopied = copiedId === toolCallId;
    const [isExpanded, setIsExpanded] = useState(false);
    const isCompleted = status === "completed";
    const isRunning = status === "running";
    const isCodeFileType = filePath ? isCodeFile(filePath) : false;

    const language = useMemo(() => {
        if (!filePath) return "text";
        return getLanguageFromPath(filePath);
    }, [filePath]);

    const fileName = filePath ? getFileName(filePath) : "file";

    // Process content for display
    const lines = useMemo(() => content?.split("\n") ?? [], [content]);
    const lineCount = lines.length;
    const shouldCollapse = lineCount > MAX_COLLAPSED_LINES;
    const isCollapsed = shouldCollapse && !isExpanded;

    // Build the markdown code block
    const displayContent = useMemo(() => {
        if (!content) return "";
        const displayLines = isCollapsed ? lines.slice(0, MAX_COLLAPSED_LINES) : lines;
        return `\`\`\`${language}\n${displayLines.join("\n")}\n\`\`\``;
    }, [content, language, isCollapsed, lines]);

    // Build range info text
    const rangeInfo = useMemo(() => {
        if (offset === undefined && limit === undefined) return null;
        const start = (offset ?? 0) + 1;
        const end = start + lineCount - 1;
        return `Lines ${start}-${end}`;
    }, [offset, limit, lineCount]);

    const handleCopy = useCallback(() => {
        if (content) copy(content, toolCallId);
    }, [content, copy, toolCallId]);

    return (
        <div
            className="mb-3 w-full overflow-hidden rounded-lg border border-border bg-card"
            data-tool-call-id={toolCallId}
        >
            {/* File header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    {isCodeFileType ? (
                        <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-mono text-sm text-foreground">
                        {fileName}
                    </span>
                    {rangeInfo && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            ({rangeInfo})
                        </span>
                    )}
                    {lineCount > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {lineCount} lines
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

            {/* Full file path (if different from filename) */}
            {filePath && filePath !== fileName && (
                <div className="border-b border-border bg-muted/30 px-3 py-1">
                    <span className="font-mono text-xs text-muted-foreground">
                        {filePath}
                    </span>
                </div>
            )}

            {/* Content - VISIBLE BY DEFAULT */}
            <div className="relative">
                {/* Loading state */}
                {isRunning && (
                    <div className="flex items-center gap-2 p-4 text-muted-foreground">
                        <FileText className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Reading file...</span>
                    </div>
                )}

                {/* File content with syntax highlighting */}
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

                {/* Empty file */}
                {isCompleted && !content && !error && (
                    <div className="p-4 text-sm italic text-muted-foreground">
                        File is empty
                    </div>
                )}

                {/* Error message */}
                {error && <div className="p-4 text-sm text-red-500">{error}</div>}
            </div>

            {/* Expand/collapse button for long files */}
            {shouldCollapse && isCompleted && (
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
                            <span className="text-muted-foreground/60">
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
    );
}
