"use client";

import { memo, useMemo } from "react";
import { marked } from "marked";

import { cn } from "@/lib/utils";

// Configure marked for GitHub Flavored Markdown
marked.use({
    gfm: true,
    breaks: false,
});

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
 * Uses Marked for fast, synchronous markdown parsing.
 * Supports GitHub Flavored Markdown (tables, strikethrough, task lists).
 *
 * Note: This is a simplified version that renders HTML directly.
 * Custom code block styling is handled via CSS in .holo-markdown.
 */
export const MarkdownRenderer = memo(
    ({ content, className, inline = false }: MarkdownRendererProps) => {
        const html = useMemo(() => {
            // marked.parse() is synchronous when no async extensions are used
            const rendered = marked.parse(content) as string;

            // For inline mode, strip wrapping <p> tags for compact display
            if (inline) {
                return rendered.replace(/^<p>/, "").replace(/<\/p>\n?$/, "");
            }

            return rendered;
        }, [content, inline]);

        return (
            <div
                className={cn("holo-markdown", inline && "[&>*]:my-0", className)}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    },
    (prev, next) =>
        prev.content === next.content &&
        prev.className === next.className &&
        prev.inline === next.inline
);

MarkdownRenderer.displayName = "MarkdownRenderer";
