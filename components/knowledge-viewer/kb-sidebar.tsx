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
    CaretRight,
    FileText,
    User,
    Sparkle,
    ChatCircle,
    Brain,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { KBFolder } from "@/lib/kb/actions";
import { transitions, variants } from "@/lib/motion/presets";

// Map folder paths to icons
const FOLDER_ICONS: Record<string, typeof User> = {
    about: User,
    memories: Brain,
    style: ChatCircle, // Used on /communication page
};

// Display names for folders
const FOLDER_DISPLAY_NAMES: Partial<Record<string, string>> = {
    about: "Profile",
    memories: "Memories",
    style: "Style", // Used on /communication page
};

// Map document paths to icons
const DOCUMENT_ICONS: Record<string, typeof FileText> = {
    "profile.character": Sparkle,
    "profile.identity": User,
    "profile.preferences": ChatCircle,
};

export interface KBSidebarProps {
    folders: KBFolder[];
    selectedPath: string | null;
    onSelect: (path: string) => void;
    dimmed?: boolean;
    /** Additional classes for the nav container */
    className?: string;
    /** Mobile full-screen mode - larger touch targets, no glass styling */
    mobile?: boolean;
}

export function KBSidebar({
    folders,
    selectedPath,
    onSelect,
    dimmed = false,
    className,
    mobile = false,
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
                "flex shrink-0 flex-col overflow-hidden transition-opacity duration-200",
                !mobile &&
                    "glass-card h-full max-h-[calc(100vh-16rem)] w-72 rounded-xl",
                dimmed && "opacity-30",
                className
            )}
        >
            {/* Header - hidden on mobile (parent provides header) */}
            {!mobile && (
                <div className="border-foreground/10 border-b p-4">
                    <span className="text-foreground/70 text-sm font-medium">
                        Knowledge
                    </span>
                </div>
            )}

            {/* Tree */}
            <div className={cn("flex-1 overflow-y-auto", mobile ? "p-4" : "p-3")}>
                {folders.length === 0 ? (
                    <p className="text-foreground/40 py-8 text-center text-sm">
                        No knowledge yet
                    </p>
                ) : (
                    folders.map((folder) => {
                        const FolderIcon = FOLDER_ICONS[folder.path] ?? FileText;
                        const isExpanded = expanded.has(folder.path);

                        return (
                            <div key={folder.id} className={mobile ? "mb-2" : "mb-1"}>
                                <button
                                    onClick={() => toggle(folder.path)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-lg transition-all",
                                        mobile
                                            ? "active:bg-foreground/5 min-h-[48px] px-4 py-3 text-base"
                                            : "hover:bg-foreground/5 px-3 py-2 text-sm"
                                    )}
                                >
                                    <FolderIcon
                                        className={cn(
                                            "text-foreground/50",
                                            mobile ? "h-5 w-5" : "h-4 w-4"
                                        )}
                                    />
                                    <span className="text-foreground/80 flex-1 text-left font-medium capitalize">
                                        {FOLDER_DISPLAY_NAMES[folder.path] ??
                                            folder.name}
                                    </span>
                                    {!isExpanded && (
                                        <span className="bg-foreground/10 text-foreground/50 rounded-full px-1.5 py-0.5 text-xs">
                                            {folder.documents.length}
                                        </span>
                                    )}
                                    <motion.div
                                        variants={variants.rotateChevron}
                                        animate={isExpanded ? "expanded" : "collapsed"}
                                        transition={transitions.quick}
                                    >
                                        <CaretRight
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
                                            initial={{ maxHeight: 0, opacity: 0 }}
                                            animate={{ maxHeight: 1000, opacity: 1 }}
                                            exit={{ maxHeight: 0, opacity: 0 }}
                                            transition={transitions.standard}
                                            className={cn(
                                                "border-foreground/10 overflow-hidden border-l-2",
                                                mobile ? "ml-7" : "ml-6"
                                            )}
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
                                                        data-tooltip-id={
                                                            !mobile && doc.description
                                                                ? "tip"
                                                                : undefined
                                                        }
                                                        data-tooltip-content={
                                                            doc.description ?? undefined
                                                        }
                                                        className={cn(
                                                            "flex w-full items-center gap-3 text-left transition-colors",
                                                            mobile
                                                                ? "active:bg-foreground/5 min-h-[48px] px-4 py-3 text-base"
                                                                : "px-3 py-3 text-sm",
                                                            selectedPath === doc.path
                                                                ? "bg-primary/10 text-primary"
                                                                : "text-foreground/60 hover:bg-foreground/5"
                                                        )}
                                                    >
                                                        <DocIcon
                                                            className={
                                                                mobile
                                                                    ? "h-5 w-5"
                                                                    : "h-4 w-4"
                                                            }
                                                        />
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
