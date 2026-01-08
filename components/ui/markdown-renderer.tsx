"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

import { cn } from "@/lib/utils";

/** Pulsing Carmenta logo as streaming cursor with graceful exit */
function StreamingCursor() {
    return (
        <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="ml-1 inline-flex items-center align-middle"
        >
            <Image
                src="/logos/icon-transparent.png"
                alt=""
                width={14}
                height={14}
                className="opacity-80"
            />
        </motion.span>
    );
}

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
        // Defensive: Streamdown may throw if content is undefined/null
        // Note: Intentionally using == null to allow empty strings (preserves wrapper)
        if (content == null) return null;

        return (
            <div
                className={cn(
                    "holo-markdown",
                    // Hide default Streamdown cursor when streaming (we show our own)
                    isStreaming && "[&_.streamdown-cursor]:hidden",
                    inline && "[&>*]:my-0 [&>p]:m-0 [&>p]:inline",
                    className
                )}
            >
                <Streamdown mode="streaming" isAnimating={isStreaming} controls={true}>
                    {content}
                </Streamdown>
                <AnimatePresence>
                    {isStreaming && <StreamingCursor key="cursor" />}
                </AnimatePresence>
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
