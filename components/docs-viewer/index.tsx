"use client";

/**
 * Documentation Viewer
 *
 * Displays Carmenta documentation with TOC-style navigation.
 * Similar to KnowledgeViewer but read-only.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { DocsSidebar } from "./docs-sidebar";
import { DocsContent } from "./docs-content";
import type { DocSection } from "@/app/carmenta-docs/page";

export interface DocsViewerProps {
    sections: DocSection[];
}

export function DocsViewer({ sections }: DocsViewerProps) {
    // Select first document by default
    const firstDoc = sections[0]?.documents[0];
    const [selectedPath, setSelectedPath] = useState<string | null>(
        firstDoc?.path ?? null
    );
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Find selected document
    const selectedDocument = sections
        .flatMap((s) => s.documents)
        .find((d) => d.path === selectedPath);

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
                <DocsSidebar
                    sections={sections}
                    selectedPath={selectedPath}
                    onSelect={setSelectedPath}
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

                            <DocsSidebar
                                sections={sections}
                                selectedPath={selectedPath}
                                onSelect={handleMobileSelect}
                                className="h-full rounded-none"
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Content - full width on mobile, with left padding for hamburger */}
            <div className="flex-1 pl-14 md:pl-0">
                <DocsContent document={selectedDocument ?? null} />
            </div>
        </div>
    );
}
