"use client";

/**
 * File Preview Component
 *
 * Renders file attachments in message bubbles:
 * - Images: Optimized thumbnail with lightbox on click
 * - PDFs: Icon + filename
 * - Audio/Video/Other: Icon + filename
 */

import { useState } from "react";
import Image from "next/image";
import { FileIcon, FileText, Music, File, ImageOff } from "lucide-react";
import { ALLOWED_MIME_TYPES } from "@/lib/storage/file-config";
import { getThumbnailUrl } from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

interface FilePreviewProps {
    url: string;
    mediaType: string;
    filename: string;
    isUserMessage?: boolean;
}

export function FilePreview({
    url,
    mediaType,
    filename,
    isUserMessage,
}: FilePreviewProps) {
    const isImage = (ALLOWED_MIME_TYPES.image as readonly string[]).includes(mediaType);
    const isPDF = mediaType === "application/pdf";
    const isAudio = (ALLOWED_MIME_TYPES.audio as readonly string[]).includes(mediaType);

    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    if (isImage) {
        // Show error state if image failed to load
        if (hasError) {
            return (
                <div className="border-foreground/10 bg-background/80 text-foreground/50 flex items-center gap-2 rounded-lg border px-3 py-2">
                    <ImageOff className="h-5 w-5 shrink-0" />
                    <span className="text-sm">Image unavailable</span>
                </div>
            );
        }

        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-lg"
            >
                <Image
                    src={getThumbnailUrl(url, mediaType)}
                    alt={filename}
                    width={400}
                    height={256}
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                    }}
                    className={cn(
                        "max-h-64 w-auto object-cover transition-opacity group-hover:opacity-90",
                        isLoading && "bg-foreground/10 animate-pulse"
                    )}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/10 group-hover:opacity-100">
                    <span className="text-xs text-white">Click to view full size</span>
                </div>
            </a>
        );
    }

    // Non-image files: Show icon + filename
    let Icon = File;
    if (isPDF) Icon = FileText;
    else if (isAudio) Icon = Music;
    else Icon = FileIcon;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "hover:bg-foreground/5 flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                isUserMessage
                    ? "border-white/20 bg-white/10"
                    : "border-foreground/10 bg-background/80"
            )}
        >
            <Icon className="text-foreground/60 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{filename}</div>
                <div className="text-foreground/50 text-xs">
                    {mediaType.split("/")[1]}
                </div>
            </div>
        </a>
    );
}
