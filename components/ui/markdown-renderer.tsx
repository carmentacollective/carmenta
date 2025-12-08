"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import { CodeBlock } from "@/components/ui/code-block";

interface MarkdownRendererProps {
    content: string;
    className?: string;
    /** Customize markdown component rendering */
    components?: Partial<Components>;
    /** Inline mode - renders p as span, removes margins for compact display */
    inline?: boolean;
}

/**
 * Reusable markdown renderer with memoization
 *
 * Renders markdown content using ReactMarkdown with GFM support and code highlighting.
 * Supports inline mode for compact rendering (search snippets, etc.) and accepts
 * custom component overrides for specialized use cases.
 *
 * Memoized to prevent re-renders during streaming and optimized for performance.
 *
 * Based on research from assistant-ui, Vercel AI Chatbot, and LobeChat patterns.
 */
export const MarkdownRenderer = memo(
    ({ content, className, components, inline = false }: MarkdownRendererProps) => {
        const defaultComponents: Partial<Components> = {
            code: CodeBlock,
            ...(inline && { p: ({ children }) => <span>{children}</span> }),
        };

        return (
            <div className={cn("holo-markdown", inline && "[&>*]:my-0", className)}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        ...defaultComponents,
                        ...components,
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    },
    (prev, next) =>
        prev.content === next.content &&
        prev.className === next.className &&
        prev.inline === next.inline &&
        prev.components === next.components
);

MarkdownRenderer.displayName = "MarkdownRenderer";
