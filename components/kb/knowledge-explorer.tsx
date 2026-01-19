"use client";

/**
 * Knowledge Explorer
 *
 * Unified two-pane knowledge base explorer.
 * Used by both the KB page (static) and the import flow (live polling).
 *
 * Features:
 * - Tree view with folder icons and expand/collapse
 * - Document detail view with editing or correction mode
 * - "NEW" badge animations for newly added items
 * - Command palette search (⌘K)
 * - Mobile responsive layout
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { KnowledgeTree } from "./knowledge-tree";
import { KnowledgeDetail } from "./knowledge-detail";
import { KBContent } from "@/components/knowledge-viewer/kb-content";
import { CommandPalette } from "@/components/knowledge-viewer/command-palette";
import type { KBDocumentData } from "./tree-utils";
import type { KBDocument, KBFolder } from "@/lib/kb/actions";

export interface KnowledgeExplorerProps {
    /** Documents to display in the tree */
    documents: KBDocumentData[];
    /** Currently selected document path */
    selectedPath?: string | null;
    /** Callback when a document is selected */
    onSelect?: (path: string | null) => void;
    /** Paths to highlight as new (for import animation) */
    newPaths?: Set<string>;
    /** Mode: "view" for corrections (import), "edit" for full editing (KB page) */
    mode?: "view" | "edit";
    /** Callback when a correction is submitted (view mode) */
    onCorrection?: (path: string, correction: string) => Promise<KBDocumentData | null>;
    /** Callback when a document is updated (edit mode) */
    onDocumentUpdate?: (path: string, updated: KBDocument) => void;
    /** Enable command palette search */
    enableSearch?: boolean;
    /** Header content for the tree pane */
    treeHeader?: React.ReactNode;
    /** Max height for the tree pane */
    treeMaxHeight?: string;
    /** Max height for the detail pane */
    detailMaxHeight?: string;
    className?: string;
}

export function KnowledgeExplorer({
    documents,
    selectedPath: controlledSelectedPath,
    onSelect: controlledOnSelect,
    newPaths = new Set(),
    mode = "view",
    onCorrection,
    onDocumentUpdate,
    enableSearch = false,
    treeHeader,
    treeMaxHeight = "calc(100vh - 20rem)",
    detailMaxHeight = "calc(100vh - 20rem)",
    className,
}: KnowledgeExplorerProps) {
    const isMobile = useMediaQuery("(max-width: 767px)");

    // Internal state for uncontrolled usage
    const [internalSelectedPath, setInternalSelectedPath] = useState<string | null>(
        null
    );

    // Use controlled or internal state
    // Note: Use !== undefined to properly handle controlled null (nothing selected)
    const isControlled = controlledSelectedPath !== undefined;
    const selectedPath = isControlled ? controlledSelectedPath : internalSelectedPath;
    const setSelectedPath = controlledOnSelect ?? setInternalSelectedPath;

    // Command palette state
    const [searchOpen, setSearchOpen] = useState(false);

    // Find selected document
    const selectedDocument = useMemo(
        () => documents.find((d) => d.path === selectedPath) ?? null,
        [documents, selectedPath]
    );

    // Convert documents to KBDocument format for KBContent (edit mode)
    const selectedKBDocument: KBDocument | null = useMemo(() => {
        if (!selectedDocument) return null;
        return {
            id: selectedDocument.id,
            path: selectedDocument.path,
            name: selectedDocument.name,
            content: selectedDocument.content,
            description: selectedDocument.description,
            promptLabel: null,
            editable: true,
            updatedAt:
                selectedDocument.updatedAt instanceof Date
                    ? selectedDocument.updatedAt
                    : new Date(selectedDocument.updatedAt ?? Date.now()),
        };
    }, [selectedDocument]);

    // Convert documents to folder structure for CommandPalette
    const { kbDocuments, folders } = useMemo(() => {
        const kbDocs: KBDocument[] = documents.map((d) => ({
            id: d.id,
            path: d.path,
            name: d.name,
            content: d.content,
            description: d.description,
            promptLabel: null,
            editable: true,
            updatedAt:
                d.updatedAt instanceof Date
                    ? d.updatedAt
                    : new Date(d.updatedAt ?? Date.now()),
        }));

        // Build simple folder structure for command palette
        const folderMap = new Map<string, KBFolder>();
        for (const doc of kbDocs) {
            const folderPath = doc.path.split(".").slice(0, -1).join(".");
            if (!folderMap.has(folderPath)) {
                folderMap.set(folderPath, {
                    id: folderPath,
                    name: folderPath.split(".").pop() ?? folderPath,
                    path: folderPath,
                    documents: [],
                    children: [],
                });
            }
            folderMap.get(folderPath)!.documents.push(doc);
        }

        return {
            kbDocuments: kbDocs,
            folders: Array.from(folderMap.values()),
        };
    }, [documents]);

    // Handle search result selection
    const handleSearchSelect = useCallback(
        (path: string) => {
            setSelectedPath(path);
            setSearchOpen(false);
        },
        [setSelectedPath]
    );

    // Mobile: show either tree or detail, not both
    const [mobileView, setMobileView] = useState<"tree" | "detail">("tree");

    // Switch to detail view when a document is selected on mobile
    useEffect(() => {
        if (isMobile && selectedPath) {
            setMobileView("detail");
        }
    }, [isMobile, selectedPath]);

    // Mobile back handler
    const handleMobileBack = useCallback(() => {
        setMobileView("tree");
        setSelectedPath(null);
    }, [setSelectedPath]);

    // Mobile layout
    if (isMobile) {
        return (
            <div className={cn("flex flex-col gap-4", className)}>
                {mobileView === "tree" ? (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-4">
                                {treeHeader ?? (
                                    <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                                        Knowledge Base
                                    </h3>
                                )}
                                <KnowledgeTree
                                    documents={documents}
                                    selectedPath={selectedPath}
                                    onSelect={setSelectedPath}
                                    newPaths={newPaths}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="overflow-hidden">
                        <CardContent className="p-4">
                            <button
                                onClick={handleMobileBack}
                                className="text-primary mb-4 text-sm font-medium"
                            >
                                ← Back to tree
                            </button>
                            {mode === "edit" &&
                            selectedKBDocument &&
                            onDocumentUpdate ? (
                                <KBContent
                                    document={selectedKBDocument}
                                    onUpdate={onDocumentUpdate}
                                />
                            ) : (
                                <KnowledgeDetail
                                    document={selectedDocument}
                                    mode={mode}
                                    onCorrection={onCorrection}
                                    onClose={handleMobileBack}
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                {enableSearch && (
                    <CommandPalette
                        open={searchOpen}
                        onOpenChange={setSearchOpen}
                        documents={kbDocuments}
                        folders={folders}
                        selectedPath={selectedPath}
                        onSelect={handleSearchSelect}
                    />
                )}
            </div>
        );
    }

    // Desktop: two-pane layout
    return (
        <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
            {/* Tree view */}
            <Card className="overflow-hidden" style={{ maxHeight: treeMaxHeight }}>
                <CardContent className="h-full overflow-y-auto p-0">
                    <div className="p-4">
                        {treeHeader ?? (
                            <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                                Knowledge Base
                            </h3>
                        )}
                        <KnowledgeTree
                            documents={documents}
                            selectedPath={selectedPath}
                            onSelect={setSelectedPath}
                            newPaths={newPaths}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Detail view */}
            <Card className="overflow-hidden" style={{ maxHeight: detailMaxHeight }}>
                <CardContent className="h-full overflow-y-auto p-4">
                    {mode === "edit" && selectedKBDocument && onDocumentUpdate ? (
                        <KBContent
                            document={selectedKBDocument}
                            onUpdate={onDocumentUpdate}
                            dimmed={searchOpen}
                        />
                    ) : (
                        <KnowledgeDetail
                            document={selectedDocument}
                            mode={mode}
                            onCorrection={onCorrection}
                            onClose={() => setSelectedPath(null)}
                        />
                    )}
                </CardContent>
            </Card>

            {enableSearch && (
                <CommandPalette
                    open={searchOpen}
                    onOpenChange={setSearchOpen}
                    documents={kbDocuments}
                    folders={folders}
                    selectedPath={selectedPath}
                    onSelect={handleSearchSelect}
                />
            )}
        </div>
    );
}
