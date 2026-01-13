"use client";

/**
 * Knowledge Base Page Content
 *
 * Renders the KB with:
 * 1. Prominent "About You" section at top (AI-enhanced, user-editable)
 * 2. Memories section below (folder-based knowledge browser)
 */

import { useCallback, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    SparkleIcon,
    User,
    Brain,
    Check,
    CircleNotch,
    Warning,
} from "@phosphor-icons/react";

import { KnowledgeViewer } from "./index";
import { CarmentaSheet, CarmentaToggle } from "@/components/carmenta-assistant";
import { updateKBDocument, type KBDocument, type KBFolder } from "@/lib/kb/actions";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { analytics } from "@/lib/analytics/events";

interface KBPageContentProps {
    /** The profile.identity document for prominent About You display */
    identityDocument: KBDocument | null;
    /** Folders for the Memories section */
    memoriesFolders: KBFolder[];
}

export function KBPageContent({
    identityDocument,
    memoriesFolders,
}: KBPageContentProps) {
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);

    // About You editing state
    const [aboutContent, setAboutContent] = useState(identityDocument?.content ?? "");
    const [aboutSaveState, setAboutSaveState] = useState<
        "idle" | "saving" | "saved" | "error"
    >("idle");
    const [_isPending, startTransition] = useTransition();
    const hasAboutChanges = aboutContent !== (identityDocument?.content ?? "");
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Sync local state when identity document changes (e.g., after Carmenta updates)
    // This prevents stale state after router.refresh() from Carmenta sheet updates
    useEffect(() => {
        // Only sync if we're not currently editing or saving
        if (aboutSaveState === "idle" && !hasAboutChanges) {
            // Use queueMicrotask to avoid cascading renders
            queueMicrotask(() => {
                setAboutContent(identityDocument?.content ?? "");
            });
        }
    }, [identityDocument?.content, aboutSaveState, hasAboutChanges]);

    // Refresh the page when Carmenta makes changes
    const handleChangesComplete = useCallback(() => {
        router.refresh();
    }, [router]);

    // Save About You content
    const handleAboutSave = useCallback(() => {
        if (!identityDocument || !hasAboutChanges) return;

        setAboutSaveState("saving");
        startTransition(async () => {
            try {
                await updateKBDocument(identityDocument.path, aboutContent);
                setAboutSaveState("saved");
                analytics.kb.documentSaved({
                    path: identityDocument.path,
                    documentName: identityDocument.name,
                    section: "profile",
                    contentLength: aboutContent.length,
                    durationMs: 0,
                });

                // Clear any existing timeout to prevent stale closure issues
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setAboutSaveState("idle"), 2000);
            } catch (err) {
                logger.error({ error: err }, "Failed to save About You");
                setAboutSaveState("error");

                // Clear error state after 3 seconds
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setAboutSaveState("idle"), 3000);
            }
        });
    }, [identityDocument, aboutContent, hasAboutChanges]);

    // Keyboard shortcut for save
    const handleAboutKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleAboutSave();
            }
        },
        [handleAboutSave]
    );

    return (
        <>
            {/* Header with Carmenta button */}
            <div className="mb-4 flex items-center justify-end">
                <CarmentaToggle
                    isOpen={sheetOpen}
                    onClick={() => setSheetOpen(!sheetOpen)}
                />
            </div>

            <div className="flex flex-col gap-6">
                {/* About You Section - Prominent at top */}
                {identityDocument && (
                    <section className="glass-card overflow-hidden rounded-xl">
                        <header className="border-foreground/5 flex items-center justify-between border-b px-6 py-4">
                            <div className="flex items-center gap-3">
                                <User className="text-primary h-5 w-5" />
                                <div>
                                    <h2 className="text-foreground text-lg font-medium">
                                        About You
                                    </h2>
                                    <p className="text-foreground/50 flex items-center gap-1.5 text-sm">
                                        <SparkleIcon className="h-3.5 w-3.5" />
                                        <span>AI-enhanced from our conversations</span>
                                    </p>
                                </div>
                            </div>

                            {/* Save indicator */}
                            <div className="flex items-center gap-2">
                                {hasAboutChanges && aboutSaveState === "idle" && (
                                    <button
                                        onClick={handleAboutSave}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                                    >
                                        Save
                                    </button>
                                )}
                                {aboutSaveState === "saving" && (
                                    <span className="text-foreground/50 flex items-center gap-1.5 text-sm">
                                        <CircleNotch className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </span>
                                )}
                                {aboutSaveState === "saved" && (
                                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                                        <Check className="h-4 w-4" />
                                        Saved
                                    </span>
                                )}
                                {aboutSaveState === "error" && (
                                    <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                                        <Warning className="h-4 w-4" />
                                        Failed to save
                                    </span>
                                )}
                            </div>
                        </header>

                        <div className="p-4">
                            <textarea
                                value={aboutContent}
                                onChange={(e) => setAboutContent(e.target.value)}
                                onKeyDown={handleAboutKeyDown}
                                placeholder="Tell us about yourself—your role, interests, and what you're working on. We'll learn more as we chat."
                                className={cn(
                                    "min-h-[120px] w-full resize-none rounded-xl px-5 py-4",
                                    "text-foreground/80 font-sans text-[15px] leading-[1.7]",
                                    "placeholder:text-foreground/30 placeholder:italic",
                                    "focus:outline-none",
                                    "transition-all duration-200",
                                    "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                                    "border-foreground/8 focus:border-foreground/35 border"
                                )}
                            />
                        </div>
                    </section>
                )}

                {/* Memories Section */}
                <section className="min-h-[400px] flex-1">
                    <div className="mb-3 flex items-center gap-2">
                        <Brain className="text-foreground/50 h-4 w-4" />
                        <h2 className="text-foreground/70 text-sm font-medium">
                            Memories
                        </h2>
                        <span className="text-foreground/40 text-sm">
                            What we've learned together
                        </span>
                    </div>

                    {memoriesFolders.length === 0 ? (
                        <div className="glass-panel flex h-full flex-col items-center justify-center py-16 text-center">
                            <SparkleIcon className="text-foreground/30 mb-4 h-12 w-12" />
                            <h3 className="text-foreground/80 text-lg font-medium">
                                No memories yet
                            </h3>
                            <p className="text-foreground/60 mt-2 max-w-sm text-sm">
                                As we chat, we'll remember important details about your
                                projects, preferences, and the people in your work.
                            </p>
                        </div>
                    ) : (
                        <KnowledgeViewer initialFolders={memoriesFolders} />
                    )}
                </section>
            </div>

            {/* Carmenta Sheet */}
            <CarmentaSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                pageContext="We're in the knowledge base. The user can reorganize folders, rename documents, create new categories, or ask me to extract insights from their conversations."
                onChangesComplete={handleChangesComplete}
                description="Shaping what we know"
            />
        </>
    );
}
