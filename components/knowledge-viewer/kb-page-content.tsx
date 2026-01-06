"use client";

/**
 * Knowledge Base Page Content
 *
 * Client component wrapper that includes both the LibrarianTaskBar
 * and KnowledgeViewer, enabling refresh when the librarian makes changes.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react";

import { KnowledgeViewer } from "./index";
import { LibrarianTaskBar } from "./librarian-task-bar";
import { CarmentaSheet } from "@/components/carmenta-assistant";
import type { KBFolder } from "@/lib/kb/actions";

interface KBPageContentProps {
    initialFolders: KBFolder[];
}

export function KBPageContent({ initialFolders }: KBPageContentProps) {
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);

    // Refresh the page when Carmenta makes changes
    const handleChangesComplete = useCallback(() => {
        router.refresh();
    }, [router]);

    return (
        <>
            {/* Librarian Task Bar + Carmenta Button */}
            <div className="mb-4 flex items-start gap-3">
                <LibrarianTaskBar
                    onChangesComplete={handleChangesComplete}
                    className="flex-1"
                />
                <button
                    onClick={() => setSheetOpen(true)}
                    className="glass-card hover:bg-foreground/5 flex items-center gap-2 rounded-xl px-4 py-2.5 transition-colors"
                    title="Work with Carmenta to organize your knowledge"
                >
                    <Sparkle className="text-primary h-5 w-5" weight="duotone" />
                    <span className="hidden text-sm font-medium sm:inline">
                        Organize together
                    </span>
                </button>
            </div>

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

            {/* Carmenta Sheet */}
            <CarmentaSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                pageContext="We're in the knowledge base. The user can reorganize folders, rename documents, create new categories, or ask me to extract insights from their conversations."
                onChangesComplete={handleChangesComplete}
                placeholder="Reorganize, rename, create categories..."
                description="Shaping what we know"
            />
        </>
    );
}
