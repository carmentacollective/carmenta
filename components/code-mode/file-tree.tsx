"use client";

/**
 * File Tree Component
 *
 * Recursive tree view for displaying directory structure.
 * Supports expand/collapse, file selection, and keyboard navigation.
 */

import {
    useCallback,
    useState,
    useMemo,
    memo,
    useRef,
    useEffect,
    type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    type FileEntry,
    getFileIconColor,
    formatFileSize,
} from "@/lib/code-mode/file-utils";
import {
    File,
    FileCode,
    FileJson,
    FileText,
    FileImage,
    Folder,
    FolderOpen,
} from "lucide-react";

interface FileTreeProps {
    /** Files at the current level */
    files: FileEntry[];
    /** Currently selected file path */
    selectedPath?: string;
    /** Callback when a file is selected */
    onSelectFile: (file: FileEntry) => void;
    /** Set of expanded directory paths */
    expandedDirs: Set<string>;
    /** Callback to toggle directory expansion */
    onToggleDir: (path: string) => void;
    /** Function to load children for a directory */
    loadChildren: (path: string) => Promise<FileEntry[]>;
    /** Cache of loaded children by path */
    childrenCache: Map<string, FileEntry[]>;
    /** Search query for highlighting */
    searchQuery?: string;
    /** Current indentation level */
    level?: number;
    /** Currently focused path (for keyboard navigation) */
    focusedPath?: string | null;
    /** Callback when focus changes */
    onFocusChange?: (path: string | null) => void;
    /** Whether this is the root level (handles keyboard events) */
    isRoot?: boolean;
}

/**
 * Code file extensions
 */
const CODE_EXTENSIONS = new Set([
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "scala",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "php",
    "swift",
    "m",
    "sh",
    "bash",
    "zsh",
    "fish",
    "ps1",
    "sql",
    "graphql",
    "vue",
    "svelte",
]);

/**
 * Config/data file extensions
 */
const CONFIG_EXTENSIONS = new Set([
    "json",
    "yaml",
    "yml",
    "toml",
    "xml",
    "ini",
    "env",
    "config",
]);

/**
 * Text/doc file extensions
 */
const TEXT_EXTENSIONS = new Set(["md", "mdx", "txt", "rst", "tex", "log", "csv"]);

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "ico",
    "bmp",
]);

/**
 * File icon component - renders the appropriate icon based on file type
 */
function FileIcon({
    file,
    isOpen,
    className,
}: {
    file: FileEntry;
    isOpen?: boolean;
    className?: string;
}) {
    if (file.type === "directory") {
        return isOpen ? (
            <FolderOpen className={className} />
        ) : (
            <Folder className={className} />
        );
    }

    const ext = file.extension?.toLowerCase() ?? "";

    if (CODE_EXTENSIONS.has(ext)) return <FileCode className={className} />;
    if (CONFIG_EXTENSIONS.has(ext)) return <FileJson className={className} />;
    if (TEXT_EXTENSIONS.has(ext)) return <FileText className={className} />;
    if (IMAGE_EXTENSIONS.has(ext)) return <FileImage className={className} />;

    return <File className={className} />;
}

/**
 * Highlight matching text in a string
 */
function HighlightMatch({ text, query }: { text: string; query?: string }) {
    if (!query?.trim()) return <>{text}</>;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return <>{text}</>;

    return (
        <>
            {text.slice(0, index)}
            <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-800">
                {text.slice(index, index + query.length)}
            </mark>
            {text.slice(index + query.length)}
        </>
    );
}

/**
 * Single file/directory entry in the tree
 */
const FileTreeItem = memo(function FileTreeItem({
    file,
    isSelected,
    isExpanded,
    isLoading,
    isFocused,
    onSelect,
    onToggle,
    searchQuery,
    level = 0,
    children,
    itemRef,
}: {
    file: FileEntry;
    isSelected: boolean;
    isExpanded: boolean;
    isLoading: boolean;
    isFocused: boolean;
    onSelect: () => void;
    onToggle: () => void;
    searchQuery?: string;
    level?: number;
    children?: React.ReactNode;
    itemRef?: React.RefObject<HTMLButtonElement | null>;
}) {
    const iconColor = getFileIconColor(file);
    const isDirectory = file.type === "directory";

    const handleClick = useCallback(() => {
        if (isDirectory) {
            onToggle();
        } else {
            onSelect();
        }
    }, [isDirectory, onToggle, onSelect]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
            }
            if (e.key === "ArrowRight" && isDirectory && !isExpanded) {
                e.preventDefault();
                onToggle();
            }
            if (e.key === "ArrowLeft" && isDirectory && isExpanded) {
                e.preventDefault();
                onToggle();
            }
        },
        [handleClick, isDirectory, isExpanded, onToggle]
    );

    // Scroll into view when focused
    useEffect(() => {
        if (isFocused && itemRef?.current) {
            itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [isFocused, itemRef]);

    return (
        <div>
            <button
                ref={itemRef}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className={cn(
                    "group flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    "hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50",
                    "min-h-[44px] sm:min-h-0 sm:py-1", // Mobile: 44px touch target
                    isSelected && "bg-purple-100 dark:bg-purple-900/30",
                    isFocused &&
                        !isSelected &&
                        "bg-foreground/5 ring-1 ring-purple-500/30"
                )}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                role="treeitem"
                aria-expanded={isDirectory ? isExpanded : undefined}
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
            >
                {/* Chevron for directories */}
                {isDirectory && (
                    <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex-shrink-0"
                    >
                        <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                    </motion.div>
                )}

                {/* Spacer for files to align with directories */}
                {!isDirectory && <div className="w-3.5" />}

                {/* File/folder icon */}
                {isLoading ? (
                    <div className="border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                ) : (
                    <FileIcon
                        file={file}
                        isOpen={isExpanded}
                        className={cn("h-4 w-4 flex-shrink-0", iconColor)}
                    />
                )}

                {/* Filename */}
                <span className="truncate">
                    <HighlightMatch text={file.name} query={searchQuery} />
                </span>

                {/* File size for files - always visible on mobile, hover on desktop */}
                {!isDirectory && file.size !== undefined && (
                    <span className="text-muted-foreground ml-auto flex-shrink-0 text-xs opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        {formatFileSize(file.size)}
                    </span>
                )}
            </button>

            {/* Animated children container */}
            <AnimatePresence>
                {isDirectory && isExpanded && children && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        role="group"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

/**
 * Build flat list of visible files for keyboard navigation
 */
function buildVisibleList(
    files: FileEntry[],
    expandedDirs: Set<string>,
    childrenCache: Map<string, FileEntry[]>,
    level = 0
): Array<{ file: FileEntry; level: number }> {
    const result: Array<{ file: FileEntry; level: number }> = [];

    // Sort: directories first, then alphabetically
    const sorted = [...files].sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    for (const file of sorted) {
        result.push({ file, level });
        if (file.type === "directory" && expandedDirs.has(file.path)) {
            const children = childrenCache.get(file.path);
            if (children) {
                result.push(
                    ...buildVisibleList(
                        children,
                        expandedDirs,
                        childrenCache,
                        level + 1
                    )
                );
            }
        }
    }
    return result;
}

/**
 * Recursive file tree component
 */
export function FileTree({
    files,
    selectedPath,
    onSelectFile,
    expandedDirs,
    onToggleDir,
    loadChildren,
    childrenCache,
    searchQuery,
    level = 0,
    focusedPath: externalFocusedPath,
    onFocusChange,
    isRoot = true,
}: FileTreeProps) {
    const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
    // Internal focus state (used if no external control)
    const [internalFocusedPath, setInternalFocusedPath] = useState<string | null>(null);
    const focusedPath = externalFocusedPath ?? internalFocusedPath;
    const setFocusedPath = onFocusChange ?? setInternalFocusedPath;

    // Type-to-search state
    const typeSearchRef = useRef("");
    const typeSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ref for focused item
    const focusedItemRef = useRef<HTMLButtonElement | null>(null);

    // Container ref for keyboard events
    const containerRef = useRef<HTMLDivElement>(null);

    // Build flat visible list and ID→Index map (only at root level)
    const { visibleList, pathToIndex } = useMemo(() => {
        if (!isRoot) return { visibleList: [], pathToIndex: new Map<string, number>() };
        const list = buildVisibleList(files, expandedDirs, childrenCache);
        const indexMap = new Map<string, number>();
        list.forEach((item, idx) => indexMap.set(item.file.path, idx));
        return { visibleList: list, pathToIndex: indexMap };
    }, [files, expandedDirs, childrenCache, isRoot]);

    // Handle keyboard navigation at root level
    const handleContainerKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if (!isRoot || visibleList.length === 0) return;

            const currentIndex = focusedPath
                ? (pathToIndex.get(focusedPath) ?? -1)
                : -1;

            // Arrow navigation
            if (e.key === "ArrowDown") {
                e.preventDefault();
                const nextIndex = Math.min(currentIndex + 1, visibleList.length - 1);
                if (nextIndex >= 0) {
                    setFocusedPath(visibleList[nextIndex].file.path);
                }
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
                setFocusedPath(visibleList[nextIndex].file.path);
                return;
            }

            // Enter to select/toggle
            if (e.key === "Enter" && focusedPath) {
                e.preventDefault();
                const item = visibleList[currentIndex];
                if (item) {
                    if (item.file.type === "directory") {
                        onToggleDir(item.file.path);
                    } else {
                        onSelectFile(item.file);
                    }
                }
                return;
            }

            // ArrowRight to expand, ArrowLeft to collapse
            if (e.key === "ArrowRight" && focusedPath) {
                const item = visibleList[currentIndex];
                if (
                    item?.file.type === "directory" &&
                    !expandedDirs.has(item.file.path)
                ) {
                    e.preventDefault();
                    onToggleDir(item.file.path);
                }
                return;
            }

            if (e.key === "ArrowLeft" && focusedPath) {
                const item = visibleList[currentIndex];
                if (
                    item?.file.type === "directory" &&
                    expandedDirs.has(item.file.path)
                ) {
                    e.preventDefault();
                    onToggleDir(item.file.path);
                }
                return;
            }

            // Type-to-search: single printable character (not with modifiers)
            if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
                // Accumulate keystrokes
                if (typeSearchTimeoutRef.current) {
                    clearTimeout(typeSearchTimeoutRef.current);
                }
                typeSearchRef.current += e.key.toLowerCase();

                // Reset after 600ms of no typing
                typeSearchTimeoutRef.current = setTimeout(() => {
                    typeSearchRef.current = "";
                }, 600);

                // Find matching file (prefix match on name)
                const match = visibleList.find((item) =>
                    item.file.name.toLowerCase().startsWith(typeSearchRef.current)
                );
                if (match) {
                    setFocusedPath(match.file.path);
                }
            }
        },
        [
            isRoot,
            visibleList,
            pathToIndex,
            focusedPath,
            setFocusedPath,
            expandedDirs,
            onToggleDir,
            onSelectFile,
        ]
    );

    // Cleanup type-search timeout
    useEffect(() => {
        return () => {
            if (typeSearchTimeoutRef.current) {
                clearTimeout(typeSearchTimeoutRef.current);
            }
        };
    }, []);

    // Focus container on click to enable keyboard nav
    const handleContainerClick = useCallback(() => {
        containerRef.current?.focus();
    }, []);

    const handleToggle = useCallback(
        async (file: FileEntry) => {
            const path = file.path;
            const isCurrentlyExpanded = expandedDirs.has(path);

            if (isCurrentlyExpanded) {
                onToggleDir(path);
            } else {
                if (!childrenCache.has(path)) {
                    setLoadingDirs((prev) => new Set(prev).add(path));
                    try {
                        await loadChildren(path);
                    } finally {
                        setLoadingDirs((prev) => {
                            const next = new Set(prev);
                            next.delete(path);
                            return next;
                        });
                    }
                }
                onToggleDir(path);
            }
        },
        [expandedDirs, onToggleDir, childrenCache, loadChildren]
    );

    // Sort files: directories first, then alphabetically
    const sortedFiles = useMemo(() => {
        return [...files].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }, [files]);

    // Render tree items
    const renderItems = () =>
        sortedFiles.map((file) => {
            const isExpanded = expandedDirs.has(file.path);
            const isLoading = loadingDirs.has(file.path);
            const children = childrenCache.get(file.path);
            const isFocused = focusedPath === file.path;

            return (
                <FileTreeItem
                    key={file.path}
                    file={file}
                    isSelected={selectedPath === file.path}
                    isExpanded={isExpanded}
                    isLoading={isLoading}
                    isFocused={isFocused}
                    onSelect={() => {
                        setFocusedPath(file.path);
                        onSelectFile(file);
                    }}
                    onToggle={() => {
                        setFocusedPath(file.path);
                        handleToggle(file);
                    }}
                    searchQuery={searchQuery}
                    level={level}
                    itemRef={isFocused ? focusedItemRef : undefined}
                >
                    {isExpanded && children && (
                        <FileTree
                            files={children}
                            selectedPath={selectedPath}
                            onSelectFile={onSelectFile}
                            expandedDirs={expandedDirs}
                            onToggleDir={onToggleDir}
                            loadChildren={loadChildren}
                            childrenCache={childrenCache}
                            searchQuery={searchQuery}
                            level={level + 1}
                            focusedPath={focusedPath}
                            onFocusChange={setFocusedPath}
                            isRoot={false}
                        />
                    )}
                </FileTreeItem>
            );
        });

    // Root level wraps with keyboard handler
    if (isRoot) {
        return (
            <div
                ref={containerRef}
                role="tree"
                className="outline-none select-none"
                tabIndex={0}
                onKeyDown={handleContainerKeyDown}
                onClick={handleContainerClick}
            >
                {renderItems()}
            </div>
        );
    }

    // Nested levels just render items
    return <div role="group">{renderItems()}</div>;
}
