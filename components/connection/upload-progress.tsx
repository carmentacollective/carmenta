"use client";

/**
 * Upload Progress Display
 *
 * Shows pending uploads above the composer with rich previews:
 * - Image thumbnails using object URLs
 * - File type icons for documents and audio
 * - Status during upload, silence on completion (checkmark is enough)
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
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getFileCategory } from "@/lib/storage/file-config";
import type { UploadProgress as UploadProgressType } from "@/lib/storage/types";

export function UploadProgressDisplay({
    onInsertInline,
}: {
    onInsertInline?: (fileId: string) => void;
}) {
    const { pendingFiles, removeFile, getTextContent, addFiles } = useFileAttachments();

    // Retry handler - removes failed upload and re-adds the file
    const handleRetry = (upload: UploadProgressType) => {
        removeFile(upload.id);
        addFiles([upload.file]);
    };

    if (pendingFiles.length === 0) return null;

    return (
        <div className="bg-background/40 flex flex-col gap-2 rounded-xl p-3 backdrop-blur-sm">
            {pendingFiles.map((upload) => (
                <UploadItem
                    key={upload.id}
                    upload={upload}
                    onRemove={removeFile}
                    onRetry={() => handleRetry(upload)}
                    onInsertInline={onInsertInline}
                    hasTextContent={!!getTextContent(upload.id)}
                />
            ))}
            {/* Simple count for multiple files */}
            {pendingFiles.length > 1 && (
                <div className="text-foreground/50 text-right text-xs">
                    {pendingFiles.length} files attached
                </div>
            )}
        </div>
    );
}

/**
 * File Preview Thumbnail
 *
 * Shows image thumbnail for images, file type icon for others.
 * For pre-uploaded files (from share target), uses the result URL directly.
 * For pending uploads, creates object URL from file data.
 * Manages object URL lifecycle to prevent memory leaks and StrictMode issues.
 */
function FilePreviewThumbnail({ upload }: { upload: UploadProgressType }) {
    const { file, result } = upload;
    const category = getFileCategory(file.type);
    const isImage = category === "image";
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    // Create and cleanup object URL within same effect for StrictMode compatibility
    // StrictMode simulates unmount/remount - keeping creation and cleanup together
    // ensures a fresh URL is created after cleanup on remount
    useEffect(() => {
        if (!isImage) return;
        // For pre-uploaded files (share target), we already have the URL
        if (result?.url) return;

        const url = URL.createObjectURL(file);
        setObjectUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file, isImage, result]);

    // Image thumbnail - use result URL for pre-uploaded files, object URL otherwise
    if (isImage) {
        const thumbnailUrl = result?.url || objectUrl;
        if (thumbnailUrl) {
            return (
                <div className="bg-foreground/5 relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={thumbnailUrl}
                        alt={file.name}
                        className="h-full w-full object-cover"
                    />
                </div>
            );
        }
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
    onRetry,
    onInsertInline,
    hasTextContent,
}: {
    upload: UploadProgressType;
    onRemove: (id: string) => void;
    onRetry: () => void;
    onInsertInline?: (fileId: string) => void;
    hasTextContent: boolean;
}) {
    const { id, file, status, error, placeholder } = upload;
    const isTextFile = file.type === "text/plain";
    const isComplete = status === "complete";
    const isError = status === "error";
    const isProcessing =
        status === "validating" || status === "optimizing" || status === "uploading";

    // Status messages only during transitions - silence on completion (checkmark is enough)
    const getStatusMessage = () => {
        switch (status) {
            case "validating":
                return "Checking...";
            case "optimizing":
                return "Optimizing...";
            case "uploading":
                return "Uploading...";
            case "complete":
                // Placeholder for text files, otherwise nothing - checkmark badge is sufficient
                return placeholder || null;
            case "error":
                return error || "That didn't work";
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
                <FilePreviewThumbnail upload={upload} />
            </div>

            {/* Filename and status */}
            <div className="min-w-0 flex-1">
                <div className="text-foreground/90 truncate text-sm font-medium">
                    {file.name}
                </div>
                {/* Only show status row when there's actually something to say */}
                {(() => {
                    const statusMessage = getStatusMessage();
                    return statusMessage ? (
                        <div
                            className={cn(
                                "text-xs",
                                isError && "text-destructive",
                                isComplete &&
                                    placeholder &&
                                    "text-foreground/70 font-mono",
                                isProcessing && "text-foreground/60"
                            )}
                        >
                            {statusMessage}
                            {/* Retry button for failed uploads */}
                            {isError && (
                                <button
                                    type="button"
                                    onClick={onRetry}
                                    className="text-primary hover:text-primary/80 ml-2 inline-flex items-center gap-1 font-medium"
                                >
                                    <ArrowCounterClockwise className="h-3 w-3" />
                                    Retry
                                </button>
                            )}
                        </div>
                    ) : null;
                })()}
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

            {/* Remove button - 44px minimum touch target for mobile */}
            <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-foreground/40 hover:bg-foreground/10 hover:text-foreground/80 active:bg-foreground/15 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-2 transition-colors active:scale-95 @md:min-h-0 @md:min-w-0 @md:p-1"
                aria-label="Remove file"
                data-tooltip-id="tip"
                data-tooltip-content="Remove"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
