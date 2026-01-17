"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    WarningCircleIcon,
    UserIcon,
    UsersIcon,
    BriefcaseIcon,
    LightbulbIcon,
    GearIcon,
    BrainIcon,
    MicrophoneIcon,
    XIcon,
    PencilSimpleIcon,
    CheckIcon,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import type { ExtractionStats } from "@/lib/import/extraction/types";
import type { PendingExtraction } from "@/lib/db/schema";

type ExtractionCategory =
    | "identity"
    | "preference"
    | "person"
    | "project"
    | "decision"
    | "expertise"
    | "voice";

const CATEGORY_CONFIG: Record<
    ExtractionCategory,
    { icon: React.ElementType; label: string; color: string }
> = {
    identity: {
        icon: UserIcon,
        label: "Identity",
        color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
    preference: {
        icon: GearIcon,
        label: "Preference",
        color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    person: {
        icon: UsersIcon,
        label: "Person",
        color: "bg-green-500/20 text-green-300 border-green-500/30",
    },
    project: {
        icon: BriefcaseIcon,
        label: "Project",
        color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    },
    decision: {
        icon: LightbulbIcon,
        label: "Decision",
        color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    },
    expertise: {
        icon: BrainIcon,
        label: "Expertise",
        color: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    },
    voice: {
        icon: MicrophoneIcon,
        label: "Voice",
        color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    },
};

interface DiscoveryProgressProps {
    jobId: string;
    totalConversations: number;
    onComplete: (stats: ExtractionStats) => void;
    onError?: (error: string) => void;
}

const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Phase 2: Discovery in progress
 *
 * Shows real-time progress as Carmenta reads through imported conversations
 * and discovers knowledge to extract. Displays a live preview of the KB
 * structure filling in as items are discovered.
 */
export function DiscoveryProgress({
    jobId,
    totalConversations,
    onComplete,
    onError,
}: DiscoveryProgressProps) {
    const [_stats, setStats] = useState<ExtractionStats | null>(null);
    const [processedCount, setProcessedCount] = useState(0);
    const [extractions, setExtractions] = useState<PendingExtraction[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [pollingError, setPollingError] = useState<string | null>(null);
    const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
    const consecutiveErrorsRef = useRef(0);
    const hasCalledComplete = useRef(false);

    const handleAction = useCallback(
        async (extractionId: string, action: "approve" | "reject") => {
            // Optimistic update - immediately remove from view
            setActionedIds((prev) => new Set(prev).add(extractionId));

            try {
                const response = await fetch("/api/import/extract/review", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        actions: [{ id: extractionId, action }],
                    }),
                });

                if (!response.ok) {
                    // Revert optimistic update on failure
                    setActionedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(extractionId);
                        return next;
                    });
                    toast.error("Failed to save your decision");
                    return;
                }

                const data = await response.json();
                if (data.errors?.length > 0) {
                    toast.error(data.errors[0]);
                }
            } catch (err) {
                // Revert optimistic update on error
                setActionedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(extractionId);
                    return next;
                });
                logger.error(
                    { error: err, extractionId },
                    "Failed to action extraction"
                );
                toast.error("Something went wrong");
            }
        },
        []
    );

    const pollProgress = useCallback(async () => {
        // Don't poll if already complete
        if (hasCalledComplete.current) return;

        try {
            // Fetch extractions with a higher limit for display
            const response = await fetch(
                `/api/import/extract?jobId=${jobId}&status=pending&limit=100`
            );

            if (!response.ok) {
                consecutiveErrorsRef.current++;
                logger.warn(
                    { jobId, status: response.status },
                    "Discovery poll returned non-OK"
                );
                if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
                    setPollingError(
                        "Having trouble checking progress. Discovery may still be running."
                    );
                }
                return;
            }

            // Reset error count on success
            consecutiveErrorsRef.current = 0;
            setPollingError(null);

            const data = await response.json();

            // Handle failed extraction jobs
            if (data.jobStatus === "failed") {
                hasCalledComplete.current = true;
                const errorMessage =
                    data.errorMessage ||
                    "Discovery failed. Some conversations may not have been processed.";

                // Call onError to let parent handle the error state with recovery options
                if (onError) {
                    onError(errorMessage);
                } else {
                    // Fallback: show error inline and allow user to proceed
                    setPollingError(errorMessage);
                    // Call onComplete with zero stats to allow user to continue
                    onComplete({
                        total: 0,
                        pending: 0,
                        approved: 0,
                        rejected: 0,
                        edited: 0,
                        byCategory: {
                            identity: 0,
                            person: 0,
                            project: 0,
                            preference: 0,
                            decision: 0,
                            expertise: 0,
                            voice: 0,
                        },
                    });
                }
                return;
            }

            if (data.stats) {
                setStats(data.stats);

                // Use job-specific progress when available, otherwise estimate from extraction count
                const processed = data.processedConversations ?? data.total ?? 0;
                setProcessedCount(Math.min(totalConversations, processed));

                // Check if job is complete
                // Guard against calling onComplete multiple times
                if (!hasCalledComplete.current && !data.hasUnprocessedImports) {
                    hasCalledComplete.current = true;
                    setIsComplete(true);
                    onComplete(data.stats);
                }
            }

            // Update extractions for live KB display
            if (data.extractions) {
                setExtractions(data.extractions);
            }
        } catch (err) {
            consecutiveErrorsRef.current++;
            logger.warn({ error: err, jobId }, "Discovery poll failed");

            if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
                setPollingError(
                    "Having trouble checking progress. Discovery may still be running."
                );
            }
        }
    }, [jobId, totalConversations, onComplete, onError]);

    useEffect(() => {
        // Initial poll on mount (via queueMicrotask to avoid synchronous setState in effect)
        // Then poll every 2 seconds
        queueMicrotask(pollProgress);
        const interval = setInterval(pollProgress, 2000);

        return () => {
            clearInterval(interval);
        };
    }, [pollProgress]);

    const progressPercent =
        totalConversations > 0
            ? Math.min(100, Math.round((processedCount / totalConversations) * 100))
            : 0;

    const feedRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    // Auto-scroll only if user is already near the bottom (not reviewing earlier items)
    useEffect(() => {
        if (extractions.length > prevCountRef.current && feedRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

            if (isNearBottom) {
                feedRef.current.scrollTo({
                    top: feedRef.current.scrollHeight,
                    behavior: "smooth",
                });
            }
        }
        prevCountRef.current = extractions.length;
    }, [extractions.length]);

    const hasExtractions = extractions.length > 0;
    const pendingExtractions = extractions.filter((e) => !actionedIds.has(e.id));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");

    const handleEdit = useCallback(
        async (extractionId: string) => {
            setActionedIds((prev) => new Set(prev).add(extractionId));
            setEditingId(null);

            try {
                const response = await fetch("/api/import/extract/review", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        actions: [
                            {
                                id: extractionId,
                                action: "edit",
                                editedContent: editContent,
                            },
                        ],
                    }),
                });

                if (!response.ok) {
                    setActionedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(extractionId);
                        return next;
                    });
                    toast.error("Failed to save edit");
                }
            } catch (err) {
                setActionedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(extractionId);
                    return next;
                });
                logger.error({ error: err, extractionId }, "Failed to edit extraction");
                toast.error("Something went wrong");
            }
        },
        [editContent]
    );

    return (
        <div className="space-y-6">
            {/* Header with progress */}
            <Card>
                <CardContent className="py-6">
                    <div className="flex items-center gap-4">
                        {!isComplete && <LoadingSpinner size={32} />}
                        <div className="flex-1">
                            <p className="text-lg font-medium">
                                {isComplete
                                    ? "Discovery complete"
                                    : "Analyzing your conversations..."}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {processedCount} of {totalConversations} conversations •{" "}
                                {extractions.length} discoveries
                                {actionedIds.size > 0 && (
                                    <> • {actionedIds.size} removed</>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Polling error warning */}
                    {pollingError && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
                            <WarningCircleIcon className="h-4 w-4" />
                            <span>{pollingError}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Live discovery feed */}
            <AnimatePresence>
                {hasExtractions && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card>
                            <CardContent className="p-0">
                                <div
                                    ref={feedRef}
                                    className="max-h-[60vh] overflow-y-auto"
                                >
                                    <div className="divide-y divide-white/5">
                                        <AnimatePresence mode="popLayout">
                                            {pendingExtractions.map(
                                                (extraction, index) => {
                                                    const config = CATEGORY_CONFIG[
                                                        extraction.category as ExtractionCategory
                                                    ] ?? {
                                                        icon: BrainIcon,
                                                        label: extraction.category,
                                                        color: "bg-gray-500/20 text-gray-300 border-gray-500/30",
                                                    };
                                                    const CategoryIcon = config.icon;

                                                    return (
                                                        <motion.div
                                                            key={extraction.id}
                                                            initial={{
                                                                opacity: 0,
                                                                x: -20,
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                                x: 0,
                                                            }}
                                                            exit={{ opacity: 0, x: 20 }}
                                                            transition={{
                                                                duration: 0.2,
                                                                delay: index * 0.02,
                                                            }}
                                                            className="flex items-start gap-3 p-4 hover:bg-white/5"
                                                        >
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "shrink-0 border",
                                                                    config.color
                                                                )}
                                                            >
                                                                <CategoryIcon className="mr-1 h-3 w-3" />
                                                                {config.label}
                                                            </Badge>
                                                            <div className="min-w-0 flex-1">
                                                                {editingId ===
                                                                extraction.id ? (
                                                                    <div className="space-y-2">
                                                                        <textarea
                                                                            value={
                                                                                editContent
                                                                            }
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                setEditContent(
                                                                                    e
                                                                                        .target
                                                                                        .value
                                                                                )
                                                                            }
                                                                            className="border-input bg-background min-h-[60px] w-full rounded-md border px-3 py-2 text-sm"
                                                                            autoFocus
                                                                        />
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    handleEdit(
                                                                                        extraction.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <CheckIcon className="mr-1 h-3 w-3" />
                                                                                Save
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={() =>
                                                                                    setEditingId(
                                                                                        null
                                                                                    )
                                                                                }
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <p className="text-sm font-medium">
                                                                            {
                                                                                extraction.summary
                                                                            }
                                                                        </p>
                                                                        {extraction.suggestedPath && (
                                                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                                                →{" "}
                                                                                {
                                                                                    extraction.suggestedPath
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                            {editingId !==
                                                                extraction.id && (
                                                                <div className="flex shrink-0 gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-muted-foreground hover:text-foreground h-7 w-7 hover:bg-white/10"
                                                                        onClick={() => {
                                                                            setEditingId(
                                                                                extraction.id
                                                                            );
                                                                            setEditContent(
                                                                                extraction.content
                                                                            );
                                                                        }}
                                                                        data-tooltip-id="tip"
                                                                        data-tooltip-content="Edit"
                                                                    >
                                                                        <PencilSimpleIcon className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                                                        onClick={() =>
                                                                            handleAction(
                                                                                extraction.id,
                                                                                "reject"
                                                                            )
                                                                        }
                                                                        data-tooltip-id="tip"
                                                                        data-tooltip-content="Don't keep this"
                                                                    >
                                                                        <XIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    );
                                                }
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <p className="text-muted-foreground text-center text-sm">
                Everything is kept by default. Click{" "}
                <XIcon className="inline h-3 w-3 text-red-400" /> to remove items you
                don&apos;t want.
            </p>
        </div>
    );
}
