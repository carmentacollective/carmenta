"use client";

/**
 * CreateImage Tool UI - AI Image Generation Display
 *
 * Renders AI-generated images with the prompt that created them.
 * Shows the Carmenta pendulum loader while generating.
 */

import Image from "next/image";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { Card } from "@/components/ui/card";
import { ToolRenderer } from "../shared";
import { logger } from "@/lib/client-logger";
import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";

/** Allowed MIME types for generated images */
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

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

    // Show pendulum loader while generating
    if (status === "running") {
        return <ImageGenerationLoader className="max-w-lg" />;
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
