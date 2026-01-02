"use client";

/**
 * File Explorer Component
 *
 * Collapsible file browser for code mode.
 * Shows project structure with search, expand/collapse, and file preview.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, FolderTree, RefreshCw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCodeMode } from "@/components/connection/connect-runtime-provider";
import { FileTree } from "./file-tree";
import { FilePreview } from "./file-preview";
import { type FileEntry, getExpandedPathsForSearch } from "@/lib/code-mode/file-utils";
import { logger } from "@/lib/client-logger";

/**
 * Global cache for directory contents (persists across component remounts)
 */
const globalDirectoryCache = new Map<string, FileEntry[]>();

export function FileExplorer() {
    const { isCodeMode, projectPath } = useCodeMode();

    // UI state
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Tree state
    const [rootFiles, setRootFiles] = useState<FileEntry[]>([]);
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
    const [childrenCache, setChildrenCache] = useState<Map<string, FileEntry[]>>(
        new Map()
    );

    // Search debounce
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get repo slug from project path
    const repoSlug = useMemo(() => {
        if (!projectPath) return null;
        return projectPath.split("/").pop() ?? null;
    }, [projectPath]);

    // Load root directory
    const loadRootDirectory = useCallback(async () => {
        if (!repoSlug) return;

        setIsLoading(true);

        try {
            // Check global cache first
            const cacheKey = `${repoSlug}:/`;
            if (globalDirectoryCache.has(cacheKey)) {
                setRootFiles(globalDirectoryCache.get(cacheKey) ?? []);
            }

            // Fetch fresh data
            const response = await fetch(`/api/code/${repoSlug}/files?path=/`);

            if (!response.ok) {
                throw new Error(`Failed to load files: ${response.statusText}`);
            }

            const data = await response.json();
            const files = data.files as FileEntry[];

            // Update cache and state
            globalDirectoryCache.set(cacheKey, files);
            setRootFiles(files);
        } catch (err) {
            logger.error(
                { error: err, repo: repoSlug },
                "Failed to load root directory"
            );
        } finally {
            setIsLoading(false);
        }
    }, [repoSlug]);

    // Load children for a directory
    const loadChildren = useCallback(
        async (dirPath: string): Promise<FileEntry[]> => {
            if (!repoSlug) return [];

            const cacheKey = `${repoSlug}:${dirPath}`;

            // Check global cache
            if (globalDirectoryCache.has(cacheKey)) {
                const cached = globalDirectoryCache.get(cacheKey) ?? [];
                setChildrenCache((prev) => new Map(prev).set(dirPath, cached));
                return cached;
            }

            try {
                const response = await fetch(
                    `/api/code/${repoSlug}/files?path=${encodeURIComponent(dirPath)}`
                );

                if (!response.ok) {
                    throw new Error(`Failed to load directory: ${response.statusText}`);
                }

                const data = await response.json();
                const files = data.files as FileEntry[];

                // Update caches
                globalDirectoryCache.set(cacheKey, files);
                setChildrenCache((prev) => new Map(prev).set(dirPath, files));

                return files;
            } catch (err) {
                logger.error({ error: err, path: dirPath }, "Failed to load directory");
                return [];
            }
        },
        [repoSlug]
    );

    // Toggle directory expansion
    const toggleDir = useCallback((path: string) => {
        setExpandedDirs((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    // Handle file selection
    const handleSelectFile = useCallback((file: FileEntry) => {
        if (file.type === "file") {
            setSelectedFile(file);
            setIsPreviewOpen(true);
        }
    }, []);

    // Handle search with debounce
    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchQuery(value);

            // Debounce auto-expand
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            if (value.trim()) {
                searchTimeoutRef.current = setTimeout(() => {
                    // Get all files including children
                    const allFiles = [...rootFiles];
                    childrenCache.forEach((children) => {
                        allFiles.push(...children);
                    });

                    // Auto-expand matching directories
                    const pathsToExpand = getExpandedPathsForSearch(allFiles, value);
                    setExpandedDirs((prev) => new Set([...prev, ...pathsToExpand]));
                }, 300);
            }
        },
        [rootFiles, childrenCache]
    );

    // Clear search
    const clearSearch = useCallback(() => {
        setSearchQuery("");
    }, []);

    // Load root when expanded
    useEffect(() => {
        if (isExpanded && repoSlug && rootFiles.length === 0) {
            loadRootDirectory();
        }
    }, [isExpanded, repoSlug, rootFiles.length, loadRootDirectory]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Filter files based on search
    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return rootFiles;

        const lowerQuery = searchQuery.toLowerCase();
        return rootFiles.filter(
            (file) =>
                file.name.toLowerCase().includes(lowerQuery) ||
                file.path.toLowerCase().includes(lowerQuery)
        );
    }, [rootFiles, searchQuery]);

    // Don't render if not in code mode
    if (!isCodeMode || !projectPath) return null;

    return (
        <>
            {/* Collapsible panel */}
            <motion.div
                className={cn(
                    "border-foreground/5 relative z-10 shrink-0 border-b",
                    "dark:bg-card/40 bg-white/40 backdrop-blur-xl"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {/* Toggle header */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "flex w-full items-center justify-between px-4 py-2 transition-colors",
                        "hover:bg-foreground/5 sm:px-5"
                    )}
                >
                    <div className="text-foreground/70 flex items-center gap-2 text-sm font-medium">
                        <FolderTree className="h-4 w-4" />
                        <span>Files</span>
                        {rootFiles.length > 0 && (
                            <span className="bg-foreground/10 rounded-full px-1.5 py-0.5 text-xs">
                                {rootFiles.length}
                            </span>
                        )}
                    </div>
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="text-muted-foreground h-4 w-4" />
                    </motion.div>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            {/* Search bar */}
                            <div className="border-foreground/5 flex items-center gap-2 border-t px-4 py-2 sm:px-5">
                                <div className="relative flex-1">
                                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search files..."
                                        value={searchQuery}
                                        onChange={(e) =>
                                            handleSearchChange(e.target.value)
                                        }
                                        className={cn(
                                            "border-foreground/10 bg-background/50 w-full rounded-md border py-1.5 pr-8 pl-8 text-sm",
                                            "placeholder:text-muted-foreground focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                                        )}
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={clearSearch}
                                            className="hover:bg-foreground/10 absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
                                        >
                                            <X className="text-muted-foreground h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={loadRootDirectory}
                                    disabled={isLoading}
                                    className="h-8 w-8 shrink-0"
                                    title="Refresh"
                                >
                                    <RefreshCw
                                        className={cn(
                                            "h-4 w-4",
                                            isLoading && "animate-spin"
                                        )}
                                    />
                                </Button>
                            </div>

                            {/* File tree */}
                            <div className="max-h-64 overflow-y-auto px-2 pb-2 sm:max-h-80">
                                {isLoading && rootFiles.length === 0 ? (
                                    <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                                        Loading files...
                                    </div>
                                ) : filteredFiles.length === 0 ? (
                                    <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                                        {searchQuery
                                            ? "No matching files"
                                            : "No files found"}
                                    </div>
                                ) : (
                                    <FileTree
                                        files={filteredFiles}
                                        selectedPath={selectedFile?.path}
                                        onSelectFile={handleSelectFile}
                                        expandedDirs={expandedDirs}
                                        onToggleDir={toggleDir}
                                        loadChildren={loadChildren}
                                        childrenCache={childrenCache}
                                        searchQuery={searchQuery}
                                    />
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* File preview modal */}
            {repoSlug && (
                <FilePreview
                    file={isPreviewOpen ? selectedFile : null}
                    repo={repoSlug}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </>
    );
}
