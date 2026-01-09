"use client";

/**
 * CreateImage Tool UI - AI Image Generation Display
 *
 * Renders AI-generated images with hover actions for download, fullscreen,
 * and copy. Includes a lightbox modal for expanded viewing.
 *
 * Design follows gif-card patterns for consistency.
 */

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
    ArrowsOutIcon,
    CheckIcon,
    CopyIcon,
    DownloadIcon,
    XIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";

/** Allowed MIME types for generated images */
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

interface CreateImageToolResultProps {
    /** toolCallId is passed but not used - images render prominently without ToolRenderer */
    toolCallId?: string;
    status: ToolStatus;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Visual CreateImage tool result with premium loading experience.
 * Shows polished progress UI while generating, then the final image prominently.
 *
 * Unlike other tools, images are NOT wrapped in a collapsible ToolRenderer.
 * The generated image IS the content - it deserves to be front and center.
 */
export function CreateImageToolResult({
    status,
    input,
    output,
    error,
}: CreateImageToolResultProps) {
    // Show pendulum loader while generating
    if (status === "running") {
        return <ImageGenerationLoader className="max-w-lg" />;
    }

    // Handle errors gracefully
    if (error) {
        return (
            <div className="bg-destructive/10 text-destructive max-w-lg rounded-lg p-4 text-sm">
                <p className="font-medium">Image generation failed</p>
                <p className="text-destructive/80 mt-1">{error}</p>
            </div>
        );
    }

    // Show the image prominently (no collapsible wrapper)
    if (status === "completed" && hasValidImage(output)) {
        return <ImageCard input={input} output={output} />;
    }

    // Fallback for unexpected states
    return null;
}

/**
 * Validate the output has proper image data to display.
 * Checks for base64 presence and valid MIME type.
 */
function hasValidImage(output?: Record<string, unknown>): boolean {
    if (!output) return false;

    const image = output.image as { base64?: string; mimeType?: string } | undefined;
    if (!image?.base64 || image.base64.length < 100) return false;

    // Validate MIME type to prevent XSS via data URIs
    const mimeType = image.mimeType ?? "image/png";
    if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
        logger.error({ mimeType }, "Invalid image MIME type from generation");
        return false;
    }

    return true;
}

/** Aspect ratio multipliers for height calculation */
const ASPECT_RATIOS: Record<string, number> = {
    "16:9": 9 / 16,
    "9:16": 16 / 9,
    "4:3": 3 / 4,
    "3:4": 4 / 3,
    "1:1": 1,
};

/**
 * Calculate height based on aspect ratio
 */
function getHeightFromAspectRatio(aspectRatio: string, width = 512): number {
    return Math.round(width * (ASPECT_RATIOS[aspectRatio] ?? 1));
}

/**
 * Interactive image card with hover actions and lightbox.
 */
function ImageCard({
    input,
    output,
}: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
}) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    // Defensive extraction with validation (hasValidImage already checked, but be safe)
    const imageData = output?.image as
        | { base64?: string; mimeType?: string }
        | undefined;
    if (!imageData?.base64) {
        logger.error(
            { hasOutput: !!output },
            "ImageCard rendered without valid image data"
        );
        return null;
    }

    const prompt = (input?.prompt as string) || (output?.prompt as string);
    const aspectRatio =
        (input?.aspectRatio as string) || (output?.aspectRatio as string) || "1:1";
    const model = output?.model as string | undefined;
    const tier = output?.tier as string | undefined;

    // Use validated MIME type with safe fallback
    const mimeType = ALLOWED_MIME_TYPES.includes(
        imageData.mimeType as (typeof ALLOWED_MIME_TYPES)[number]
    )
        ? imageData.mimeType
        : "image/png";

    const src = `data:${mimeType};base64,${imageData.base64}`;

    // Truncate prompt for display
    const displayPrompt = prompt
        ? prompt.length > 100
            ? prompt.slice(0, 97) + "..."
            : prompt
        : "AI-generated image";

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Create download link
            const link = document.createElement("a");
            link.href = src;
            link.download = `carmenta-${Date.now()}.${mimeType?.split("/")[1] ?? "png"}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            logger.error({ error }, "Failed to download image");
            Sentry.captureException(error, {
                level: "info",
                tags: { component: "create-image", action: "download" },
            });
        }
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }

            // Copy image data to clipboard
            const response = await fetch(src);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

            setCopied(true);
            copyTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                    setCopied(false);
                }
            }, 2000);
        } catch (error) {
            logger.error({ error }, "Failed to copy image");
            Sentry.captureException(error, {
                level: "info",
                tags: { component: "create-image", action: "copy" },
            });
        }
    };

    return (
        <>
            {/* Main card with hover actions */}
            <div className="group relative max-w-lg overflow-hidden rounded-lg">
                {/* Loading skeleton */}
                {!imageLoaded && (
                    <div
                        className="bg-muted/50 absolute inset-0 animate-pulse rounded-lg"
                        style={{ aspectRatio: aspectRatio.replace(":", "/") }}
                    />
                )}

                {/* Image */}
                <Image
                    src={src}
                    alt={displayPrompt}
                    width={512}
                    height={getHeightFromAspectRatio(aspectRatio)}
                    className={cn(
                        "w-full cursor-pointer object-contain transition-opacity",
                        !imageLoaded && "opacity-0"
                    )}
                    unoptimized
                    onLoad={() => setImageLoaded(true)}
                    onClick={() => setLightboxOpen(true)}
                />

                {/* Hover overlay with actions */}
                <div
                    className={cn(
                        "absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent",
                        "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                    )}
                >
                    {/* Top actions */}
                    <div className="flex justify-end gap-1.5 p-2">
                        <button
                            onClick={handleCopy}
                            className="rounded-md bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                            title="Copy image"
                        >
                            {copied ? (
                                <CheckIcon className="h-4 w-4" />
                            ) : (
                                <CopyIcon className="h-4 w-4" />
                            )}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="rounded-md bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                            title="Download image"
                        >
                            <DownloadIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setLightboxOpen(true)}
                            className="rounded-md bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                            title="View fullscreen"
                        >
                            <ArrowsOutIcon className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Bottom info */}
                    <div className="p-3">
                        <p className="mb-1 line-clamp-2 text-sm text-white/90">
                            {displayPrompt}
                        </p>
                        {(model || tier) && (
                            <p className="text-xs text-white/50">
                                {tier && <span className="capitalize">{tier}</span>}
                                {tier && model && " · "}
                                {model && <span>{model.split("/").pop()}</span>}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            <DialogPrimitive.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="z-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/90 backdrop-blur-md" />
                    <DialogPrimitive.Content className="z-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-4 flex items-center justify-center">
                        {/* Close button */}
                        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white">
                            <XIcon className="h-6 w-6" />
                            <span className="sr-only">Close</span>
                        </DialogPrimitive.Close>

                        {/* Action buttons */}
                        <div className="absolute top-4 left-4 flex gap-2">
                            <button
                                onClick={handleCopy}
                                className="rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                                title="Copy image"
                            >
                                {copied ? (
                                    <CheckIcon className="h-5 w-5" />
                                ) : (
                                    <CopyIcon className="h-5 w-5" />
                                )}
                            </button>
                            <button
                                onClick={handleDownload}
                                className="rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                                title="Download image"
                            >
                                <DownloadIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Image container */}
                        <div className="relative max-h-full max-w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={src}
                                alt={displayPrompt}
                                className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-4rem)] object-contain"
                            />
                        </div>

                        {/* Bottom caption */}
                        <div className="absolute right-4 bottom-4 left-4 rounded-lg bg-black/50 p-3 backdrop-blur-sm">
                            <p className="text-sm text-white/90">{prompt}</p>
                            {(model || tier) && (
                                <p className="mt-1 text-xs text-white/50">
                                    {tier && <span className="capitalize">{tier}</span>}
                                    {tier && model && " · "}
                                    {model && <span>{model}</span>}
                                    {aspectRatio && ` · ${aspectRatio}`}
                                </p>
                            )}
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </>
    );
}
