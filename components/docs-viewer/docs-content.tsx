"use client";

/**
 * Documentation Content Pane
 *
 * Read-only display for documentation with markdown rendering.
 */

import { FileText, BookOpen } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { KBDocument } from "@/lib/kb/actions";

export interface DocsContentProps {
    document: KBDocument | null;
}

export function DocsContent({ document: doc }: DocsContentProps) {
    if (!doc) {
        return (
            <main className="glass-card flex h-full max-h-[calc(100vh-16rem)] flex-1 items-center justify-center rounded-xl">
                <div className="flex flex-col items-center gap-3 text-center">
                    <BookOpen className="h-12 w-12 text-foreground/30" />
                    <p className="text-foreground/40">Select a document to read</p>
                </div>
            </main>
        );
    }

    return (
        <main className="glass-card flex h-full max-h-[calc(100vh-16rem)] flex-1 flex-col overflow-hidden rounded-xl">
            {/* Header */}
            <header
                role="banner"
                aria-label={doc.name}
                className="flex items-center gap-3 border-b border-foreground/5 px-6 py-4"
            >
                <FileText className="h-5 w-5 text-foreground/50" aria-hidden="true" />
                <div className="flex flex-col">
                    <h2 className="text-lg font-medium text-foreground">{doc.name}</h2>
                    {doc.description && (
                        <p className="line-clamp-2 text-sm text-foreground/50">
                            {doc.description}
                        </p>
                    )}
                </div>
            </header>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <MarkdownRenderer
                    content={doc.content}
                    className="text-[15px] leading-[1.7] text-foreground/80"
                />
            </div>
        </main>
    );
}
