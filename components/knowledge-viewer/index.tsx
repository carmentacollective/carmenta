"use client";

/**
 * Knowledge Viewer
 *
 * Main component for viewing and editing the user's knowledge base.
 *
 * Desktop: Two-pane layout with sidebar + content
 * Mobile: Drill-down navigation (folder → docs → content) with named back button + search
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Search,
    X,
    User,
    MessageSquare,
    Brain,
} from "lucide-react";
import { KBSidebar } from "./kb-sidebar";
import { KBContent } from "./kb-content";
import { CommandPalette } from "./command-palette";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { KBDocument, KBFolder } from "@/lib/kb/actions";

// Folder display names and icons (shared with kb-sidebar)
const FOLDER_DISPLAY_NAMES: Record<string, string> = {
    about: "Profile",
    communication: "Communication",
    memories: "Memories",
};

const FOLDER_ICONS: Record<string, typeof User> = {
    about: User,
    communication: MessageSquare,
    memories: Brain,
};

export interface KnowledgeViewerProps {
    initialFolders: KBFolder[];
}

export function KnowledgeViewer({ initialFolders }: KnowledgeViewerProps) {
    const isMobile = useMediaQuery("(max-width: 767px)");

    const [folders, setFolders] = useState<KBFolder[]>(initialFolders);
    const [selectedPath, setSelectedPath] = useState<string | null>(
        initialFolders[0]?.documents[0]?.path ?? null
    );
    const [searchOpen, setSearchOpen] = useState(false);

    // Mobile-specific state
    const [mobileView, setMobileView] = useState<"folders" | "docs" | "content">(
        "folders"
    );
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [mobileSearchQuery, setMobileSearchQuery] = useState("");

    // Find selected document and current folder
    const selectedDocument = folders
        .flatMap((f) => f.documents)
        .find((d) => d.path === selectedPath);

    const currentFolder = folders.find((f) => f.id === currentFolderId);

    // Flat list for search
    const allDocuments = folders.flatMap((f) => f.documents);

    // Filter items based on search query (mobile)
    const filteredItems = useMemo(() => {
        if (!mobileSearchQuery) return null;
        if (mobileView === "folders") {
            return folders.filter((f) =>
                (FOLDER_DISPLAY_NAMES[f.path] ?? f.name)
                    .toLowerCase()
                    .includes(mobileSearchQuery.toLowerCase())
            );
        }
        if (mobileView === "docs" && currentFolder) {
            return currentFolder.documents.filter((d) =>
                d.name.toLowerCase().includes(mobileSearchQuery.toLowerCase())
            );
        }
        return null;
    }, [mobileSearchQuery, mobileView, folders, currentFolder]);

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

    // Handle search result selection (desktop command palette)
    const handleSearchSelect = useCallback((path: string) => {
        setSelectedPath(path);
        setSearchOpen(false);
    }, []);

    // Mobile navigation handlers
    const handleMobileFolderSelect = useCallback((folderId: string) => {
        setCurrentFolderId(folderId);
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
            setMobileView("folders");
            setCurrentFolderId(null);
        }
        setMobileSearchQuery("");
        setMobileSearchOpen(false);
    }, [mobileView]);

    // Mobile drill-down UI
    if (isMobile) {
        const displayFolders = (filteredItems as KBFolder[] | null) ?? folders;
        const displayDocs =
            (filteredItems as KBDocument[] | null) ?? currentFolder?.documents ?? [];
        const folderDisplayName = currentFolder
            ? (FOLDER_DISPLAY_NAMES[currentFolder.path] ?? currentFolder.name)
            : "";

        return (
            <div className="flex h-full flex-col bg-background">
                {/* Header with named back + search */}
                <div className="border-b border-foreground/10 pt-safe-top">
                    <div className="flex items-center justify-between px-4 py-3">
                        <AnimatePresence mode="wait">
                            {mobileView === "folders" ? (
                                <motion.span
                                    key="title"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-lg font-medium text-foreground"
                                >
                                    Knowledge Base
                                </motion.span>
                            ) : mobileView === "docs" ? (
                                <motion.button
                                    key="back-to-folders"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onClick={handleMobileBack}
                                    className="flex items-center gap-1 font-medium text-primary"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                    <span>{folderDisplayName}</span>
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
                                    <span>{selectedDocument?.name ?? "Back"}</span>
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Search toggle - only show on folders/docs views */}
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
                                        placeholder={`Search ${mobileView === "folders" ? "folders" : "documents"}...`}
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
                        {mobileView === "folders" && (
                            <motion.div
                                key="folders"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="h-full overflow-y-auto pb-safe-bottom"
                            >
                                {displayFolders.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-foreground/40">
                                        No folders match "{mobileSearchQuery}"
                                    </p>
                                ) : (
                                    displayFolders.map((folder) => {
                                        const Icon =
                                            FOLDER_ICONS[folder.path] ?? FileText;
                                        const displayName =
                                            FOLDER_DISPLAY_NAMES[folder.path] ??
                                            folder.name;
                                        return (
                                            <button
                                                key={folder.id}
                                                onClick={() =>
                                                    handleMobileFolderSelect(folder.id)
                                                }
                                                className="flex w-full items-center gap-4 border-b border-foreground/5 px-4 py-4 transition-colors active:bg-foreground/5"
                                            >
                                                <Icon className="h-5 w-5 text-primary/70" />
                                                <span className="flex-1 text-left text-base font-medium">
                                                    {displayName}
                                                </span>
                                                <span className="text-sm text-foreground/40">
                                                    {folder.documents.length}
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
                                            : "No documents in this folder"}
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
                                <KBContent
                                    document={selectedDocument ?? null}
                                    onUpdate={handleDocumentUpdate}
                                    dimmed={false}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    // Desktop two-pane layout
    return (
        <div className="relative flex h-full gap-6">
            {/* Sidebar */}
            <KBSidebar
                folders={folders}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                dimmed={searchOpen}
            />

            {/* Content */}
            <div className="flex-1">
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
