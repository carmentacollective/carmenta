"use client";

/**
 * Import Review Page
 *
 * Shows the knowledge base being built in real-time during import.
 * Users can provide guidance and corrections as items stream in.
 */

import { useState, useEffect, useCallback } from "react";
import {
    BrainIcon,
    ArrowLeftIcon,
    SpinnerGapIcon,
    CheckCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { toast } from "sonner";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { LiveKnowledgeBuilder } from "@/components/import/live-knowledge-builder";
import { logger } from "@/lib/client-logger";

interface ImportJobStatus {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed";
    totalConversations: number;
    processedConversations: number;
    error?: string;
}

/**
 * Import review page - now shows real-time KB building
 */
export default function ImportReviewPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [activeJob, setActiveJob] = useState<ImportJobStatus | null>(null);
    const [hasUnprocessed, setHasUnprocessed] = useState(false);

    // Check for active job or unprocessed imports
    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/import/status");
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();

            if (data.activeJob) {
                setActiveJob(data.activeJob);
            }
            setHasUnprocessed(data.hasUnprocessedImports || false);
        } catch (error) {
            logger.error({ error }, "Failed to check import status");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    // Poll for job status when we have an active job
    useEffect(() => {
        if (
            !activeJob ||
            activeJob.status === "completed" ||
            activeJob.status === "failed"
        ) {
            return;
        }

        const poll = async () => {
            try {
                const res = await fetch(`/api/import/job/${activeJob.jobId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    setActiveJob((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  status: data.status,
                                  processedConversations: data.processedConversations,
                              }
                            : null
                    );
                }
            } catch (err) {
                // Ignore polling errors
            }
        };

        const interval = setInterval(poll, 2000);
        return () => clearInterval(interval);
    }, [activeJob?.jobId, activeJob?.status]);

    // Start the import job
    const startImport = async () => {
        setStarting(true);
        try {
            const res = await fetch("/api/import/extract", { method: "POST" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to start import");
            }
            const data = await res.json();
            if (data.jobId) {
                setActiveJob({
                    jobId: data.jobId,
                    status: "running",
                    totalConversations: data.conversationCount || 0,
                    processedConversations: 0,
                });
            }
        } catch (error) {
            logger.error({ error }, "Failed to start import");
            toast.error("Failed to start import", {
                description: "Please try again",
            });
        } finally {
            setStarting(false);
        }
    };

    // Handle job completion
    const handleComplete = useCallback(() => {
        setActiveJob((prev) => (prev ? { ...prev, status: "completed" } : null));
        toast.success("Knowledge base updated", {
            description: "Your imported conversations have been processed",
        });
    }, []);

    if (isLoading) {
        return (
            <StandardPageLayout>
                <div className="flex items-center justify-center py-12">
                    <SpinnerGapIcon className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
            </StandardPageLayout>
        );
    }

    // Show completion state
    if (activeJob?.status === "completed") {
        return (
            <StandardPageLayout>
                <Card className="mx-auto max-w-lg">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <CheckCircleIcon className="h-8 w-8 text-green-500" />
                            <div>
                                <CardTitle>Import Complete</CardTitle>
                                <CardDescription>
                                    Processed {activeJob.processedConversations}{" "}
                                    conversations
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            Your knowledge base has been updated with insights from your
                            imported conversations. You can view and edit your knowledge
                            in the KB section.
                        </p>
                        <div className="flex gap-2">
                            <Button asChild>
                                <Link href="/kb">View Knowledge Base</Link>
                            </Button>
                            {hasUnprocessed && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setActiveJob(null);
                                        checkStatus();
                                    }}
                                >
                                    <BrainIcon className="mr-2 h-4 w-4" />
                                    Process More
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </StandardPageLayout>
        );
    }

    // Show failure state
    if (activeJob?.status === "failed") {
        return (
            <StandardPageLayout>
                <Card className="mx-auto max-w-lg">
                    <CardHeader>
                        <CardTitle className="text-red-500">Import Failed</CardTitle>
                        <CardDescription>
                            {activeJob.error ||
                                "Something went wrong during the import"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => {
                                setActiveJob(null);
                                checkStatus();
                            }}
                        >
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </StandardPageLayout>
        );
    }

    // Active job - show the live knowledge builder
    if (
        activeJob &&
        (activeJob.status === "running" || activeJob.status === "pending")
    ) {
        return (
            <StandardPageLayout>
                <div className="mx-auto max-w-5xl">
                    <LiveKnowledgeBuilder
                        jobId={activeJob.jobId}
                        totalConversations={activeJob.totalConversations}
                        onComplete={handleComplete}
                    />
                </div>
            </StandardPageLayout>
        );
    }

    // No active job and no unprocessed imports
    if (!hasUnprocessed) {
        return (
            <StandardPageLayout>
                <Card className="mx-auto max-w-lg">
                    <CardHeader>
                        <CardTitle>Nothing to Process</CardTitle>
                        <CardDescription>
                            Import some conversations first, then we can build your
                            knowledge base.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/import">
                                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                                Import Conversations
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </StandardPageLayout>
        );
    }

    // Has unprocessed imports - offer to start
    return (
        <StandardPageLayout>
            <Card className="mx-auto max-w-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BrainIcon className="h-5 w-5" />
                        Ready to Learn
                    </CardTitle>
                    <CardDescription>
                        You have imported conversations we haven't analyzed yet. We'll
                        build your knowledge base in real-time - you can watch and
                        provide guidance as we go.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={startImport} disabled={starting}>
                        {starting ? (
                            <>
                                <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <BrainIcon className="mr-2 h-4 w-4" />
                                Start Building
                            </>
                        )}
                    </Button>
                    <p className="text-muted-foreground text-xs">
                        You can provide guidance and corrections while we work.
                        Everything goes directly to your knowledge base.
                    </p>
                </CardContent>
            </Card>
        </StandardPageLayout>
    );
}
