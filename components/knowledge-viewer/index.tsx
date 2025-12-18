"use client";

/**
 * Knowledge Viewer
 *
 * Main component for viewing and editing the user's knowledge base.
 * Uses the Option 3 design: clean tree view with ⌘K command palette overlay.
 */

import { useState, useCallback } from "react";
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

    return (
        <div className="flex h-full gap-6">
            {/* Sidebar */}
            <KBSidebar
                folders={folders}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                dimmed={searchOpen}
            />

            {/* Content */}
            <KBContent
                document={selectedDocument ?? null}
                onUpdate={handleDocumentUpdate}
                dimmed={searchOpen}
            />

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
