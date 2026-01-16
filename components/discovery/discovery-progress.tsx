"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { KBSidebar } from "@/components/knowledge-viewer/kb-sidebar";
import { logger } from "@/lib/client-logger";
import { extractionsToFolders } from "@/lib/import/extraction/to-kb-structure";
import type { ExtractionStats } from "@/lib/import/extraction/types";
import type { PendingExtraction } from "@/lib/db/schema";

interface DiscoveryProgressProps {
    jobId: string;
    totalConversations: number;
    onComplete: (stats: ExtractionStats) => void;
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
}: DiscoveryProgressProps) {
    const [stats, setStats] = useState<ExtractionStats | null>(null);
    const [processedCount, setProcessedCount] = useState(0);
    const [extractions, setExtractions] = useState<PendingExtraction[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [pollingError, setPollingError] = useState<string | null>(null);
    const consecutiveErrorsRef = useRef(0);
    const hasCalledComplete = useRef(false);

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
                setPollingError(
                    data.errorMessage ||
                        "Discovery failed. Some conversations may not have been processed."
                );
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
    }, [jobId, totalConversations, onComplete]);

    useEffect(() => {
        // Initial poll on mount (via setTimeout to avoid synchronous setState in effect)
        // Then poll every 2 seconds
        const timeout = setTimeout(pollProgress, 0);
        const interval = setInterval(pollProgress, 2000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [pollProgress]);

    const progressPercent =
        totalConversations > 0
            ? Math.min(100, Math.round((processedCount / totalConversations) * 100))
            : 0;

    // Transform extractions to KB folder structure for display
    const kbFolders = useMemo(() => extractionsToFolders(extractions), [extractions]);

    const hasExtractions = extractions.length > 0;

    return (
        <Card>
            <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center text-center">
                    {!isComplete && <LoadingSpinner size={48} />}

                    <p className="mt-4 text-lg font-medium">
                        {isComplete
                            ? "Discovery complete"
                            : "Finding knowledge in your conversations..."}
                    </p>

                    {!isComplete && (
                        <p className="text-muted-foreground mt-1 text-sm">
                            Surfacing projects, people, preferences
                        </p>
                    )}

                    {/* Progress bar */}
                    <div className="mt-6 w-full max-w-md">
                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-muted-foreground mt-2 text-sm">
                            {processedCount} of {totalConversations} conversations
                        </p>
                    </div>

                    {/* Polling error warning */}
                    {pollingError && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
                            <WarningCircleIcon className="h-4 w-4" />
                            <span>{pollingError}</span>
                        </div>
                    )}

                    {/* Live KB Preview */}
                    {hasExtractions && (
                        <div className="border-foreground/10 mt-6 w-full max-w-md border-t pt-6">
                            <div className="bg-muted/30 max-h-80 overflow-y-auto rounded-xl">
                                <KBSidebar
                                    folders={kbFolders}
                                    selectedPath={null}
                                    onSelect={() => {}}
                                    dimmed={false}
                                    className="!glass-card !max-h-none !w-full !rounded-none bg-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Footer message */}
                    <p className="text-muted-foreground mt-6 text-sm">
                        This runs in the background.
                        <br />
                        You can keep using Carmenta.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
