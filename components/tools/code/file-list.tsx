"use client";

/**
 * FileList - File listing display for Glob tool
 *
 * Shows file list inline with clear visibility:
 * - File/folder icons based on type
 * - Pattern display in header
 * - Count badge
 * - Scrollable list with expand/collapse
 * - Content visible immediately (not hidden)
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
    Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
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
    const isRunning = status === "running";
    const fileCount = files?.length ?? 0;

    // Show first N files, then expand for rest
    const MAX_COLLAPSED = 10;
    const needsExpansion = fileCount > MAX_COLLAPSED;
    const displayFiles = useMemo(() => {
        if (!files) return [];
        return needsExpansion && !isExpanded ? files.slice(0, MAX_COLLAPSED) : files;
    }, [files, needsExpansion, isExpanded]);

    return (
        <div
            className="mb-3 w-full overflow-hidden rounded-lg border border-border bg-card"
            data-tool-call-id={toolCallId}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <code className="truncate font-mono text-sm text-foreground">
                        {pattern}
                    </code>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {isCompleted && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {fileCount} file{fileCount !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>
            </div>

            {/* Search path */}
            {path && (
                <div className="border-b border-border bg-muted/30 px-3 py-1">
                    <span className="font-mono text-xs text-muted-foreground">
                        in {path}
                    </span>
                </div>
            )}

            {/* File list - VISIBLE BY DEFAULT */}
            <div className="max-h-80 overflow-auto">
                {/* Loading state */}
                {isRunning && (
                    <div className="flex items-center gap-2 p-4 text-muted-foreground">
                        <Search className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Searching for files...</span>
                    </div>
                )}

                {/* File listing */}
                {isCompleted && files && files.length > 0 && (
                    <ul className="divide-y divide-border">
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
                    </ul>
                )}

                {/* No files found */}
                {isCompleted && files && files.length === 0 && !error && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No files matched the pattern
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
                    {isExpanded ? (
                        <>
                            <ChevronUp className="h-4 w-4" />
                            Collapse
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-4 w-4" />
                            Show all {fileCount} files
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
