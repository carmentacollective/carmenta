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
    /** Whether content is actively streaming (disables copy/download buttons) */
    isStreaming?: boolean;
}

/**
 * MarkdownRenderer - Reusable markdown rendering component
 *
 * Uses Streamdown (Vercel's AI-optimized markdown renderer) for streaming-aware
 * parsing. Handles incomplete markdown syntax gracefully during streaming.
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Shiki syntax highlighting with github-light/dark themes
 * - Built-in copy & download buttons for code blocks
 * - KaTeX math rendering (lazy-loaded when $$ detected)
 * - Mermaid diagram support
 *
 * The `isStreaming` prop disables interactive buttons during active streaming
 * to prevent copying incomplete content.
 */
export const MarkdownRenderer = memo(
    ({
        content,
        className,
        inline = false,
        isStreaming = false,
    }: MarkdownRendererProps) => {
        return (
            <div
                className={cn(
                    "holo-markdown",
                    inline && "[&>*]:my-0 [&>p]:m-0 [&>p]:inline",
                    className
                )}
            >
                <Streamdown mode="streaming" isAnimating={isStreaming} controls={true}>
                    {content}
                </Streamdown>
            </div>
        );
    },
    (prev, next) =>
        prev.content === next.content &&
        prev.className === next.className &&
        prev.inline === next.inline &&
        prev.isStreaming === next.isStreaming
);

MarkdownRenderer.displayName = "MarkdownRenderer";
