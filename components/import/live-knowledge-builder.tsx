"use client";

/**
 * Live Knowledge Builder
 *
 * Shows the knowledge base being built in real-time during import.
 * Users can provide guidance and corrections as items stream in.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    XIcon,
    FolderIcon,
    FolderOpenIcon,
    FileTextIcon,
    CheckIcon,
    CaretRightIcon,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { SimpleComposer } from "@/components/chat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface KBDocument {
    id: string;
    path: string;
    name: string;
    content: string;
    description: string | null;
    sourceType: string;
    createdAt: string;
    updatedAt: string;
}

interface LiveKnowledgeBuilderProps {
    jobId: string;
    totalConversations: number;
    onComplete?: () => void;
    onError?: (message: string) => void;
}

/**
 * Tree node structure (after conversion to arrays)
 */
interface TreeNode {
    name: string;
    path: string;
    isFolder: boolean;
    children: TreeNode[];
    document?: KBDocument;
}

/**
 * Intermediate tree structure (during building with Record keys)
 */
interface BuildingNode {
    name: string;
    path: string;
    isFolder: boolean;
    children: Record<string, BuildingNode>;
    document?: KBDocument;
}

/**
 * Build a tree structure from flat document list
 */
function buildTree(docs: KBDocument[]): TreeNode[] {
    const root: Record<string, BuildingNode> = {};

    for (const doc of docs) {
        const parts = doc.path.split(".");
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const pathSoFar = parts.slice(0, i + 1).join(".");

            if (!current[part]) {
                current[part] = {
                    name: part,
                    path: pathSoFar,
                    isFolder: !isLast,
                    children: {},
                    document: isLast ? doc : undefined,
                };
            }

            if (isLast) {
                current[part].document = doc;
                // Only mark as non-folder if there are no children
                const hasChildren = Object.keys(current[part].children).length > 0;
                current[part].isFolder = hasChildren;
            }

            current = current[part].children;
        }
    }

    // Convert to array and sort
    function toArray(nodes: Record<string, BuildingNode>): TreeNode[] {
        return Object.values(nodes)
            .map((node) => ({
                name: node.name,
                path: node.path,
                isFolder: node.isFolder,
                document: node.document,
                children: toArray(node.children),
            }))
            .sort((a, b) => {
                // Folders first, then alphabetically
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });
    }

    return toArray(root);
}

export function LiveKnowledgeBuilder({
    jobId,
    totalConversations,
    onComplete,
    onError,
}: LiveKnowledgeBuilderProps) {
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [guidance, setGuidance] = useState<string[]>([]);
    const [newGuidance, setNewGuidance] = useState("");
    const [isAddingGuidance, setIsAddingGuidance] = useState(false);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [correction, setCorrection] = useState("");
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
        new Set(["Profile", "Knowledge"])
    );
    const [newPaths, setNewPaths] = useState<Set<string>>(new Set());
    const [currentProcessed, setCurrentProcessed] = useState(0);
    const [jobStatus, setJobStatus] = useState<string>("running");
    const lastPollTime = useRef<string>(new Date().toISOString());
    const seenPaths = useRef<Set<string>>(new Set());

    // Poll for job status
    useEffect(() => {
        if (jobStatus === "completed" || jobStatus === "failed") return;

        const pollJobStatus = async () => {
            try {
                const response = await fetch(`/api/import/job/${jobId}/status`);
                if (!response.ok) return;

                const data = await response.json();
                setCurrentProcessed(data.processedConversations ?? 0);
                setJobStatus(data.status);

                if (data.status === "completed") {
                    onComplete?.();
                } else if (data.status === "failed") {
                    const errorMsg =
                        data.errorMessage || "Import job failed unexpectedly";
                    onError?.(errorMsg);
                }
            } catch (err) {
                // Ignore polling errors
            }
        };

        pollJobStatus();
        const interval = setInterval(pollJobStatus, 2000);
        return () => clearInterval(interval);
    }, [jobId, jobStatus, onComplete]);

    // Poll for KB changes
    useEffect(() => {
        const poll = async () => {
            try {
                const response = await fetch(
                    `/api/kb/documents?since=${encodeURIComponent(lastPollTime.current)}`
                );
                if (!response.ok) return;

                const data = await response.json();
                lastPollTime.current = data.timestamp;

                if (data.documents.length > 0) {
                    // Track new paths for animation
                    const newPathsSet = new Set<string>();
                    for (const doc of data.documents) {
                        if (!seenPaths.current.has(doc.path)) {
                            newPathsSet.add(doc.path);
                            seenPaths.current.add(doc.path);
                        }
                    }
                    setNewPaths(newPathsSet);

                    // Clear new status after animation
                    setTimeout(() => setNewPaths(new Set()), 2000);

                    // Merge with existing docs
                    setDocuments((prev) => {
                        const byPath = new Map(prev.map((d) => [d.path, d]));
                        for (const doc of data.documents) {
                            byPath.set(doc.path, doc);
                        }
                        return Array.from(byPath.values()).sort((a, b) =>
                            a.path.localeCompare(b.path)
                        );
                    });

                    // Auto-expand parent folders of new items
                    for (const doc of data.documents) {
                        const parts = doc.path.split(".");
                        for (let i = 1; i < parts.length; i++) {
                            setExpandedPaths((prev) =>
                                new Set(prev).add(parts.slice(0, i).join("."))
                            );
                        }
                    }
                }
            } catch (err) {
                // Ignore polling errors
            }
        };

        // Initial fetch of all docs
        const fetchAll = async () => {
            try {
                const response = await fetch("/api/kb/documents");
                if (!response.ok) return;

                const data = await response.json();
                setDocuments(data.documents);
                data.documents.forEach((d: KBDocument) =>
                    seenPaths.current.add(d.path)
                );
            } catch (err) {
                // Ignore
            }
        };

        fetchAll();
        const interval = setInterval(poll, 1500);
        return () => clearInterval(interval);
    }, []);

    // Fetch guidance on mount
    useEffect(() => {
        const fetchGuidance = async () => {
            try {
                const response = await fetch(`/api/import/job/${jobId}/guidance`);
                if (response.ok) {
                    const data = await response.json();
                    setGuidance(data.guidance);
                }
            } catch (err) {
                // Ignore
            }
        };
        fetchGuidance();
    }, [jobId]);

    const addGuidance = useCallback(async () => {
        if (!newGuidance.trim() || isAddingGuidance) return;

        setIsAddingGuidance(true);
        try {
            const response = await fetch(`/api/import/job/${jobId}/guidance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note: newGuidance.trim() }),
            });

            if (response.ok) {
                const data = await response.json();
                setGuidance(data.guidance);
                setNewGuidance("");
                toast.success("Guidance added");
            } else {
                toast.error("Failed to add guidance");
            }
        } catch (err) {
            toast.error("Something went wrong");
        } finally {
            setIsAddingGuidance(false);
        }
    }, [jobId, newGuidance, isAddingGuidance]);

    const removeGuidance = useCallback(
        async (index: number) => {
            try {
                const response = await fetch(`/api/import/job/${jobId}/guidance`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ index }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setGuidance(data.guidance);
                }
            } catch (err) {
                toast.error("Failed to remove guidance");
            }
        },
        [jobId]
    );

    const submitCorrection = useCallback(async () => {
        if (!selectedPath || !correction.trim() || isSubmittingCorrection) return;

        setIsSubmittingCorrection(true);
        try {
            const response = await fetch("/api/kb/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: selectedPath,
                    correction: correction.trim(),
                }),
            });

            if (response.ok) {
                const data = await response.json();
                // Update the document in our local state
                if (data.document) {
                    setDocuments((prev) =>
                        prev.map((d) => (d.path === selectedPath ? data.document : d))
                    );
                }
                setCorrection("");
                setSelectedPath(null);
                toast.success("Correction applied");
            } else {
                toast.error("Failed to apply correction");
            }
        } catch (err) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmittingCorrection(false);
        }
    }, [selectedPath, correction, isSubmittingCorrection]);

    const toggleExpanded = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const tree = buildTree(documents);
    const selectedDoc = documents.find((d) => d.path === selectedPath);

    const progressPercent =
        totalConversations > 0
            ? Math.min(100, Math.round((currentProcessed / totalConversations) * 100))
            : 0;

    return (
        <div className="space-y-4">
            {/* Progress header */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                        {currentProcessed < totalConversations && (
                            <LoadingSpinner size={24} />
                        )}
                        <div className="flex-1">
                            <p className="font-medium">
                                {currentProcessed < totalConversations
                                    ? "Building your knowledge base..."
                                    : "Knowledge base complete"}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {currentProcessed} of {totalConversations} conversations
                                • {documents.length} documents
                            </p>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <motion.div
                                className="bg-primary h-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Global guidance bar */}
            <Card className="overflow-visible">
                <CardContent className="overflow-visible py-4">
                    <div className="space-y-3">
                        <SimpleComposer
                            value={newGuidance}
                            onChange={setNewGuidance}
                            onSubmit={addGuidance}
                            isLoading={isAddingGuidance}
                            placeholder="Tell the librarian... (e.g., 'I moved to Austin in 2024')"
                        />

                        {guidance.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {guidance.map((note, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-primary/10 text-primary flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                                    >
                                        <span className="max-w-[300px] truncate">
                                            {note}
                                        </span>
                                        <button
                                            onClick={() => removeGuidance(index)}
                                            className="hover:bg-primary/20 rounded-full p-0.5"
                                        >
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KB Tree and Detail view */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Tree view */}
                <Card className="max-h-[60vh] overflow-hidden">
                    <CardContent className="h-full overflow-y-auto p-0">
                        <div className="p-4">
                            <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                                Knowledge Base
                            </h3>
                            {tree.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center text-sm">
                                    Waiting for documents to appear...
                                </p>
                            ) : (
                                <div className="space-y-0.5">
                                    {tree.map((node) => (
                                        <TreeNodeComponent
                                            key={node.path}
                                            node={node}
                                            depth={0}
                                            expandedPaths={expandedPaths}
                                            selectedPath={selectedPath}
                                            newPaths={newPaths}
                                            onToggle={toggleExpanded}
                                            onSelect={setSelectedPath}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Detail/correction view */}
                <Card className="max-h-[60vh] overflow-hidden">
                    <CardContent className="h-full overflow-y-auto p-4">
                        {selectedDoc ? (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-medium">{selectedDoc.name}</h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setSelectedPath(null)}
                                    >
                                        <XIcon className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="bg-muted/50 prose prose-sm dark:prose-invert max-w-none rounded-md p-3 text-sm">
                                    <MarkdownRenderer content={selectedDoc.content} />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                        Correction
                                    </label>
                                    <textarea
                                        value={correction}
                                        onChange={(e) => setCorrection(e.target.value)}
                                        placeholder="What should be different? (e.g., 'I actually have 26 years experience, not 25')"
                                        className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={submitCorrection}
                                            disabled={
                                                !correction.trim() ||
                                                isSubmittingCorrection
                                            }
                                        >
                                            {isSubmittingCorrection ? (
                                                <LoadingSpinner
                                                    size={14}
                                                    className="mr-2"
                                                />
                                            ) : (
                                                <CheckIcon className="mr-2 h-4 w-4" />
                                            )}
                                            Apply Correction
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setCorrection("");
                                                setSelectedPath(null);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
                                <p>
                                    Select a document to view details
                                    <br />
                                    and provide corrections
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Footer */}
            <p className="text-muted-foreground text-center text-sm">
                The librarian is reading your conversations and building your knowledge
                base.
                <br />
                Add guidance above to steer what gets captured.
            </p>
        </div>
    );
}

interface TreeNodeComponentProps {
    node: TreeNode;
    depth: number;
    expandedPaths: Set<string>;
    selectedPath: string | null;
    newPaths: Set<string>;
    onToggle: (path: string) => void;
    onSelect: (path: string | null) => void;
}

function TreeNodeComponent({
    node,
    depth,
    expandedPaths,
    selectedPath,
    newPaths,
    onToggle,
    onSelect,
}: TreeNodeComponentProps) {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const isNew = newPaths.has(node.path);
    const hasChildren = node.children.length > 0;

    return (
        <div>
            <motion.div
                initial={
                    isNew
                        ? {
                              opacity: 0,
                              x: -10,
                              backgroundColor: "rgba(var(--primary), 0.2)",
                          }
                        : false
                }
                animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
                transition={{ duration: 0.3 }}
                className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                    isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    isNew && "ring-primary/50 ring-2"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => {
                    if (node.isFolder && hasChildren) {
                        onToggle(node.path);
                    } else if (node.document) {
                        onSelect(isSelected ? null : node.path);
                    }
                }}
            >
                {node.isFolder ? (
                    <>
                        <CaretRightIcon
                            className={cn(
                                "h-3 w-3 transition-transform",
                                isExpanded && "rotate-90"
                            )}
                        />
                        {isExpanded ? (
                            <FolderOpenIcon className="h-4 w-4 text-amber-500" />
                        ) : (
                            <FolderIcon className="h-4 w-4 text-amber-500" />
                        )}
                    </>
                ) : (
                    <>
                        <span className="w-3" />
                        <FileTextIcon className="text-muted-foreground h-4 w-4" />
                    </>
                )}
                <span className="truncate">{node.name}</span>
                {isNew && (
                    <span className="bg-primary/20 text-primary ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
                        NEW
                    </span>
                )}
            </motion.div>

            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {node.children.map((child) => (
                            <TreeNodeComponent
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                expandedPaths={expandedPaths}
                                selectedPath={selectedPath}
                                newPaths={newPaths}
                                onToggle={onToggle}
                                onSelect={onSelect}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
