"use client";

/**
 * SessionChangesPanel - Aggregate view of all git changes in the session
 *
 * Shows uncommitted changes vs HEAD with:
 * - File list with status indicators (added, modified, deleted)
 * - Aggregate stats (files changed, lines +/-)
 * - Expandable file diffs
 * - Collapsible panel design
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    GitBranch,
    FileEdit,
    FilePlus,
    FileX,
    ChevronDown,
    ChevronRight,
    Loader2,
    RefreshCw,
    Plus,
    Minus,
    FolderGit2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useConnection } from "@/components/connection/connection-context";
import { DiffViewer } from "./diff-viewer";

interface FileChange {
    path: string;
    status: "added" | "modified" | "deleted";
    additions: number;
    deletions: number;
}

interface SessionChangesData {
    files: FileChange[];
    totalAdditions: number;
    totalDeletions: number;
    error?: string;
}

interface SessionChangesPanelProps {
    /** Classname for the panel container */
    className?: string;
    /** Whether to auto-refresh periodically */
    autoRefresh?: boolean;
    /** Auto-refresh interval in ms (default: 30000) */
    refreshInterval?: number;
}

/**
 * Fetch git status and diff stats from the API
 */
async function fetchSessionChanges(projectPath: string): Promise<SessionChangesData> {
    // Strip trailing slash before extracting repo name
    const normalizedPath = projectPath.replace(/\/+$/, "");
    const repoSlug = normalizedPath.split("/").pop() ?? "";

    const response = await fetch(`/api/code/${repoSlug}/git/status`);

    if (!response.ok) {
        throw new Error("Failed to fetch git status");
    }

    return response.json();
}

/**
 * Fetch diff content for a specific file
 */
async function fetchFileDiff(
    projectPath: string,
    filePath: string
): Promise<{ oldContent: string; newContent: string }> {
    // Strip trailing slash before extracting repo name
    const normalizedPath = projectPath.replace(/\/+$/, "");
    const repoSlug = normalizedPath.split("/").pop() ?? "";

    // Fetch both versions in parallel
    const [headResponse, currentResponse] = await Promise.all([
        fetch(
            `/api/code/${repoSlug}/files/content?path=${encodeURIComponent(filePath)}&ref=HEAD`
        ),
        fetch(
            `/api/code/${repoSlug}/files/content?path=${encodeURIComponent(filePath)}`
        ),
    ]);

    const headData = await headResponse.json();
    const currentData = await currentResponse.json();

    return {
        oldContent: headData.content ?? "",
        newContent: currentData.content ?? "",
    };
}

export function SessionChangesPanel({
    className,
    autoRefresh = false,
    refreshInterval = 30000,
}: SessionChangesPanelProps) {
    const { projectPath } = useConnection();
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<SessionChangesData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [fileDiffs, setFileDiffs] = useState<
        Record<string, { oldContent: string; newContent: string }>
    >({});
    const [loadingDiffs, setLoadingDiffs] = useState<Set<string>>(new Set());

    const refresh = useCallback(async () => {
        if (!projectPath) return;

        setIsLoading(true);
        setError(null);

        try {
            const changesData = await fetchSessionChanges(projectPath);
            setData(changesData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch changes");
        } finally {
            setIsLoading(false);
        }
    }, [projectPath]);

    // Initial load
    useEffect(() => {
        if (projectPath) {
            refresh();
        }
    }, [projectPath, refresh]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh || !projectPath) return;

        const interval = setInterval(refresh, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, projectPath, refresh, refreshInterval]);

    // Toggle file expansion and load diff if needed
    const toggleFile = useCallback(
        async (filePath: string) => {
            const newExpanded = new Set(expandedFiles);

            if (newExpanded.has(filePath)) {
                newExpanded.delete(filePath);
            } else {
                newExpanded.add(filePath);

                // Load diff if not already loaded
                if (!fileDiffs[filePath] && projectPath) {
                    setLoadingDiffs((prev) => new Set(prev).add(filePath));

                    try {
                        const diff = await fetchFileDiff(projectPath, filePath);
                        setFileDiffs((prev) => ({ ...prev, [filePath]: diff }));
                    } catch {
                        // Silently fail - will show empty diff
                    } finally {
                        setLoadingDiffs((prev) => {
                            const next = new Set(prev);
                            next.delete(filePath);
                            return next;
                        });
                    }
                }
            }

            setExpandedFiles(newExpanded);
        },
        [expandedFiles, fileDiffs, projectPath]
    );

    // Get file icon based on status
    const getFileIcon = (status: FileChange["status"]) => {
        switch (status) {
            case "added":
                return <FilePlus className="h-4 w-4 text-green-500" />;
            case "deleted":
                return <FileX className="h-4 w-4 text-red-500" />;
            default:
                return <FileEdit className="h-4 w-4 text-amber-500" />;
        }
    };

    // Get filename from path
    const getFileName = (path: string) => path.split("/").pop() ?? path;

    // Sorted files (modified first, then added, then deleted)
    const sortedFiles = useMemo(() => {
        if (!data?.files) return [];

        return [...data.files].sort((a, b) => {
            const order = { modified: 0, added: 1, deleted: 2 };
            return order[a.status] - order[b.status];
        });
    }, [data?.files]);

    if (!projectPath) {
        return null;
    }

    return (
        <div
            className={cn(
                "border-border bg-card overflow-hidden rounded-lg border",
                className
            )}
        >
            {/* Header */}
            <div className="border-border bg-muted/50 flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 text-purple-500" />
                    <span className="text-foreground text-sm font-medium">
                        Session Changes
                    </span>
                    {data && data.files.length > 0 && (
                        <span className="text-muted-foreground text-xs">
                            {data.files.length} file
                            {data.files.length !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Aggregate stats */}
                    {data && (data.totalAdditions > 0 || data.totalDeletions > 0) && (
                        <div className="flex items-center gap-2 text-xs">
                            {data.totalAdditions > 0 && (
                                <span className="flex items-center gap-0.5 text-green-500">
                                    <Plus className="h-3 w-3" />
                                    {data.totalAdditions}
                                </span>
                            )}
                            {data.totalDeletions > 0 && (
                                <span className="flex items-center gap-0.5 text-red-500">
                                    <Minus className="h-3 w-3" />
                                    {data.totalDeletions}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Refresh button */}
                    <button
                        onClick={refresh}
                        disabled={isLoading}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors disabled:opacity-50"
                        aria-label="Refresh changes"
                    >
                        <RefreshCw
                            className={cn("h-4 w-4", isLoading && "animate-spin")}
                        />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
                {/* Loading state */}
                {isLoading && !data && (
                    <div className="text-muted-foreground flex items-center gap-2 p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading changes...</span>
                    </div>
                )}

                {/* Error state */}
                {error && <div className="p-4 text-sm text-red-500">{error}</div>}

                {/* Empty state */}
                {data && data.files.length === 0 && (
                    <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center">
                        <GitBranch className="h-8 w-8 opacity-50" />
                        <span className="text-sm">No uncommitted changes</span>
                        <span className="text-xs opacity-70">
                            Your working directory is clean
                        </span>
                    </div>
                )}

                {/* File list */}
                {data && data.files.length > 0 && (
                    <div className="divide-border divide-y">
                        {sortedFiles.map((file) => (
                            <div key={file.path}>
                                {/* File header */}
                                <button
                                    onClick={() => toggleFile(file.path)}
                                    className="hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                                >
                                    {expandedFiles.has(file.path) ? (
                                        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                                    ) : (
                                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                                    )}
                                    {getFileIcon(file.status)}
                                    <span className="text-foreground flex-1 truncate font-mono text-sm">
                                        {getFileName(file.path)}
                                    </span>
                                    <span className="text-muted-foreground truncate font-mono text-xs">
                                        {file.path !== getFileName(file.path) &&
                                            file.path}
                                    </span>
                                    {(file.additions > 0 || file.deletions > 0) && (
                                        <div className="flex items-center gap-1 text-xs">
                                            {file.additions > 0 && (
                                                <span className="text-green-500">
                                                    +{file.additions}
                                                </span>
                                            )}
                                            {file.deletions > 0 && (
                                                <span className="text-red-500">
                                                    -{file.deletions}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>

                                {/* Expanded diff */}
                                {expandedFiles.has(file.path) && (
                                    <div className="border-border border-t bg-black/5 dark:bg-white/5">
                                        {loadingDiffs.has(file.path) ? (
                                            <div className="text-muted-foreground flex items-center gap-2 p-4">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-sm">
                                                    Loading diff...
                                                </span>
                                            </div>
                                        ) : fileDiffs[file.path] ? (
                                            <DiffViewer
                                                oldValue={
                                                    fileDiffs[file.path].oldContent
                                                }
                                                newValue={
                                                    fileDiffs[file.path].newContent
                                                }
                                                oldTitle="HEAD"
                                                newTitle="Working"
                                                filePath={file.path}
                                            />
                                        ) : (
                                            <div className="text-muted-foreground p-4 text-sm">
                                                Unable to load diff
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
