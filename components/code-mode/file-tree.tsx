"use client";

/**
 * File Tree Component
 *
 * Recursive tree view for displaying directory structure.
 * Supports expand/collapse, file selection, and keyboard navigation.
 */

import { useCallback, useState, useMemo, memo, type KeyboardEvent } from "react";
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
    onSelect,
    onToggle,
    searchQuery,
    level = 0,
    children,
}: {
    file: FileEntry;
    isSelected: boolean;
    isExpanded: boolean;
    isLoading: boolean;
    onSelect: () => void;
    onToggle: () => void;
    searchQuery?: string;
    level?: number;
    children?: React.ReactNode;
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

    return (
        <div>
            <button
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className={cn(
                    "group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
                    "hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50",
                    isSelected && "bg-purple-100 dark:bg-purple-900/30"
                )}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                role="treeitem"
                aria-expanded={isDirectory ? isExpanded : undefined}
                aria-selected={isSelected}
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

                {/* File size for files */}
                {!isDirectory && file.size !== undefined && (
                    <span className="text-muted-foreground ml-auto flex-shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100">
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
}: FileTreeProps) {
    const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());

    const handleToggle = useCallback(
        async (file: FileEntry) => {
            const path = file.path;
            const isCurrentlyExpanded = expandedDirs.has(path);

            if (isCurrentlyExpanded) {
                // Collapse
                onToggleDir(path);
            } else {
                // Expand - load children if not cached
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

    return (
        <div role="tree" className="select-none">
            {sortedFiles.map((file) => {
                const isExpanded = expandedDirs.has(file.path);
                const isLoading = loadingDirs.has(file.path);
                const children = childrenCache.get(file.path);

                return (
                    <FileTreeItem
                        key={file.path}
                        file={file}
                        isSelected={selectedPath === file.path}
                        isExpanded={isExpanded}
                        isLoading={isLoading}
                        onSelect={() => onSelectFile(file)}
                        onToggle={() => handleToggle(file)}
                        searchQuery={searchQuery}
                        level={level}
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
                            />
                        )}
                    </FileTreeItem>
                );
            })}
        </div>
    );
}
