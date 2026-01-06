/**
 * File Explorer Utilities
 *
 * Helper functions for file icons, size formatting, and tree operations.
 */

import {
    FileIcon,
    FileCodeIcon,
    FileJsIcon,
    FileTextIcon,
    ImageIcon as FileImageIcon,
    FolderIcon,
    FolderOpenIcon,
    type Icon,
} from "@phosphor-icons/react";

/**
 * File entry from the API
 */
export interface FileEntry {
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
    modifiedAt?: string;
    extension?: string;
}

/**
 * Hierarchical file tree node (for recursive rendering)
 */
export interface FileTreeNode extends FileEntry {
    children?: FileTreeNode[];
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
 * Get the appropriate icon for a file or directory
 */
export function getFileIcon(entry: FileEntry, isOpen?: boolean): Icon {
    if (entry.type === "directory") {
        return isOpen ? FolderOpenIcon : FolderIcon;
    }

    const ext = entry.extension?.toLowerCase() ?? "";

    if (CODE_EXTENSIONS.has(ext)) return FileCodeIcon;
    if (CONFIG_EXTENSIONS.has(ext)) return FileJsIcon;
    if (TEXT_EXTENSIONS.has(ext)) return FileTextIcon;
    if (IMAGE_EXTENSIONS.has(ext)) return FileImageIcon;

    return FileIcon;
}

/**
 * Get a color class for the file icon based on type
 */
export function getFileIconColor(entry: FileEntry): string {
    if (entry.type === "directory") {
        return "text-amber-500 dark:text-amber-400";
    }

    const ext = entry.extension?.toLowerCase() ?? "";

    if (CODE_EXTENSIONS.has(ext)) return "text-blue-500 dark:text-blue-400";
    if (CONFIG_EXTENSIONS.has(ext)) return "text-yellow-500 dark:text-yellow-400";
    if (TEXT_EXTENSIONS.has(ext)) return "text-gray-500 dark:text-gray-400";
    if (IMAGE_EXTENSIONS.has(ext)) return "text-pink-500 dark:text-pink-400";

    return "text-gray-400 dark:text-gray-500";
}

/**
 * Format file size in human-readable format
 * Rounds to whole numbers - "107 KB" not "107.34 KB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

    return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

/**
 * Format relative time from ISO date string
 */
export function formatRelativeTime(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

/**
 * Convert flat file list to hierarchical tree structure
 */
export function buildFileTree(files: FileEntry[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    // Sort files by path to ensure parents come before children
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    for (const file of sortedFiles) {
        const node: FileTreeNode = { ...file };

        // Get parent path
        const pathParts = file.path.split("/").filter(Boolean);
        pathParts.pop(); // Remove filename
        const parentPath = "/" + pathParts.join("/");

        if (parentPath === "/" || parentPath === "") {
            // Root level
            root.push(node);
        } else {
            // Find parent and add as child
            const parent = nodeMap.get(parentPath);
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(node);
            } else {
                // Parent not found, add to root
                root.push(node);
            }
        }

        nodeMap.set(file.path, node);
    }

    return root;
}

/**
 * Filter files by search query, preserving directory structure
 */
export function filterFiles(files: FileEntry[], query: string): FileEntry[] {
    if (!query.trim()) return files;

    const lowerQuery = query.toLowerCase();

    return files.filter((file) => {
        // Match filename
        if (file.name.toLowerCase().includes(lowerQuery)) return true;

        // Match full path
        if (file.path.toLowerCase().includes(lowerQuery)) return true;

        return false;
    });
}

/**
 * Find all parent paths that should be expanded for search results
 */
export function getExpandedPathsForSearch(
    files: FileEntry[],
    query: string
): Set<string> {
    const expanded = new Set<string>();

    if (!query.trim()) return expanded;

    const lowerQuery = query.toLowerCase();

    for (const file of files) {
        if (
            file.name.toLowerCase().includes(lowerQuery) ||
            file.path.toLowerCase().includes(lowerQuery)
        ) {
            // Add all parent paths
            const parts = file.path.split("/").filter(Boolean);
            let currentPath = "";
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += "/" + parts[i];
                expanded.add(currentPath);
            }
        }
    }

    return expanded;
}

/**
 * Get language identifier for syntax highlighting
 */
export function getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
        ts: "typescript",
        tsx: "tsx",
        js: "javascript",
        jsx: "jsx",
        mjs: "javascript",
        cjs: "javascript",
        py: "python",
        rb: "ruby",
        go: "go",
        rs: "rust",
        java: "java",
        kt: "kotlin",
        scala: "scala",
        c: "c",
        cpp: "cpp",
        h: "c",
        hpp: "cpp",
        cs: "csharp",
        php: "php",
        swift: "swift",
        sh: "bash",
        bash: "bash",
        zsh: "bash",
        sql: "sql",
        graphql: "graphql",
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
        vue: "vue",
        svelte: "svelte",
    };

    return languageMap[extension.toLowerCase()] ?? "plaintext";
}
