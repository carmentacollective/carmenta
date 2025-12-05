"use client";

import { FileText, ExternalLink, AlertCircle } from "lucide-react";

import type { ToolStatus } from "@/lib/tools/tool-config";

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
 * Shows page title with link and collapsible content preview.
 */
export function FetchPageResult({
    status,
    url,
    title,
    content,
    error,
}: FetchPageResultProps) {
    // Loading state
    if (status === "running") {
        return (
            <div className="glass-card max-w-2xl animate-pulse">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                        Reading page...
                    </span>
                </div>
                <div className="mt-2 truncate text-xs text-muted-foreground/70">
                    {url}
                </div>
                <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-3/4 rounded bg-muted" />
                </div>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="glass-card max-w-2xl border-destructive/50 bg-destructive/10">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                        {error || "Failed to fetch page content."}
                    </p>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{url}</p>
            </div>
        );
    }

    // Success state - show compact confirmation
    const contentPreview =
        content && content.length > 500 ? content.slice(0, 500) + "..." : content;

    return (
        <div className="glass-card max-w-2xl">
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
