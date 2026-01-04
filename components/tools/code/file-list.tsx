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
    FileJs,
    File,
    Image,
    VideoCamera,
    MusicNotes,
    CaretDown,
    CaretUp,
    MagnifyingGlass,
    CircleNotch,
} from "@phosphor-icons/react";

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
        json: FileJs,
        yaml: FileJs,
        yml: FileJs,
        toml: FileJs,
        xml: FileJs,
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
        mp4: VideoCamera,
        webm: VideoCamera,
        mov: VideoCamera,
        mp3: MusicNotes,
        wav: MusicNotes,
        ogg: MusicNotes,
    };

    return iconMap[ext] ?? File;
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
            className="border-border bg-card mb-3 w-full overflow-hidden rounded-lg border"
            data-tool-call-id={toolCallId}
        >
            {/* Header */}
            <div className="border-border bg-muted/50 flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <MagnifyingGlass className="text-muted-foreground h-4 w-4 shrink-0" />
                    <code className="text-foreground truncate font-mono text-sm">
                        {pattern}
                    </code>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning && (
                        <CircleNotch className="text-muted-foreground h-4 w-4 animate-spin" />
                    )}
                    {isCompleted && (
                        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                            {fileCount} file{fileCount !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>
            </div>

            {/* Search path */}
            {path && (
                <div className="border-border bg-muted/30 border-b px-3 py-1">
                    <span className="text-muted-foreground font-mono text-xs">
                        in {path}
                    </span>
                </div>
            )}

            {/* File list - VISIBLE BY DEFAULT */}
            <div className="max-h-80 overflow-auto">
                {/* Loading state */}
                {isRunning && (
                    <div className="text-muted-foreground flex items-center gap-2 p-4">
                        <MagnifyingGlass className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Searching for files...</span>
                    </div>
                )}

                {/* File listing */}
                {isCompleted && files && files.length > 0 && (
                    <ul className="divide-border divide-y">
                        {displayFiles.map((file, idx) => {
                            const Icon = getFileIcon(file);
                            const name = getFileName(file);
                            const parent = getParentPath(file);

                            return (
                                <li
                                    key={`${file}-${idx}`}
                                    className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2"
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
                                        <span className="text-foreground block truncate font-mono text-sm">
                                            {name}
                                        </span>
                                        {parent && (
                                            <span className="text-muted-foreground block truncate font-mono text-xs">
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
                    <div className="text-muted-foreground p-4 text-center text-sm">
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
