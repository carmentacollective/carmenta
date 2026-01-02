"use client";

/**
 * File Preview Component
 *
 * Modal/panel for viewing file contents with syntax highlighting.
 * Uses Shiki for code highlighting when available.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Copy,
    Check,
    FileWarning,
    Loader2,
    File,
    FileCode,
    FileJson,
    FileText,
    FileImage,
    Folder,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    type FileEntry,
    getFileIconColor,
    formatFileSize,
    getLanguageFromExtension,
} from "@/lib/code-mode/file-utils";
import { logger } from "@/lib/client-logger";

/**
 * Extension sets for file type detection
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

const TEXT_EXTENSIONS = new Set(["md", "mdx", "txt", "rst", "tex", "log", "csv"]);

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
 * File icon component for the preview header
 */
function PreviewFileIcon({ file, className }: { file: FileEntry; className?: string }) {
    if (file.type === "directory") {
        return <Folder className={className} />;
    }

    const ext = file.extension?.toLowerCase() ?? "";

    if (CODE_EXTENSIONS.has(ext)) return <FileCode className={className} />;
    if (CONFIG_EXTENSIONS.has(ext)) return <FileJson className={className} />;
    if (TEXT_EXTENSIONS.has(ext)) return <FileText className={className} />;
    if (IMAGE_EXTENSIONS.has(ext)) return <FileImage className={className} />;

    return <File className={className} />;
}

interface FilePreviewProps {
    /** The file to preview */
    file: FileEntry | null;
    /** Repo slug for API calls */
    repo: string;
    /** Callback to close the preview */
    onClose: () => void;
}

interface FileContentResponse {
    content: string | null;
    isBinary: boolean;
    extension: string;
    size: number;
    lineCount: number;
    truncated: boolean;
    message: string | null;
}

export function FilePreview({ file, repo, onClose }: FilePreviewProps) {
    const [content, setContent] = useState<FileContentResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Fetch file content when file changes
    useEffect(() => {
        if (!file || file.type === "directory") {
            setContent(null);
            return;
        }

        const abortController = new AbortController();

        const fetchContent = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `/api/code/${repo}/files/content?path=${encodeURIComponent(file.path)}`,
                    { signal: abortController.signal }
                );

                if (!response.ok) {
                    throw new Error(`Failed to load file: ${response.statusText}`);
                }

                const data = await response.json();
                setContent(data);
            } catch (err) {
                // Ignore aborted requests (user clicked a different file)
                if (err instanceof Error && err.name === "AbortError") {
                    return;
                }
                const message =
                    err instanceof Error ? err.message : "Failed to load file";
                setError(message);
                logger.error(
                    { error: err, file: file.path },
                    "Failed to load file content"
                );
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchContent();

        return () => abortController.abort();
    }, [file, repo]);

    // Copy content to clipboard
    const handleCopy = useCallback(async () => {
        if (!content?.content) return;

        try {
            await navigator.clipboard.writeText(content.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.error({ error: err }, "Failed to copy to clipboard");
        }
    }, [content]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (!file) return null;

    const iconColor = getFileIconColor(file);
    const language = file.extension
        ? getLanguageFromExtension(file.extension)
        : "plaintext";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="z-modal fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-border bg-background relative mx-4 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="border-border flex items-center justify-between border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <PreviewFileIcon
                                file={file}
                                className={cn("h-5 w-5", iconColor)}
                            />
                            <span className="font-medium">{file.name}</span>
                            {file.size !== undefined && (
                                <span className="text-muted-foreground text-sm">
                                    ({formatFileSize(file.size)})
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {content?.content && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-8 gap-1.5"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span>Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4" />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-8 w-8"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto">
                        {isLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                            </div>
                        )}

                        {error && (
                            <div className="text-destructive flex flex-col items-center justify-center gap-2 py-12">
                                <FileWarning className="h-8 w-8" />
                                <p>{error}</p>
                            </div>
                        )}

                        {content && !isLoading && !error && (
                            <>
                                {content.isBinary || !content.content ? (
                                    <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12">
                                        <FileWarning className="h-8 w-8" />
                                        <p>
                                            {content.message ||
                                                "Cannot preview this file"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {content.truncated && (
                                            <div className="border-border sticky top-0 z-10 border-b bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                                {content.message}
                                            </div>
                                        )}
                                        <pre className="overflow-x-auto p-4 text-sm">
                                            <code
                                                className={`language-${language}`}
                                                style={{
                                                    fontFamily:
                                                        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                                                }}
                                            >
                                                {content.content}
                                            </code>
                                        </pre>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {content && !isLoading && !error && content.content && (
                        <div className="border-border text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-sm">
                            <span>{content.lineCount.toLocaleString()} lines</span>
                            <span>{language}</span>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
