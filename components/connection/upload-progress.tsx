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

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import {
    X,
    FileText,
    MusicNote,
    File,
    WarningCircle,
    CheckCircle,
} from "@phosphor-icons/react";
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
    const totalSize = pendingFiles.reduce((sum, upload) => sum + upload.file.size, 0);

    if (pendingFiles.length === 0) return null;

    return (
        <div className="bg-background/40 flex flex-col gap-2 rounded-xl p-3 backdrop-blur-sm">
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
                <div className="border-foreground/10 text-foreground/50 border-t pt-1 text-right text-xs">
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
 * Manages object URL lifecycle to prevent memory leaks and StrictMode issues.
 */
function FilePreviewThumbnail({ file }: { file: File }) {
    const category = getFileCategory(file.type);
    const isImage = category === "image";
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    // Create and cleanup object URL within same effect for StrictMode compatibility
    // StrictMode simulates unmount/remount - keeping creation and cleanup together
    // ensures a fresh URL is created after cleanup on remount
    useEffect(() => {
        if (!isImage) return;

        const url = URL.createObjectURL(file);
        setObjectUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file, isImage]);

    // Image thumbnail
    if (isImage && objectUrl) {
        return (
            <div className="bg-foreground/5 relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
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
        category === "document" ? FileText : category === "audio" ? MusicNote : File;

    return (
        <div className="bg-foreground/5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <Icon className="text-foreground/60 h-5 w-5" />
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
        <div className="bg-background/60 flex items-center gap-3 rounded-lg p-2">
            {/* File preview: thumbnail for images, icon for others */}
            <div className="relative shrink-0">
                {isComplete && (
                    <div className="absolute -top-1 -right-1 z-10">
                        <CheckCircle className="bg-background h-4 w-4 rounded-full text-green-500" />
                    </div>
                )}
                {isError && (
                    <div className="absolute -top-1 -right-1 z-10">
                        <WarningCircle className="bg-background text-destructive h-4 w-4 rounded-full" />
                    </div>
                )}
                <FilePreviewThumbnail file={file} />
            </div>

            {/* Filename, size, and status */}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-foreground/90 truncate text-sm font-medium">
                        {file.name}
                    </span>
                    <span className="text-foreground/40 shrink-0 text-xs">
                        {formatFileSize(file.size)}
                    </span>
                </div>
                <div
                    className={cn(
                        "text-xs",
                        isError && "text-destructive",
                        isComplete && placeholder && "text-foreground/70 font-mono",
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
                        className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
                    >
                        Insert inline
                    </button>
                )}
            </div>

            {/* Remove button */}
            <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-foreground/40 hover:bg-foreground/10 hover:text-foreground/80 shrink-0 rounded-full p-1 transition-colors"
                aria-label="Remove file"
                data-tooltip-id="tip"
                data-tooltip-content="Remove"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
