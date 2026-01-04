"use client";

/**
 * Knowledge Base Page Content
 *
 * Client component wrapper that includes both the LibrarianTaskBar
 * and KnowledgeViewer, enabling refresh when the librarian makes changes.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react";

import { KnowledgeViewer } from "./index";
import { LibrarianTaskBar } from "./librarian-task-bar";
import type { KBFolder } from "@/lib/kb/actions";

interface KBPageContentProps {
    initialFolders: KBFolder[];
}

export function KBPageContent({ initialFolders }: KBPageContentProps) {
    const router = useRouter();

    // Refresh the page when librarian makes changes
    const handleChangesComplete = useCallback(() => {
        router.refresh();
    }, [router]);

    return (
        <>
            {/* Librarian Task Bar */}
            <LibrarianTaskBar
                onChangesComplete={handleChangesComplete}
                className="mb-4"
            />

            {/* Knowledge Viewer */}
            <section className="min-h-[500px] flex-1">
                {initialFolders.length === 0 ? (
                    <div className="border-foreground/5 bg-foreground/[0.02] flex h-full flex-col items-center justify-center rounded-2xl border py-16 text-center">
                        <Sparkle className="text-foreground/30 mb-4 h-12 w-12" />
                        <h3 className="text-foreground/80 text-lg font-medium">
                            We're setting up your knowledge base
                        </h3>
                        <p className="text-foreground/60 mt-2 text-sm">
                            Refresh the page in a moment.
                        </p>
                    </div>
                ) : (
                    <KnowledgeViewer initialFolders={initialFolders} />
                )}
            </section>
        </>
    );
}
