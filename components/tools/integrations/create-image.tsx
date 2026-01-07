"use client";

/**
 * CreateImage Tool UI - AI Image Generation Display
 *
 * Renders AI-generated images with the prompt that created them.
 * Provides a polished loading experience with rotating tips and progress animation.
 */

import { useEffect, useState } from "react";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleIcon } from "@phosphor-icons/react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { Card } from "@/components/ui/card";
import { ToolRenderer } from "../shared";
import { logger } from "@/lib/client-logger";

/** Allowed MIME types for generated images */
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Tips shown during image generation - honest, helpful information about what's happening.
 * No fake progress stages - just value during the wait.
 */
const generationTips = [
    "We're crafting something unique from your description",
    "AI is interpreting your vision into pixels",
    "Good images take a moment - we're being thorough",
    "Each generation creates something that's never existed before",
    "The model is considering composition, lighting, and style",
];

/**
 * Loading state component that provides a premium waiting experience.
 * Shows rotating tips, elapsed time, and activity indicator.
 */
function ImageGenerationInProgress({ prompt }: { prompt: string }) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedSeconds((s) => s + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Rotate tips every 8 seconds
    const currentTipIndex = Math.floor(elapsedSeconds / 8) % generationTips.length;
    const currentTip = generationTips[currentTipIndex];

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card relative max-w-lg overflow-hidden"
        >
            {/* Subtle shimmer overlay */}
            <div className="animate-shimmer pointer-events-none absolute inset-0 opacity-30" />

            {/* Header */}
            <div className="relative flex items-center gap-2">
                <SparkleIcon className="text-primary h-4 w-4 animate-pulse" />
                <span className="text-foreground text-sm">Creating image...</span>
            </div>

            {/* Prompt context */}
            <p className="text-muted-foreground/70 relative mt-2 line-clamp-2 text-xs">
                &quot;{prompt}&quot;
            </p>

            {/* Rotating tip with smooth crossfade */}
            <div className="relative mt-4 min-h-[1.5rem]">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={currentTipIndex}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="text-muted-foreground text-sm"
                    >
                        {currentTip}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Activity indicator - indeterminate progress bar */}
            <div className="bg-muted/50 relative mt-4 h-0.5 w-full overflow-hidden rounded-full">
                <motion.div
                    className="bg-primary/40 absolute h-full w-1/4 rounded-full"
                    animate={{
                        x: ["0%", "300%", "0%"],
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* Elapsed time - subtle, appears after 5s */}
            <AnimatePresence>
                {elapsedSeconds >= 5 && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="text-muted-foreground/40 relative mt-3 text-right text-xs"
                    >
                        {elapsedSeconds}s
                    </motion.p>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

interface CreateImageToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Visual CreateImage tool result with premium loading experience.
 * Shows polished progress UI while generating, then the final image.
 */
export function CreateImageToolResult({
    toolCallId,
    status,
    input,
    output,
    error,
}: CreateImageToolResultProps) {
    const prompt = (input.prompt as string) || "";

    // Show our custom loading experience for running state
    if (status === "running") {
        return <ImageGenerationInProgress prompt={prompt} />;
    }

    const hasVisualContent = status === "completed" && !error && hasValidImage(output);

    return (
        <ToolRenderer
            toolName="createImage"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {hasVisualContent && <ImageContent input={input} output={output} />}
        </ToolRenderer>
    );
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

/**
 * Renders the generated image with prompt context
 */
function ImageContent({
    input,
    output,
}: {
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
}) {
    // Defensive extraction with validation (hasValidImage already checked, but be safe)
    const imageData = output?.image as
        | { base64?: string; mimeType?: string }
        | undefined;
    if (!imageData?.base64) {
        logger.error(
            { hasOutput: !!output },
            "ImageContent rendered without valid image data"
        );
        return null;
    }

    const prompt = (input.prompt as string) || (output?.prompt as string);
    const aspectRatio =
        (input.aspectRatio as string) || (output?.aspectRatio as string) || "1:1";

    // Use validated MIME type with safe fallback
    const mimeType = ALLOWED_MIME_TYPES.includes(
        imageData.mimeType as (typeof ALLOWED_MIME_TYPES)[number]
    )
        ? imageData.mimeType
        : "image/png";

    const src = `data:${mimeType};base64,${imageData.base64}`;

    return (
        <Card className="max-w-lg overflow-hidden">
            <div className="relative">
                <Image
                    src={src}
                    alt={
                        prompt
                            ? `${prompt} (${aspectRatio})`
                            : `AI-generated image (${aspectRatio})`
                    }
                    width={512}
                    height={getHeightFromAspectRatio(aspectRatio)}
                    className="w-full object-contain"
                    unoptimized
                />
            </div>
            <div className="text-muted-foreground p-3 text-xs">
                <p className="line-clamp-2">{prompt}</p>
            </div>
        </Card>
    );
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
function getHeightFromAspectRatio(aspectRatio: string): number {
    const baseWidth = 512;
    return Math.round(baseWidth * (ASPECT_RATIOS[aspectRatio] ?? 1));
}
