"use client";

import { FileText, ExternalLink } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface FetchPageResultProps {
    toolCallId: string;
    status: ToolStatus;
    url: string;
    title?: string;
    content?: string;
    error?: string;
}

/**
 * Tool UI for displaying fetched page content.
 *
 * Uses ToolRenderer for consistent collapsed state.
 * Expands to show page title, link, and content preview.
 */
export function FetchPageResult({
    toolCallId,
    status,
    url,
    title,
    content,
    error,
}: FetchPageResultProps) {
    const hasContent = status === "completed" && (title || content);

    return (
        <ToolRenderer
            toolName="fetchPage"
            toolCallId={toolCallId}
            status={status}
            input={{ url }}
            output={content ? { title, content } : undefined}
            error={error}
        >
            {hasContent && (
                <FetchPageContent url={url} title={title} content={content} />
            )}
        </ToolRenderer>
    );
}

/**
 * Expanded content for fetch page results.
 */
function FetchPageContent({
    url,
    title,
    content,
}: {
    url: string;
    title?: string;
    content?: string;
}) {
    const contentPreview =
        content && content.length > 500 ? content.slice(0, 500) + "..." : content;

    return (
        <div className="max-w-2xl">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                        {title || "Page Content"}
                    </span>
                </div>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                    <span className="hidden sm:inline">Open</span>
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            <p className="mt-1 truncate text-xs text-muted-foreground/70">{url}</p>

            {content && (
                <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Preview content ({content.length.toLocaleString()} chars)
                    </summary>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded bg-muted/50 p-3 text-xs text-foreground/80">
                        <pre className="whitespace-pre-wrap font-sans">
                            {contentPreview}
                        </pre>
                    </div>
                </details>
            )}
        </div>
    );
}
