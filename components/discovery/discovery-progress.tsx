"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowRightIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { logger } from "@/lib/client-logger";
import type { ExtractionStats } from "@/lib/import/extraction/types";

interface DiscoveryProgressProps {
    jobId: string;
    totalConversations: number;
    onComplete: (stats: ExtractionStats) => void;
    onContinue: () => void;
}

const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Phase 2: Discovery in progress
 *
 * Shows real-time progress as Carmenta reads through imported conversations
 * and discovers knowledge to extract.
 */
export function DiscoveryProgress({
    jobId,
    totalConversations,
    onComplete,
    onContinue,
}: DiscoveryProgressProps) {
    const [stats, setStats] = useState<ExtractionStats | null>(null);
    const [processedCount, setProcessedCount] = useState(0);
    const [latestFinding, setLatestFinding] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [pollingError, setPollingError] = useState<string | null>(null);
    const consecutiveErrorsRef = useRef(0);
    const hasCalledComplete = useRef(false);

    const pollProgress = useCallback(async () => {
        // Don't poll if already complete
        if (hasCalledComplete.current) return;

        try {
            const response = await fetch(`/api/import/extract?jobId=${jobId}`);

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

            if (data.stats) {
                setStats(data.stats);

                // Total extractions count is at root level, not in stats
                const totalExtracted = data.total || 0;
                setProcessedCount(Math.min(totalConversations, totalExtracted));

                // Check if job is complete (no more unprocessed imports)
                // Guard against calling onComplete multiple times
                if (!hasCalledComplete.current && !data.hasUnprocessedImports) {
                    hasCalledComplete.current = true;
                    setIsComplete(true);
                    onComplete(data.stats);
                }
            }

            // Show latest finding if available
            if (data.extractions?.length > 0) {
                const latest = data.extractions[0];
                setLatestFinding(latest.content);
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

    const categoryStats = stats?.byCategory || {
        project: 0,
        person: 0,
        preference: 0,
        decision: 0,
        identity: 0,
        expertise: 0,
    };

    return (
        <Card>
            <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                    {!isComplete && <LoadingSpinner size={48} />}

                    <p className="mt-4 text-lg font-medium">
                        {isComplete
                            ? "Discovery complete"
                            : "Finding knowledge in your conversations..."}
                    </p>

                    {!isComplete && (
                        <p className="text-muted-foreground mt-1 text-sm">
                            Surfacing projects, people, preferences, and decisions
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

                    {/* Latest finding */}
                    {latestFinding && (
                        <div className="bg-muted/50 mt-6 max-w-md rounded-lg p-4">
                            <p className="text-muted-foreground text-sm">Just found:</p>
                            <p className="mt-1 line-clamp-2 text-sm">{latestFinding}</p>
                        </div>
                    )}

                    {/* Category counts */}
                    {stats && stats.total > 0 && (
                        <div className="mt-6">
                            <p className="text-muted-foreground mb-2 text-sm">
                                Found so far:
                            </p>
                            <div className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                                {categoryStats.project > 0 && (
                                    <span>{categoryStats.project} projects</span>
                                )}
                                {categoryStats.person > 0 && (
                                    <span>{categoryStats.person} people</span>
                                )}
                                {categoryStats.preference > 0 && (
                                    <span>{categoryStats.preference} preferences</span>
                                )}
                                {categoryStats.decision > 0 && (
                                    <span>{categoryStats.decision} decisions</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Continue button */}
                    <div className="mt-8 border-t pt-6">
                        <p className="text-muted-foreground mb-4 text-sm">
                            This runs in the background. You can keep using Carmenta.
                        </p>
                        <Button
                            variant="outline"
                            onClick={onContinue}
                            className="gap-2"
                        >
                            Continue to Carmenta
                            <ArrowRightIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
