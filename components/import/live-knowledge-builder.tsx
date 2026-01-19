"use client";

/**
 * Live Knowledge Builder
 *
 * Shows the knowledge base being built in real-time during import.
 * Users can provide guidance and corrections as items stream in.
 *
 * Uses the shared KnowledgeExplorer for visualization with live polling
 * for document updates.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SimpleComposer } from "@/components/chat";
import { KnowledgeExplorer, type KBDocumentData } from "@/components/kb";
import { logger } from "@/lib/client-logger";
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
    const [newPaths, setNewPaths] = useState<Set<string>>(new Set());
    const [currentProcessed, setCurrentProcessed] = useState(0);
    const [jobStatus, setJobStatus] = useState<string>("running");
    const lastPollTime = useRef<string>(new Date().toISOString());
    const seenPaths = useRef<Set<string>>(new Set());

    // Poll for job status
    useEffect(() => {
        if (jobStatus === "completed" || jobStatus === "failed") return;

        const abortController = new AbortController();

        const pollJobStatus = async () => {
            try {
                const response = await fetch(`/api/import/job/${jobId}/status`, {
                    signal: abortController.signal,
                });
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
                if (err instanceof Error && err.name === "AbortError") return;
                logger.warn({ error: err, jobId }, "Job status poll failed");
            }
        };

        pollJobStatus();
        const interval = setInterval(pollJobStatus, 2000);
        return () => {
            clearInterval(interval);
            abortController.abort();
        };
    }, [jobId, jobStatus, onComplete, onError]);

    // Poll for KB changes
    useEffect(() => {
        const abortController = new AbortController();

        const poll = async () => {
            try {
                const response = await fetch(
                    `/api/kb/documents?since=${encodeURIComponent(lastPollTime.current)}`,
                    { signal: abortController.signal }
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
                }
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                logger.warn({ error: err }, "KB documents poll failed");
            }
        };

        // Initial fetch of all docs
        const fetchAll = async () => {
            try {
                const response = await fetch("/api/kb/documents", {
                    signal: abortController.signal,
                });
                if (!response.ok) return;

                const data = await response.json();
                if (data.documents.length > 0) {
                    // Mark initial documents as new to trigger folder expansion
                    const initialPaths = new Set<string>();
                    data.documents.forEach((d: KBDocument) => {
                        if (!seenPaths.current.has(d.path)) {
                            initialPaths.add(d.path);
                            seenPaths.current.add(d.path);
                        }
                    });
                    setNewPaths(initialPaths);
                    setDocuments(data.documents);

                    // Clear new status after animation
                    setTimeout(() => setNewPaths(new Set()), 2000);
                }
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                logger.warn({ error: err }, "Initial KB documents fetch failed");
            }
        };

        fetchAll();
        const interval = setInterval(poll, 1500);
        return () => {
            clearInterval(interval);
            abortController.abort();
        };
    }, []);

    // Fetch guidance on mount
    useEffect(() => {
        const abortController = new AbortController();

        const fetchGuidance = async () => {
            try {
                const response = await fetch(`/api/import/job/${jobId}/guidance`, {
                    signal: abortController.signal,
                });
                if (response.ok) {
                    const data = await response.json();
                    setGuidance(data.guidance);
                }
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                logger.warn({ error: err, jobId }, "Guidance fetch failed");
            }
        };
        fetchGuidance();

        return () => abortController.abort();
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

    // Handle correction submission from KnowledgeExplorer
    // Empty deps array is safe - setDocuments uses functional update pattern
    const handleCorrection = useCallback(
        async (
            path: string,
            correctionText: string
        ): Promise<KBDocumentData | null> => {
            try {
                const response = await fetch("/api/kb/correct", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        path,
                        correction: correctionText,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    // Update the document in our local state
                    if (data.document) {
                        setDocuments((prev) =>
                            prev.map((d) => (d.path === path ? data.document : d))
                        );
                        return data.document as KBDocumentData;
                    }
                }
                return null;
            } catch {
                return null;
            }
        },
        []
    );

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
                                            <X className="h-3 w-3" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KB Explorer - unified tree and detail view */}
            <KnowledgeExplorer
                documents={documents as KBDocumentData[]}
                newPaths={newPaths}
                mode="view"
                onCorrection={handleCorrection}
                treeMaxHeight="60vh"
                detailMaxHeight="60vh"
            />

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
