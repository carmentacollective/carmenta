"use client";

/**
 * Imgflip Tool UI - Meme Display
 *
 * Renders custom memes created with Imgflip.
 * Uses ToolRenderer for consistent status display.
 *
 * Actions:
 * - list_templates: Compact status (non-visual operation)
 * - create_meme: Visual meme card with image
 */

import Image from "next/image";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { Card } from "@/components/ui/card";
import { ToolRenderer } from "./tool-renderer";

interface ImgflipToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Visual Imgflip tool result using ToolRenderer for consistent collapsed state.
 * Expands to show the created meme image.
 */
export function ImgflipToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: ImgflipToolResultProps) {
    const hasVisualContent =
        status === "completed" && action === "create_meme" && hasMeme(output);

    return (
        <ToolRenderer
            toolName="imgflip"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {hasVisualContent && <MemeContent input={input} output={output} />}
        </ToolRenderer>
    );
}

/**
 * Check if the output has a meme URL to display
 */
function hasMeme(output?: Record<string, unknown>): boolean {
    return Boolean(output?.url);
}

/**
 * Renders the meme image with attribution
 */
function MemeContent({
    input,
    output,
}: {
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
}) {
    const url = output?.url as string;
    const topText = input.topText as string | undefined;
    const bottomText = input.bottomText as string | undefined;

    return (
        <Card className="max-w-md overflow-hidden">
            <div className="relative aspect-auto">
                <Image
                    src={url}
                    alt={`Meme: ${[topText, bottomText].filter(Boolean).join(" / ")}`}
                    width={500}
                    height={500}
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 448px"
                />
            </div>
            <div className="p-3 text-center text-xs text-muted-foreground">
                Powered by Imgflip
            </div>
        </Card>
    );
}
