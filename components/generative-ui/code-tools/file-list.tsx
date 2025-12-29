"use client";

/**
 * FileList - File listing display for Glob tool
 *
 * Features:
 * - File/folder icons based on type
 * - Pattern display
 * - Count badge
 * - Scrollable list with truncation
 */

import { useMemo, useState } from "react";
import {
    Folder,
    FileText,
    FileCode,
    FileJson,
    FileType,
    Image,
    Video,
    Music,
    ChevronDown,
    ChevronUp,
    Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { ToolRenderer } from "../tool-renderer";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface FileListProps {
    toolCallId: string;
    status: ToolStatus;
    pattern?: string;
    path?: string;
    files?: string[];
    error?: string;
}

type LucideIcon = typeof FileText;

/**
 * Get icon for file based on extension
 */
function getFileIcon(fileName: string): LucideIcon {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

    // Check if it looks like a directory (ends with / or no extension + no dot)
    if (fileName.endsWith("/") || (!fileName.includes(".") && !ext)) {
        return Folder;
    }

    const iconMap: Record<string, LucideIcon> = {
        // Code files
        ts: FileCode,
        tsx: FileCode,
        js: FileCode,
        jsx: FileCode,
        py: FileCode,
        rb: FileCode,
        rs: FileCode,
        go: FileCode,
        java: FileCode,
        kt: FileCode,
        swift: FileCode,
        c: FileCode,
        cpp: FileCode,
        h: FileCode,
        cs: FileCode,
        php: FileCode,
        // Config/data
        json: FileJson,
        yaml: FileJson,
        yml: FileJson,
        toml: FileJson,
        xml: FileJson,
        // Text
        md: FileText,
        txt: FileText,
        // Media
        png: Image,
        jpg: Image,
        jpeg: Image,
        gif: Image,
        svg: Image,
        webp: Image,
        mp4: Video,
        webm: Video,
        mov: Video,
        mp3: Music,
        wav: Music,
        ogg: Music,
    };

    return iconMap[ext] ?? FileType;
}

/**
 * Extract filename from full path
 */
function getFileName(path: string): string {
    return path.split("/").pop() ?? path;
}

/**
 * Get parent directory path
 */
function getParentPath(filePath: string): string | null {
    const parts = filePath.split("/");
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join("/");
}

export function FileList({
    toolCallId,
    status,
    pattern,
    path,
    files,
    error,
}: FileListProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const isCompleted = status === "completed";
    const fileCount = files?.length ?? 0;

    // Show first N files, then expand for rest
    const MAX_COLLAPSED = 10;
    const needsExpansion = fileCount > MAX_COLLAPSED;
    const displayFiles = useMemo(() => {
        if (!files) return [];
        return needsExpansion && !isExpanded ? files.slice(0, MAX_COLLAPSED) : files;
    }, [files, needsExpansion, isExpanded]);

    return (
        <ToolRenderer
            toolName="Glob"
            toolCallId={toolCallId}
            status={status}
            input={{ pattern, path }}
            output={isCompleted ? { count: fileCount } : undefined}
            error={error}
        >
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <code className="truncate font-mono text-sm text-foreground">
                            {pattern}
                        </code>
                    </div>
                    {isCompleted && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {fileCount} file{fileCount !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                {/* Search path */}
                {path && (
                    <div className="border-b border-border bg-muted/30 px-3 py-1">
                        <span className="font-mono text-xs text-muted-foreground">
                            in {path}
                        </span>
                    </div>
                )}

                {/* File list */}
                <div className="max-h-80 overflow-auto">
                    <AnimatePresence mode="wait">
                        {status === "running" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-4 text-muted-foreground"
                            >
                                <Search className="h-4 w-4 animate-pulse" />
                                <span className="text-sm">Searching for files...</span>
                            </motion.div>
                        )}

                        {isCompleted && files && files.length > 0 && (
                            <motion.ul
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="divide-y divide-border"
                            >
                                {displayFiles.map((file, idx) => {
                                    const Icon = getFileIcon(file);
                                    const name = getFileName(file);
                                    const parent = getParentPath(file);

                                    return (
                                        <li
                                            key={`${file}-${idx}`}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50"
                                        >
                                            <Icon
                                                className={cn(
                                                    "h-4 w-4 shrink-0",
                                                    Icon === Folder
                                                        ? "text-amber-500"
                                                        : "text-muted-foreground"
                                                )}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className="block truncate font-mono text-sm text-foreground">
                                                    {name}
                                                </span>
                                                {parent && (
                                                    <span className="block truncate font-mono text-xs text-muted-foreground">
                                                        {parent}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </motion.ul>
                        )}

                        {isCompleted && files && files.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-4 text-center text-sm text-muted-foreground"
                            >
                                No files matched the pattern
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
