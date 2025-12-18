"use client";

/**
 * Knowledge Base Content Pane
 *
 * Displays the selected document with view/edit toggle.
 * Edit mode uses explicit save (not auto-save for V1).
 */

import { useState, useCallback, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, Save, X, FileText, User, Settings, AlertCircle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { cn } from "@/lib/utils";
import { updateKBDocument, type KBDocument } from "@/lib/kb/actions";
import { logger } from "@/lib/client-logger";

// Map paths to icons
const PATH_ICONS: Record<string, typeof FileText> = {
    "profile.identity": User,
    "profile.instructions": Settings,
};

// Map paths to display titles
const PATH_TITLES: Record<string, string> = {
    "profile.identity": "Identity",
    "profile.instructions": "Custom Instructions",
};

export interface KBContentProps {
    document: KBDocument | null;
    onUpdate: (path: string, updated: KBDocument) => void;
    dimmed?: boolean;
}

export function KBContent({ document, onUpdate, dimmed = false }: KBContentProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState("");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Reset edit state when document changes
    useEffect(() => {
        // Only reset if we're currently editing to avoid unnecessary state updates
        if (isEditing) {
            setIsEditing(false);
        }
        setEditContent(document?.content ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only run when path changes
    }, [document?.path]);

    const handleEdit = useCallback(() => {
        setEditContent(document?.content ?? "");
        setIsEditing(true);
    }, [document?.content]);

    const handleCancel = useCallback(() => {
        setEditContent(document?.content ?? "");
        setIsEditing(false);
    }, [document?.content]);

    const handleSave = useCallback(() => {
        if (!document) return;

        setError(null);
        startTransition(async () => {
            try {
                const updated = await updateKBDocument(document.path, editContent);
                onUpdate(document.path, updated);
                setIsEditing(false);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Failed to save changes";
                setError(message);
                logger.error(
                    { error: err, path: document.path },
                    "Failed to save KB document"
                );
                Sentry.captureException(err, {
                    tags: { component: "kb-content", action: "save" },
                    extra: { path: document.path },
                });
            }
        });
    }, [document, editContent, onUpdate]);

    if (!document) {
        return (
            <main
                className={cn(
                    "glass-card flex flex-1 items-center justify-center rounded-xl transition-opacity duration-200",
                    dimmed && "opacity-30"
                )}
            >
                <p className="text-foreground/40">Select a document to view</p>
            </main>
        );
    }

    const Icon = PATH_ICONS[document.path] ?? FileText;
    const title = PATH_TITLES[document.path] ?? document.name.replace(".txt", "");

    return (
        <main
            className={cn(
                "glass-card flex flex-1 flex-col rounded-xl p-6 transition-opacity duration-200",
                dimmed && "opacity-30"
            )}
        >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-foreground/50" />
                    <h2 className="text-lg font-medium text-foreground">{title}</h2>
                </div>

                {/* Edit/Save/Cancel buttons */}
                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.div
                            key="editing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-2"
                        >
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-foreground/60 transition-colors hover:bg-foreground/5 disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                {isPending ? "Saving..." : "Save"}
                            </button>
                        </motion.div>
                    ) : (
                        <motion.button
                            key="view"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={handleEdit}
                            className="flex items-center gap-1.5 rounded-lg p-2 text-foreground/50 transition-colors hover:bg-foreground/5"
                        >
                            <Edit3 className="h-4 w-4" />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Error message */}
            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto rounded p-1 hover:bg-red-500/10"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.textarea
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="h-full min-h-[300px] w-full resize-none rounded-lg bg-foreground/5 p-4 text-sm leading-relaxed text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            autoFocus
                        />
                    ) : (
                        <motion.pre
                            key="view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/80"
                        >
                            {document.content}
                        </motion.pre>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
