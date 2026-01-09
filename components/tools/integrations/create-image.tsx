"use client";

/**
 * CreateImage Tool UI - AI Image Generation Display
 *
 * Renders AI-generated images with hover actions for download, fullscreen,
 * and copy. Includes a lightbox modal for expanded viewing.
 *
 * Design follows gif-card patterns for consistency.
 */

import { useState } from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowsOutIcon, XIcon } from "@phosphor-icons/react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";
import { CopyImageButton } from "@/components/ui/copy-image-button";
import { DownloadImageButton } from "@/components/ui/download-image-button";

/** Allowed MIME types for generated images */
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Human-friendly labels for task types from Image Artist agent.
 * These describe WHAT was created, not HOW it was made.
 */
const TASK_TYPE_LABELS: Record<string, string> = {
    diagram: "Diagram",
    text: "Text artwork",
    logo: "Logo",
    photo: "Photorealistic",
    illustration: "Illustration",
    default: "Custom",
};

interface CreateImageToolResultProps {
    /** toolCallId is passed but not used - images render prominently without ToolRenderer */
    toolCallId?: string;
    status: ToolStatus;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Transform raw error messages to warm, user-facing copy.
 * Technical errors become friendly messages that feel like Carmenta.
 */
function getHumanFriendlyError(error: string): {
    title: string;
    message: string;
} {
    const lowerError = error.toLowerCase();

    // Step exhaustion / timeout
    if (
        lowerError.includes("step") ||
        lowerError.includes("timeout") ||
        lowerError.includes("exhausted")
    ) {
        return {
            title: "This one got complicated",
            message: "We're still learning. Mind trying again with a simpler prompt?",
        };
    }

    // Content policy
    if (
        lowerError.includes("content") ||
        lowerError.includes("policy") ||
        lowerError.includes("safety")
    ) {
        return {
            title: "We can't create that",
            message: "This prompt doesn't align with our content guidelines.",
        };
    }

    // Rate limiting
    if (lowerError.includes("rate") || lowerError.includes("limit")) {
        return {
            title: "Taking a breather",
            message: "We're a bit busy right now. Try again in a moment?",
        };
    }

    // Generic fallback - warm and owning it
    return {
        title: "Image generation hiccup",
        message: "Something went sideways. The robots have been notified.",
    };
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
    const prompt = input?.prompt as string | undefined;

    // Show pendulum loader while generating - with the user's prompt for anticipation
    if (status === "running") {
        return <ImageGenerationLoader className="w-full" prompt={prompt} />;
    }

    // Handle errors gracefully with warm messaging
    if (error) {
        const { title, message } = getHumanFriendlyError(error);
        return (
            <div className="bg-destructive/10 w-full rounded-lg p-4 text-sm">
                <p className="text-destructive font-medium">{title}</p>
                <p className="text-destructive/80 mt-1">{message}</p>
                {prompt && (
                    <p className="text-foreground/50 mt-3 text-xs">
                        Your prompt: "{prompt.slice(0, 100)}
                        {prompt.length > 100 ? "..." : ""}"
                    </p>
                )}
            </div>
        );
    }

    // Check for degraded result (agent returned but didn't generate)
    if (status === "completed" && isDegradedResult(output)) {
        return (
            <div className="bg-muted w-full rounded-lg p-4 text-sm">
                <p className="text-foreground font-medium">
                    We couldn't create that image
                </p>
                <p className="text-foreground/70 mt-1">
                    The request was tricky. Try rephrasing or simplifying your prompt?
                </p>
                {prompt && (
                    <p className="text-foreground/50 mt-3 text-xs">
                        Your prompt: "{prompt.slice(0, 100)}
                        {prompt.length > 100 ? "..." : ""}"
                    </p>
                )}
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
 * Check if this is a degraded result (agent completed but didn't generate).
 */
function isDegradedResult(output?: Record<string, unknown>): boolean {
    if (!output) return false;

    // SubagentResult with degraded flag
    if (output.degraded === true) return true;

    // SubagentResult where generated is false
    if ("data" in output && typeof output.data === "object" && output.data !== null) {
        const data = output.data as Record<string, unknown>;
        if (data.generated === false) return true;
    }

    return false;
}

/**
 * Extract image data from tool output.
 * Handles both legacy flat structure and new SubagentResult structure.
 */
function extractImageData(
    output?: Record<string, unknown>
): { base64: string; mimeType: string } | null {
    if (!output) return null;

    // New SubagentResult structure: { success, data: { images: [{ base64, mimeType }], ... } }
    if ("data" in output && typeof output.data === "object" && output.data !== null) {
        const data = output.data as Record<string, unknown>;
        const images = data.images as
            | Array<{ base64?: string; mimeType?: string }>
            | undefined;
        if (images?.[0]?.base64) {
            return {
                base64: images[0].base64,
                mimeType: images[0].mimeType ?? "image/png",
            };
        }
    }

    // Legacy flat structure: { image: { base64, mimeType }, ... }
    const image = output.image as { base64?: string; mimeType?: string } | undefined;
    if (image?.base64) {
        return {
            base64: image.base64,
            mimeType: image.mimeType ?? "image/png",
        };
    }

    return null;
}

/**
 * Extract metadata from tool output.
 * Handles both legacy flat structure and new SubagentResult structure.
 */
function extractMetadata(output?: Record<string, unknown>): {
    model?: string;
    taskType?: string;
    aspectRatio?: string;
    prompt?: string;
} {
    if (!output) return {};

    // New SubagentResult structure
    if ("data" in output && typeof output.data === "object" && output.data !== null) {
        const data = output.data as Record<string, unknown>;
        return {
            model: data.model as string | undefined,
            taskType: data.taskType as string | undefined,
            aspectRatio: data.aspectRatio as string | undefined,
            prompt: (data.expandedPrompt ?? data.originalPrompt) as string | undefined,
        };
    }

    // Legacy flat structure
    return {
        model: output.model as string | undefined,
        taskType: output.tier as string | undefined, // Legacy used "tier"
        aspectRatio: output.aspectRatio as string | undefined,
        prompt: output.prompt as string | undefined,
    };
}

/**
 * Validate the output has proper image data to display.
 * Checks for base64 presence and valid MIME type.
 */
function hasValidImage(output?: Record<string, unknown>): boolean {
    const imageData = extractImageData(output);
    if (!imageData || imageData.base64.length < 100) return false;

    // Validate MIME type to prevent XSS via data URIs
    if (
        !ALLOWED_MIME_TYPES.includes(
            imageData.mimeType as (typeof ALLOWED_MIME_TYPES)[number]
        )
    ) {
        logger.error(
            { mimeType: imageData.mimeType },
            "Invalid image MIME type from generation"
        );
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
function getHeightFromAspectRatio(aspectRatio: string, width = 1024): number {
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
    const [imageLoaded, setImageLoaded] = useState(false);

    // Extract image data using helper (handles both old and new structures)
    const imageData = extractImageData(output);
    if (!imageData) {
        logger.error(
            { hasOutput: !!output },
            "ImageCard rendered without valid image data"
        );
        return null;
    }

    // Extract metadata using helper
    const metadata = extractMetadata(output);
    const prompt = (input?.prompt as string) || metadata.prompt;
    const aspectRatio = (input?.aspectRatio as string) || metadata.aspectRatio || "1:1";
    const model = metadata.model;
    const taskType = metadata.taskType;

    // Human-friendly task type label
    const taskLabel = taskType ? (TASK_TYPE_LABELS[taskType] ?? taskType) : undefined;

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

    return (
        <>
            {/* Main card with hover actions - full width for maximum impact */}
            <div className="group relative w-full overflow-hidden rounded-lg">
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
                    width={1024}
                    height={getHeightFromAspectRatio(aspectRatio, 1024)}
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
                        <CopyImageButton src={src} ariaLabel="Copy image" size="sm" />
                        <DownloadImageButton
                            src={src}
                            mimeType={mimeType}
                            ariaLabel="Download image"
                            size="sm"
                        />
                        <button
                            onClick={() => setLightboxOpen(true)}
                            className="rounded-md bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                            title="View fullscreen"
                        >
                            <ArrowsOutIcon className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Bottom info - on hover */}
                    <div className="p-3">
                        <p className="mb-1 line-clamp-2 text-sm text-white/90">
                            {displayPrompt}
                        </p>
                        {(model || taskLabel) && (
                            <p className="text-xs text-white/50">
                                {taskLabel && <span>{taskLabel}</span>}
                                {taskLabel && model && " · "}
                                {model && <span>{model.split("/").pop()}</span>}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Always-visible info showing the work we did */}
            <div className="mt-2 space-y-1">
                {/* Model routing explanation */}
                {(model || taskLabel) && (
                    <p className="text-foreground/50 text-xs">
                        {taskLabel && <span className="font-medium">{taskLabel}</span>}
                        {taskLabel && model && " · "}
                        {model && <span>{model.split("/").pop()}</span>}
                    </p>
                )}

                {/* Expanded prompt - shows the enhancement we made */}
                {metadata.prompt && metadata.prompt !== (input?.prompt as string) && (
                    <details className="group/details">
                        <summary className="text-foreground/40 hover:text-foreground/60 cursor-pointer text-xs transition-colors">
                            <span className="group-open/details:hidden">
                                View enhanced prompt →
                            </span>
                            <span className="hidden group-open/details:inline">
                                Enhanced prompt ↓
                            </span>
                        </summary>
                        <p className="text-foreground/60 mt-1 text-xs leading-relaxed">
                            {metadata.prompt}
                        </p>
                    </details>
                )}
            </div>

            {/* Lightbox Modal */}
            <DialogPrimitive.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="z-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/90 backdrop-blur-md" />
                    <DialogPrimitive.Content className="z-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-4 flex items-center justify-center">
                        <DialogPrimitive.Title className="sr-only">
                            Image preview
                        </DialogPrimitive.Title>
                        {/* Close button */}
                        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white">
                            <XIcon className="h-6 w-6" />
                            <span className="sr-only">Close</span>
                        </DialogPrimitive.Close>

                        {/* Action buttons */}
                        <div className="absolute top-4 left-4 flex gap-2">
                            <CopyImageButton
                                src={src}
                                ariaLabel="Copy image"
                                variant="glass"
                            />
                            <DownloadImageButton
                                src={src}
                                mimeType={mimeType}
                                ariaLabel="Download image"
                                variant="glass"
                            />
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
                            {(model || taskLabel) && (
                                <p className="mt-1 text-xs text-white/50">
                                    {taskLabel && <span>{taskLabel}</span>}
                                    {taskLabel && model && " · "}
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
