"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
    /** The markdown content to render */
    content: string;
    /** Optional CSS class name for the container */
    className?: string;
    /** Inline mode - removes paragraph margins for compact display */
    inline?: boolean;
}

/**
 * MarkdownRenderer - Reusable markdown rendering component
 *
 * Uses Streamdown (Vercel's AI-optimized markdown renderer) for streaming-aware
 * parsing. Handles incomplete markdown syntax gracefully during streaming.
 *
 * Supports GitHub Flavored Markdown (tables, strikethrough, task lists).
 */
export const MarkdownRenderer = memo(
    ({ content, className, inline = false }: MarkdownRendererProps) => {
        return (
            <div
                className={cn(
                    "holo-markdown",
                    inline && "[&>*]:my-0 [&>p]:m-0 [&>p]:inline",
                    className
                )}
            >
                <Streamdown>{content}</Streamdown>
            </div>
        );
    },
    (prev, next) =>
        prev.content === next.content &&
        prev.className === next.className &&
        prev.inline === next.inline
);

MarkdownRenderer.displayName = "MarkdownRenderer";
