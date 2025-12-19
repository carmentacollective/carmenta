"use client";

/**
 * Knowledge Viewer
 *
 * Main component for viewing and editing the user's knowledge base.
 * Uses the Option 3 design: clean tree view with ⌘K command palette overlay.
 *
 * Mobile: Sidebar hidden by default, accessible via hamburger menu that opens
 * a slide-over drawer. Content takes full width.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { KBSidebar } from "./kb-sidebar";
import { KBContent } from "./kb-content";
import { CommandPalette } from "./command-palette";
import type { KBDocument, KBFolder } from "@/lib/kb/actions";

export interface KnowledgeViewerProps {
    initialFolders: KBFolder[];
}

export function KnowledgeViewer({ initialFolders }: KnowledgeViewerProps) {
    const [folders, setFolders] = useState<KBFolder[]>(initialFolders);
    const [selectedPath, setSelectedPath] = useState<string | null>(
        initialFolders[0]?.documents[0]?.path ?? null
    );
    const [searchOpen, setSearchOpen] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Find selected document
    const selectedDocument = folders
        .flatMap((f) => f.documents)
        .find((d) => d.path === selectedPath);

    // Flat list for search
    const allDocuments = folders.flatMap((f) => f.documents);

    // Handle document update
    const handleDocumentUpdate = useCallback((path: string, updatedDoc: KBDocument) => {
        setFolders((prev) =>
            prev.map((folder) => ({
                ...folder,
                documents: folder.documents.map((doc) =>
                    doc.path === path ? updatedDoc : doc
                ),
            }))
        );
    }, []);

    // Handle search result selection
    const handleSearchSelect = useCallback((path: string) => {
        setSelectedPath(path);
        setSearchOpen(false);
    }, []);

    // Handle mobile sidebar selection (closes drawer after selecting)
    const handleMobileSelect = useCallback((path: string) => {
        setSelectedPath(path);
        setMobileSidebarOpen(false);
    }, []);

    return (
        <div className="relative flex h-full gap-4 md:gap-6">
            {/* Mobile hamburger button - top left */}
            <button
                onClick={() => setMobileSidebarOpen(true)}
                className="absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-background/80 text-foreground/70 shadow-md backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground md:hidden"
                aria-label="Open navigation"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* Desktop sidebar - hidden on mobile */}
            <div className="hidden md:block">
                <KBSidebar
                    folders={folders}
                    selectedPath={selectedPath}
                    onSelect={setSelectedPath}
                    dimmed={searchOpen}
                />
            </div>

            {/* Mobile sidebar drawer */}
            <AnimatePresence>
                {mobileSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileSidebarOpen(false)}
                        />

                        {/* Slide-over drawer */}
                        <motion.div
                            className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] md:hidden"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setMobileSidebarOpen(false)}
                                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition-colors hover:bg-foreground/20"
                                aria-label="Close navigation"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <KBSidebar
                                folders={folders}
                                selectedPath={selectedPath}
                                onSelect={handleMobileSelect}
                                dimmed={false}
                                className="h-full rounded-none"
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Content - full width on mobile, with left padding for hamburger */}
            <div className="flex-1 pl-14 md:pl-0">
                <KBContent
                    document={selectedDocument ?? null}
                    onUpdate={handleDocumentUpdate}
                    dimmed={searchOpen}
                />
            </div>

            {/* Command Palette */}
            <CommandPalette
                open={searchOpen}
                onOpenChange={setSearchOpen}
                documents={allDocuments}
                folders={folders}
                selectedPath={selectedPath}
                onSelect={handleSearchSelect}
            />
        </div>
    );
}

// Re-export sub-components for flexibility
export { KBSidebar } from "./kb-sidebar";
export { KBContent } from "./kb-content";
export { CommandPalette } from "./command-palette";
