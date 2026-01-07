"use client";

/**
 * Knowledge Base Sidebar
 *
 * Tree view navigation for the knowledge base. Displays folders and documents
 * with recursive expand/collapse functionality.
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
    Folder,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { KBFolder, KBDocument } from "@/lib/kb/actions";
import { transitions, variants } from "@/lib/motion/presets";

// Map root folder paths to icons
const FOLDER_ICONS: Record<string, typeof User> = {
    profile: User,
    knowledge: Brain,
    about: User,
    memories: Brain,
    style: ChatCircle,
};

// Display names for root folders
const FOLDER_DISPLAY_NAMES: Record<string, string> = {
    profile: "Profile",
    knowledge: "Knowledge",
    about: "About",
    memories: "Memories",
    style: "Style",
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
    className?: string;
    mobile?: boolean;
}

/** Count total items in a folder (documents + nested children) */
function countItems(folder: KBFolder): number {
    return (
        folder.documents.length +
        folder.children.reduce((sum, child) => sum + countItems(child), 0)
    );
}

/** Recursive folder renderer */
function FolderItem({
    folder,
    level,
    expanded,
    toggle,
    selectedPath,
    onSelect,
    mobile,
}: {
    folder: KBFolder;
    level: number;
    expanded: Set<string>;
    toggle: (path: string) => void;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    mobile: boolean;
}) {
    const isExpanded = expanded.has(folder.path);
    const isRoot = level === 0;

    // Use folder icon for root, generic folder for nested
    const FolderIcon = isRoot ? (FOLDER_ICONS[folder.path] ?? Folder) : Folder;

    const displayName = isRoot
        ? (FOLDER_DISPLAY_NAMES[folder.path] ?? folder.name)
        : folder.name;

    const itemCount = countItems(folder);
    const hasContent = itemCount > 0;

    return (
        <div className={mobile ? "mb-2" : "mb-1"}>
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
                    className={cn("text-foreground/50", mobile ? "h-5 w-5" : "h-4 w-4")}
                />
                <span className="text-foreground/80 flex-1 text-left font-medium capitalize">
                    {displayName}
                </span>
                {!isExpanded && hasContent && (
                    <span className="bg-foreground/10 text-foreground/50 rounded-full px-1.5 py-0.5 text-xs">
                        {itemCount}
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
                        animate={{ maxHeight: 2000, opacity: 1 }}
                        exit={{ maxHeight: 0, opacity: 0 }}
                        transition={transitions.standard}
                        className={cn(
                            "border-foreground/10 overflow-hidden border-l-2",
                            mobile ? "ml-7" : "ml-6"
                        )}
                    >
                        {/* Render nested subfolders first */}
                        {folder.children.map((child) => (
                            <FolderItem
                                key={child.id}
                                folder={child}
                                level={level + 1}
                                expanded={expanded}
                                toggle={toggle}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                                mobile={mobile}
                            />
                        ))}

                        {/* Then render documents */}
                        {folder.documents.map((doc) => (
                            <DocumentItem
                                key={doc.id}
                                doc={doc}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                                mobile={mobile}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Document item renderer */
function DocumentItem({
    doc,
    selectedPath,
    onSelect,
    mobile,
}: {
    doc: KBDocument;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    mobile: boolean;
}) {
    const DocIcon = DOCUMENT_ICONS[doc.path] ?? FileText;

    return (
        <button
            onClick={() => onSelect(doc.path)}
            data-tooltip-id={!mobile && doc.description ? "tip" : undefined}
            data-tooltip-content={doc.description ?? undefined}
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
            <DocIcon className={mobile ? "h-5 w-5" : "h-4 w-4"} />
            <span>{doc.name}</span>
        </button>
    );
}

export function KBSidebar({
    folders,
    selectedPath,
    onSelect,
    dimmed = false,
    className,
    mobile = false,
}: KBSidebarProps) {
    // Initialize with all folders expanded (lazy initialization for performance)
    const [expanded, setExpanded] = useState<Set<string>>(() => {
        const getAllPaths = (folder: KBFolder): string[] => [
            folder.path,
            ...folder.children.flatMap(getAllPaths),
        ];
        return new Set(folders.flatMap(getAllPaths));
    });

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
                    folders.map((folder) => (
                        <FolderItem
                            key={folder.id}
                            folder={folder}
                            level={0}
                            expanded={expanded}
                            toggle={toggle}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            mobile={mobile}
                        />
                    ))
                )}
            </div>
        </nav>
    );
}
