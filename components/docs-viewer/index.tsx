"use client";

/**
 * Documentation Viewer
 *
 * Displays Carmenta documentation with TOC-style navigation.
 *
 * Desktop: Two-pane layout with sidebar + content
 * Mobile: Drill-down navigation (sections → docs → content) with named back button + search
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Search,
    X,
    BookOpen,
    Info,
    Sparkles,
    Plug,
    Heart,
} from "lucide-react";
import { DocsSidebar } from "./docs-sidebar";
import { DocsContent } from "./docs-content";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { DocSection } from "@/app/guide/page";

// Section icons (shared with docs-sidebar)
const SECTION_ICONS: Record<string, typeof FileText> = {
    general: BookOpen,
    about: Info,
    features: Sparkles,
    integrations: Plug,
    philosophy: Heart,
};

export interface DocsViewerProps {
    sections: DocSection[];
}

export function DocsViewer({ sections }: DocsViewerProps) {
    const isMobile = useMediaQuery("(max-width: 767px)");

    // Select first document by default
    const firstDoc = sections[0]?.documents[0];
    const [selectedPath, setSelectedPath] = useState<string | null>(
        firstDoc?.path ?? null
    );

    // Mobile-specific state
    const [mobileView, setMobileView] = useState<"sections" | "docs" | "content">(
        "sections"
    );
    const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [mobileSearchQuery, setMobileSearchQuery] = useState("");

    // Find selected document and current section
    const selectedDocument = sections
        .flatMap((s) => s.documents)
        .find((d) => d.path === selectedPath);

    const currentSection = sections.find((s) => s.id === currentSectionId);

    // Filter items based on search query (mobile)
    const filteredItems = useMemo(() => {
        if (!mobileSearchQuery) return null;
        if (mobileView === "sections") {
            return sections.filter((s) =>
                s.name.toLowerCase().includes(mobileSearchQuery.toLowerCase())
            );
        }
        if (mobileView === "docs" && currentSection) {
            return currentSection.documents.filter((d) =>
                d.name.toLowerCase().includes(mobileSearchQuery.toLowerCase())
            );
        }
        return null;
    }, [mobileSearchQuery, mobileView, sections, currentSection]);

    // Mobile navigation handlers
    const handleMobileSectionSelect = useCallback((sectionId: string) => {
        setCurrentSectionId(sectionId);
        setMobileView("docs");
        setMobileSearchQuery("");
        setMobileSearchOpen(false);
    }, []);

    const handleMobileDocSelect = useCallback((path: string) => {
        setSelectedPath(path);
        setMobileView("content");
        setMobileSearchQuery("");
        setMobileSearchOpen(false);
    }, []);

    const handleMobileBack = useCallback(() => {
        if (mobileView === "content") {
            setMobileView("docs");
        } else if (mobileView === "docs") {
            setMobileView("sections");
            setCurrentSectionId(null);
        }
        setMobileSearchQuery("");
        setMobileSearchOpen(false);
    }, [mobileView]);

    // Mobile drill-down UI
    if (isMobile) {
        const displaySections = (filteredItems as DocSection[] | null) ?? sections;
        const displayDocs =
            (filteredItems as DocSection["documents"] | null) ??
            currentSection?.documents ??
            [];

        return (
            <div key="mobile" className="flex h-full flex-col bg-background">
                {/* Header with named back + search */}
                <div className="border-b border-foreground/10 pt-safe-top">
                    <div className="flex items-center justify-between px-4 py-3">
                        <AnimatePresence mode="wait">
                            {mobileView === "sections" ? (
                                <motion.span
                                    key="title"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-lg font-medium text-foreground"
                                >
                                    Guide
                                </motion.span>
                            ) : mobileView === "docs" ? (
                                <motion.button
                                    key="back-to-sections"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onClick={handleMobileBack}
                                    className="flex items-center gap-1 font-medium text-primary"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                    <span>{currentSection?.name}</span>
                                </motion.button>
                            ) : (
                                <motion.button
                                    key="back-to-docs"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onClick={handleMobileBack}
                                    className="flex items-center gap-1 font-medium text-primary"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                    <span>{currentSection?.name ?? "Back"}</span>
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Search toggle - only show on sections/docs views */}
                        {mobileView !== "content" && (
                            <button
                                onClick={() => {
                                    setMobileSearchOpen(!mobileSearchOpen);
                                    if (mobileSearchOpen) setMobileSearchQuery("");
                                }}
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                                    mobileSearchOpen
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground/50 active:bg-foreground/5"
                                )}
                            >
                                {mobileSearchOpen ? (
                                    <X className="h-5 w-5" />
                                ) : (
                                    <Search className="h-5 w-5" />
                                )}
                            </button>
                        )}
                    </div>

                    {/* Collapsible search input */}
                    <AnimatePresence>
                        {mobileSearchOpen && mobileView !== "content" && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="px-4 pb-3">
                                    <input
                                        value={mobileSearchQuery}
                                        onChange={(e) =>
                                            setMobileSearchQuery(e.target.value)
                                        }
                                        placeholder={`Search ${mobileView === "sections" ? "sections" : "documents"}...`}
                                        autoFocus
                                        className="w-full rounded-xl bg-foreground/5 px-4 py-3 text-base outline-none transition-colors focus:bg-foreground/10"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {mobileView === "sections" && (
                            <motion.div
                                key="sections"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full overflow-y-auto pb-safe-bottom"
                            >
                                {displaySections.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-foreground/40">
                                        No sections match "{mobileSearchQuery}"
                                    </p>
                                ) : (
                                    displaySections.map((section) => {
                                        const Icon =
                                            SECTION_ICONS[section.id] ?? FileText;
                                        return (
                                            <button
                                                key={section.id}
                                                onClick={() =>
                                                    handleMobileSectionSelect(
                                                        section.id
                                                    )
                                                }
                                                className="flex w-full items-center gap-4 border-b border-foreground/5 px-4 py-4 transition-colors active:bg-foreground/5"
                                            >
                                                <Icon className="h-5 w-5 text-primary/70" />
                                                <span className="flex-1 text-left text-base font-medium">
                                                    {section.name}
                                                </span>
                                                <span className="text-sm text-foreground/40">
                                                    {section.documents.length}
                                                </span>
                                                <ChevronRight className="h-5 w-5 text-foreground/30" />
                                            </button>
                                        );
                                    })
                                )}
                            </motion.div>
                        )}

                        {mobileView === "docs" && (
                            <motion.div
                                key="docs"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full overflow-y-auto pb-safe-bottom"
                            >
                                {displayDocs.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-foreground/40">
                                        {mobileSearchQuery
                                            ? `No documents match "${mobileSearchQuery}"`
                                            : "No documents in this section"}
                                    </p>
                                ) : (
                                    displayDocs.map((doc) => (
                                        <button
                                            key={doc.id}
                                            onClick={() =>
                                                handleMobileDocSelect(doc.path)
                                            }
                                            className={cn(
                                                "flex w-full items-center gap-4 border-b border-foreground/5 px-4 py-4 transition-colors",
                                                selectedPath === doc.path
                                                    ? "bg-primary/10"
                                                    : "active:bg-foreground/5"
                                            )}
                                        >
                                            <FileText className="h-5 w-5 text-foreground/40" />
                                            <div className="flex-1 text-left">
                                                <span className="text-base font-medium">
                                                    {doc.name}
                                                </span>
                                                {doc.description && (
                                                    <p className="mt-0.5 text-sm text-foreground/50">
                                                        {doc.description}
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-foreground/30" />
                                        </button>
                                    ))
                                )}
                            </motion.div>
                        )}

                        {mobileView === "content" && (
                            <motion.div
                                key="content"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full overflow-y-auto"
                            >
                                <DocsContent document={selectedDocument ?? null} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    // Desktop two-pane layout
    return (
        <div key="desktop" className="relative flex h-full gap-6">
            {/* Sidebar */}
            <DocsSidebar
                sections={sections}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
            />

            {/* Content */}
            <div className="flex-1">
                <DocsContent document={selectedDocument ?? null} />
            </div>
        </div>
    );
}
