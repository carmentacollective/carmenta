"use client";

/**
 * Upload Progress Display
 *
 * Shows pending uploads above the composer:
 * - Filename with progress bar
 * - Cancel button
 * - Error state with retry
 */

import { X, FileIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { useFileAttachments } from "./file-attachment-context";
import { cn } from "@/lib/utils";
import type { UploadProgress as UploadProgressType } from "@/lib/storage/types";

export function UploadProgressDisplay({
    onInsertInline,
}: {
    onInsertInline?: (fileId: string) => void;
}) {
    const { pendingFiles, removeFile, getTextContent } = useFileAttachments();

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
    const { id, file, status, error } = upload;
    const isTextFile = file.type === "text/plain";

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
                return "Complete";
            case "error":
                return error || "Upload failed";
        }
    };

    return (
        <div className="flex items-center gap-3 rounded-lg bg-background/60 p-2">
            {/* File icon */}
            <div className="shrink-0">
                {status === "complete" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                    <FileIcon className="h-5 w-5 text-foreground/60" />
                )}
            </div>

            {/* Filename and status */}
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground/90">
                    {file.name}
                </div>
                <div
                    className={cn(
                        "text-xs",
                        status === "error" && "text-destructive",
                        status === "complete" && "text-green-600 dark:text-green-400",
                        (status === "validating" ||
                            status === "optimizing" ||
                            status === "uploading") &&
                            "text-foreground/60"
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
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
