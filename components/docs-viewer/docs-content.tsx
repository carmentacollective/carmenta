"use client";

/**
 * Documentation Content Pane
 *
 * Read-only display for documentation with markdown rendering.
 */

import { FileTextIcon, BookOpenIcon } from "@phosphor-icons/react";
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
                    <BookOpenIcon className="text-foreground/30 h-12 w-12" />
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
                className="border-foreground/5 flex items-center gap-3 border-b px-6 py-4"
            >
                <FileTextIcon
                    className="text-foreground/50 h-5 w-5"
                    aria-hidden="true"
                />
                <div className="flex flex-col">
                    <h2 className="text-foreground text-lg font-medium">{doc.name}</h2>
                    {doc.description && (
                        <p className="text-foreground/50 line-clamp-2 text-sm">
                            {doc.description}
                        </p>
                    )}
                </div>
            </header>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <MarkdownRenderer
                    content={doc.content}
                    className="text-foreground/80 text-[15px] leading-[1.7]"
                />
            </div>
        </main>
    );
}
