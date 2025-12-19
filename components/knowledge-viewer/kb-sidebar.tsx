"use client";

/**
 * Knowledge Base Sidebar
 *
 * Tree view navigation for the knowledge base. Displays folders and documents
 * with expand/collapse functionality. Shows ⌘K hint for quick search.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    FileText,
    User,
    Sparkles,
    MessageSquare,
    Heart,
    BookOpen,
    Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KBFolder } from "@/lib/kb/actions";

// Map folder paths to icons (order: values, profile, knowledge, docs)
const FOLDER_ICONS: Record<string, typeof User> = {
    values: Heart,
    profile: User,
    knowledge: Brain,
    docs: BookOpen,
};

// Display names for folders (overrides capitalized path names)
const FOLDER_DISPLAY_NAMES: Record<string, string> = {
    docs: "Carmenta Documentation",
};

// Map document paths to icons
const DOCUMENT_ICONS: Record<string, typeof FileText> = {
    "values.heart-centered": Heart,
    "profile.character": Sparkles,
    "profile.identity": User,
    "profile.preferences": MessageSquare,
};

export interface KBSidebarProps {
    folders: KBFolder[];
    selectedPath: string | null;
    onSelect: (path: string) => void;
    dimmed?: boolean;
    /** Additional classes for the nav container */
    className?: string;
}

export function KBSidebar({
    folders,
    selectedPath,
    onSelect,
    dimmed = false,
    className,
}: KBSidebarProps) {
    const [expanded, setExpanded] = useState<Set<string>>(
        new Set(folders.map((f) => f.path))
    );

    const toggle = useCallback((folderId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    }, []);

    return (
        <nav
            className={cn(
                "glass-card flex min-h-[400px] w-72 shrink-0 flex-col overflow-hidden rounded-xl transition-opacity duration-200",
                dimmed && "opacity-30",
                className
            )}
        >
            {/* Header */}
            <div className="border-b border-foreground/10 p-4">
                <span className="text-sm font-medium text-foreground/70">
                    Knowledge
                </span>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-3">
                {folders.length === 0 ? (
                    <p className="py-8 text-center text-sm text-foreground/40">
                        No knowledge yet
                    </p>
                ) : (
                    folders.map((folder) => {
                        const FolderIcon = FOLDER_ICONS[folder.path] ?? FileText;
                        const isExpanded = expanded.has(folder.path);

                        return (
                            <div key={folder.id} className="mb-1">
                                <button
                                    onClick={() => toggle(folder.path)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all hover:bg-foreground/5"
                                >
                                    <FolderIcon className="h-4 w-4 text-foreground/50" />
                                    <span className="flex-1 text-left font-medium capitalize text-foreground/80">
                                        {FOLDER_DISPLAY_NAMES[folder.path] ??
                                            folder.name}
                                    </span>
                                    {!isExpanded && (
                                        <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground/50">
                                            {folder.documents.length}
                                        </span>
                                    )}
                                    <motion.div
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <ChevronRight className="h-4 w-4 text-foreground/30" />
                                    </motion.div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="ml-6 overflow-hidden border-l-2 border-foreground/10"
                                        >
                                            {folder.documents.map((doc) => {
                                                const DocIcon =
                                                    DOCUMENT_ICONS[doc.path] ??
                                                    FileText;
                                                return (
                                                    <button
                                                        key={doc.id}
                                                        onClick={() =>
                                                            onSelect(doc.path)
                                                        }
                                                        className={cn(
                                                            "flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition-colors",
                                                            selectedPath === doc.path
                                                                ? "bg-primary/10 text-primary"
                                                                : "text-foreground/60 hover:bg-foreground/5"
                                                        )}
                                                    >
                                                        <DocIcon className="h-4 w-4" />
                                                        <span>{doc.name}</span>
                                                    </button>
                                                );
                                            })}
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
