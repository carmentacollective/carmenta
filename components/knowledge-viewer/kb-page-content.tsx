"use client";

/**
 * Knowledge Base Page Content
 *
 * Client component wrapper that includes both the LibrarianTaskBar
 * and KnowledgeViewer, enabling refresh when the librarian makes changes.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "@phosphor-icons/react";

import { KnowledgeViewer } from "./index";
import { LibrarianTaskBar } from "./librarian-task-bar";
import { CarmentaSheet, CarmentaToggle } from "@/components/carmenta-assistant";
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
                <CarmentaToggle
                    isOpen={sheetOpen}
                    onClick={() => setSheetOpen(!sheetOpen)}
                    label="With Carmenta"
                />
            </div>

            {/* Knowledge Viewer */}
            <section className="min-h-[500px] flex-1">
                {initialFolders.length === 0 ? (
                    <div className="border-foreground/5 bg-foreground/[0.02] flex h-full flex-col items-center justify-center rounded-2xl border py-16 text-center">
                        <SparkleIcon className="text-foreground/30 mb-4 h-12 w-12" />
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
                placeholder="What should we organize?"
                description="Shaping what we know"
            />
        </>
    );
}
