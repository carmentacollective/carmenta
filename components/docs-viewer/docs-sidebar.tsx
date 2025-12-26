"use client";

/**
 * Documentation Sidebar
 *
 * TOC-style navigation for documentation pages.
 * Groups documents by section with expand/collapse.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    FileText,
    BookOpen,
    Sparkles,
    Plug,
    Heart,
    Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocSection } from "@/app/guide/page";

// Map section IDs to icons
const SECTION_ICONS: Record<string, typeof FileText> = {
    general: BookOpen,
    about: Info,
    features: Sparkles,
    integrations: Plug,
    philosophy: Heart,
};

export interface DocsSidebarProps {
    sections: DocSection[];
    selectedPath: string | null;
    onSelect: (path: string) => void;
    className?: string;
    /** Mobile full-screen mode - larger touch targets, no glass styling */
    mobile?: boolean;
}

export function DocsSidebar({
    sections,
    selectedPath,
    onSelect,
    className,
    mobile = false,
}: DocsSidebarProps) {
    const [expanded, setExpanded] = useState<Set<string>>(
        new Set(sections.map((s) => s.id))
    );

    const toggle = useCallback((sectionId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    return (
        <nav
            className={cn(
                "flex shrink-0 flex-col overflow-hidden",
                !mobile &&
                    "glass-card h-full max-h-[calc(100vh-16rem)] w-72 rounded-xl",
                className
            )}
        >
            {/* Header - hidden on mobile (parent provides header) */}
            {!mobile && (
                <div className="border-b border-foreground/10 p-4">
                    <span className="text-sm font-medium text-foreground/70">
                        Documentation
                    </span>
                </div>
            )}

            {/* Sections - scrollable */}
            <div className={cn("flex-1 overflow-y-auto", mobile ? "p-4" : "p-3")}>
                {sections.length === 0 ? (
                    <p className="py-8 text-center text-sm text-foreground/40">
                        No documentation yet
                    </p>
                ) : (
                    sections.map((section) => {
                        const SectionIcon = SECTION_ICONS[section.id] ?? FileText;
                        const isExpanded = expanded.has(section.id);

                        return (
                            <div key={section.id} className={mobile ? "mb-2" : "mb-1"}>
                                <button
                                    onClick={() => toggle(section.id)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-lg transition-all",
                                        mobile
                                            ? "min-h-[48px] px-4 py-3 text-base active:bg-foreground/5"
                                            : "px-3 py-2 text-sm hover:bg-foreground/5"
                                    )}
                                >
                                    <SectionIcon
                                        className={cn(
                                            "text-foreground/50",
                                            mobile ? "h-5 w-5" : "h-4 w-4"
                                        )}
                                    />
                                    <span className="flex-1 text-left font-medium text-foreground/80">
                                        {section.name}
                                    </span>
                                    {!isExpanded && (
                                        <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground/50">
                                            {section.documents.length}
                                        </span>
                                    )}
                                    <motion.div
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <ChevronRight
                                            className={cn(
                                                "text-foreground/30",
                                                mobile ? "h-5 w-5" : "h-4 w-4"
                                            )}
                                        />
                                    </motion.div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className={cn(
                                                "overflow-hidden border-l-2 border-foreground/10",
                                                mobile ? "ml-7" : "ml-6"
                                            )}
                                        >
                                            {section.documents.map((doc) => (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => onSelect(doc.path)}
                                                    title={
                                                        !mobile
                                                            ? (doc.description ??
                                                              undefined)
                                                            : undefined
                                                    }
                                                    className={cn(
                                                        "flex w-full items-center gap-3 text-left transition-colors",
                                                        mobile
                                                            ? "min-h-[48px] px-4 py-3 text-base active:bg-foreground/5"
                                                            : "px-3 py-3 text-sm hover:bg-foreground/5",
                                                        selectedPath === doc.path
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-foreground/60"
                                                    )}
                                                >
                                                    <FileText
                                                        className={
                                                            mobile
                                                                ? "h-5 w-5"
                                                                : "h-4 w-4"
                                                        }
                                                    />
                                                    <span>{doc.name}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })
                )}
            </div>
        </nav>
    );
}
