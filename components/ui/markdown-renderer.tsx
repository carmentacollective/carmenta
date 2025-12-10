"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/ui/code-block";

/**
 * Custom table component that wraps tables in a scrollable container
 * with styled scrollbars for both horizontal and vertical overflow.
 */
const TableWrapper = memo(({ children }: { children?: React.ReactNode }) => (
    <div className="scrollbar-holo my-3 overflow-x-auto rounded-lg border border-foreground/10">
        <table
            style={{
                borderCollapse: "separate",
                borderSpacing: 0,
            }}
        >
            {children}
        </table>
    </div>
));
TableWrapper.displayName = "TableWrapper";

interface MarkdownRendererProps {
    /** The markdown content to render */
    content: string;
    /** Optional CSS class name for the container */
    className?: string;
    /** Customize markdown component rendering */
    components?: Partial<Components>;
    /** Inline mode - renders p as span, removes margins for compact display */
    inline?: boolean;
}

/**
 * MarkdownRenderer - Reusable markdown rendering component
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Memoized to prevent re-renders during streaming
 * - Custom code block and table styling with scrollable containers
 * - Inline mode for compact rendering (search snippets, tool results)
 * - Full integration with Carmenta's visual language
 *
 * Based on research from assistant-ui, Vercel AI Chatbot, and LobeChat patterns.
 *
 * Usage:
 * ```tsx
 * <MarkdownRenderer content={markdownText} />
 * <MarkdownRenderer content={snippet} inline /> // For tool results
 * ```
 */
export const MarkdownRenderer = memo(
    ({ content, className, components, inline = false }: MarkdownRendererProps) => {
        const defaultComponents = useMemo(
            (): Partial<Components> => ({
                code: CodeBlock,
                table: TableWrapper,
                ...(inline ? { p: ({ children }) => <span>{children}</span> } : {}),
            }),
            [inline]
        );

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
