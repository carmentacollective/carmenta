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

export function UploadProgressDisplay() {
    const { pendingFiles, removeFile } = useFileAttachments();

    if (pendingFiles.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 rounded-xl bg-background/40 p-3 backdrop-blur-sm">
            {pendingFiles.map((upload) => (
                <UploadItem key={upload.id} upload={upload} onRemove={removeFile} />
            ))}
        </div>
    );
}

function UploadItem({
    upload,
    onRemove,
}: {
    upload: UploadProgressType;
    onRemove: (id: string) => void;
}) {
    const { id, file, progress, status, error } = upload;

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

            {/* Filename and progress */}
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground/90">
                    {file.name}
                </div>
                {status === "error" ? (
                    <div className="text-xs text-destructive">{error}</div>
                ) : status === "complete" ? (
                    <div className="text-xs text-green-600 dark:text-green-400">
                        Complete
                    </div>
                ) : (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                        <div
                            className={cn(
                                "h-full bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 transition-all duration-300",
                                status === "pending" && "w-0"
                            )}
                            style={{
                                width: status === "uploading" ? `${progress}%` : "0%",
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Remove button */}
            <button
                type="button"
                onClick={() => onRemove(id)}
                className="shrink-0 rounded-full p-1 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground/80"
                aria-label="Remove file"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
