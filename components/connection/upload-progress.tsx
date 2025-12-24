"use client";

/**
 * Upload Progress Display
 *
 * Shows pending uploads above the composer with rich previews:
 * - Image thumbnails using object URLs
 * - File type icons for documents and audio
 * - File size and status
 * - Total attachment size summary
 * - Cancel button per file
 */

import { useEffect, useMemo } from "react";
import { X, FileText, Music, File, AlertCircle, CheckCircle2 } from "lucide-react";
import { useFileAttachments } from "./file-attachment-context";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileCategory } from "@/lib/storage/file-config";
import type { UploadProgress as UploadProgressType } from "@/lib/storage/types";

export function UploadProgressDisplay({
    onInsertInline,
}: {
    onInsertInline?: (fileId: string) => void;
}) {
    const { pendingFiles, removeFile, getTextContent } = useFileAttachments();

    // Calculate total size across all pending files
    const totalSize = useMemo(
        () => pendingFiles.reduce((sum, upload) => sum + upload.file.size, 0),
        [pendingFiles]
    );

    if (pendingFiles.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 rounded-xl bg-background/40 p-3 backdrop-blur-sm">
            {pendingFiles.map((upload) => (
                <UploadItem
                    key={upload.id}
                    upload={upload}
                    onRemove={removeFile}
                    onInsertInline={onInsertInline}
                    hasTextContent={!!getTextContent(upload.id)}
                />
            ))}
            {/* Total size summary for multiple files */}
            {pendingFiles.length > 1 && (
                <div className="border-t border-foreground/10 pt-1 text-right text-xs text-foreground/50">
                    {pendingFiles.length} files · {formatFileSize(totalSize)} total
                </div>
            )}
        </div>
    );
}

/**
 * File Preview Thumbnail
 *
 * Shows image thumbnail for images, file type icon for others.
 * Manages object URL lifecycle to prevent memory leaks.
 */
function FilePreviewThumbnail({ file }: { file: File }) {
    const category = getFileCategory(file.type);
    const isImage = category === "image";

    // Create object URL for image preview - memoized to avoid recreating on every render
    const objectUrl = useMemo(
        () => (isImage ? URL.createObjectURL(file) : null),
        [file, isImage]
    );

    // Cleanup object URL when component unmounts or file changes
    useEffect(() => {
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [objectUrl]);

    // Image thumbnail
    if (isImage && objectUrl) {
        return (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-foreground/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={objectUrl}
                    alt={file.name}
                    className="h-full w-full object-cover"
                />
            </div>
        );
    }

    // File type icon for non-images
    const Icon =
        category === "document" ? FileText : category === "audio" ? Music : File;

    return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-foreground/5">
            <Icon className="h-5 w-5 text-foreground/60" />
        </div>
    );
}

function UploadItem({
    upload,
    onRemove,
    onInsertInline,
    hasTextContent,
}: {
    upload: UploadProgressType;
    onRemove: (id: string) => void;
    onInsertInline?: (fileId: string) => void;
    hasTextContent: boolean;
}) {
    const { id, file, status, error, placeholder } = upload;
    const isTextFile = file.type === "text/plain";
    const isComplete = status === "complete";
    const isError = status === "error";
    const isProcessing =
        status === "validating" || status === "optimizing" || status === "uploading";

    // Honest status messages - no fake progress bars
    const getStatusMessage = () => {
        switch (status) {
            case "validating":
                return "Checking file...";
            case "optimizing":
                return "Optimizing...";
            case "uploading":
                return "Uploading...";
            case "complete":
                return placeholder || "Ready";
            case "error":
                return error || "Upload failed";
        }
    };

    return (
        <div className="flex items-center gap-3 rounded-lg bg-background/60 p-2">
            {/* File preview: thumbnail for images, icon for others */}
            <div className="relative shrink-0">
                {isComplete && (
                    <div className="absolute -right-1 -top-1 z-10">
                        <CheckCircle2 className="h-4 w-4 rounded-full bg-background text-green-500" />
                    </div>
                )}
                {isError && (
                    <div className="absolute -right-1 -top-1 z-10">
                        <AlertCircle className="h-4 w-4 rounded-full bg-background text-destructive" />
                    </div>
                )}
                <FilePreviewThumbnail file={file} />
            </div>

            {/* Filename, size, and status */}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-foreground/90">
                        {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-foreground/40">
                        {formatFileSize(file.size)}
                    </span>
                </div>
                <div
                    className={cn(
                        "text-xs",
                        isError && "text-destructive",
                        isComplete && placeholder && "font-mono text-foreground/70",
                        isComplete &&
                            !placeholder &&
                            "text-green-600 dark:text-green-400",
                        isProcessing && "text-foreground/60"
                    )}
                >
                    {getStatusMessage()}
                </div>
                {/* Insert inline for pasted text files */}
                {isTextFile && hasTextContent && onInsertInline && (
                    <button
                        type="button"
                        onClick={() => onInsertInline(id)}
                        className="mt-1 text-xs text-muted-foreground underline hover:text-foreground"
                    >
                        Insert inline
                    </button>
                )}
            </div>

            {/* Remove button */}
            <button
                type="button"
                onClick={() => onRemove(id)}
                className="shrink-0 rounded-full p-1 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground/80"
                aria-label="Remove file"
                data-tooltip-id="tip"
                data-tooltip-content="Remove"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
