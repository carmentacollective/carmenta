"use client";

/**
 * FileViewer - Syntax-highlighted file content display for Read tool
 *
 * Features:
 * - Syntax highlighting via Shiki
 * - Line numbers
 * - File path header with icon
 * - Copy button
 * - Expandable for large files
 */

import { useMemo } from "react";
import { FileText, FileCode, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useCopyToClipboard } from "@/components/tool-ui/shared/use-copy-to-clipboard";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ToolRenderer } from "../tool-renderer";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { useState } from "react";

interface FileViewerProps {
    toolCallId: string;
    status: ToolStatus;
    filePath?: string;
    content?: string;
    offset?: number;
    limit?: number;
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
    const isCopied = copiedId === "content";
    const [isExpanded, setIsExpanded] = useState(false);
    const isCompleted = status === "completed";

    const language = useMemo(() => {
        if (!filePath) return "text";
        return getLanguageFromPath(filePath);
    }, [filePath]);

    const isCodeFile = useMemo(() => {
        if (!filePath) return false;
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
    }, [filePath]);

    const fileName = filePath ? getFileName(filePath) : "file";

    // Count lines and determine if we need expansion
    const lines = useMemo(() => content?.split("\n") ?? [], [content]);
    const lineCount = lines.length;
    const MAX_COLLAPSED_LINES = 30;
    const needsExpansion = lineCount > MAX_COLLAPSED_LINES;

    // Build the code block for markdown rendering
    const displayContent = useMemo(() => {
        if (!content) return "";
        const displayLines =
            needsExpansion && !isExpanded ? lines.slice(0, MAX_COLLAPSED_LINES) : lines;
        return `\`\`\`${language}\n${displayLines.join("\n")}\n\`\`\``;
    }, [content, language, needsExpansion, isExpanded, lines, MAX_COLLAPSED_LINES]);

    // Build range info text
    const rangeInfo = useMemo(() => {
        if (offset === undefined && limit === undefined) return null;
        const start = (offset ?? 0) + 1;
        const end = start + lineCount - 1;
        return `Lines ${start}-${end}`;
    }, [offset, limit, lineCount]);

    return (
        <ToolRenderer
            toolName="Read"
            toolCallId={toolCallId}
            status={status}
            input={{ file_path: filePath, offset, limit }}
            output={content ? { content: content.slice(0, 200) + "..." } : undefined}
            error={error}
        >
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {/* File header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {isCodeFile ? (
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

                {/* File path tooltip */}
                {filePath && filePath !== fileName && (
                    <div className="border-b border-border bg-muted/30 px-3 py-1">
                        <span className="font-mono text-xs text-muted-foreground">
                            {filePath}
                        </span>
                    </div>
                )}

                {/* Content */}
                <div className="max-h-96 overflow-auto">
                    <AnimatePresence mode="wait">
                        {status === "running" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-4 text-muted-foreground"
                            >
                                <FileText className="h-4 w-4 animate-pulse" />
                                <span className="text-sm">Reading file...</span>
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

                        {isCompleted && !content && !error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-4 text-sm text-muted-foreground"
                            >
                                File is empty
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Expansion toggle */}
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
