"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import {
    XCircleIcon,
    PencilIcon,
    BrainIcon,
    UserIcon,
    UsersIcon,
    BriefcaseIcon,
    LightbulbIcon,
    GearIcon,
    SpinnerGapIcon,
    ArrowLeftIcon,
    CheckIcon,
    MicrophoneIcon,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

type ExtractionCategory =
    | "identity"
    | "preference"
    | "person"
    | "project"
    | "decision"
    | "expertise"
    | "voice";

interface Extraction {
    id: string;
    category: ExtractionCategory;
    content: string;
    summary: string;
    confidence: number;
    suggestedPath: string | null;
    status: string;
    sourceTimestamp: string | null;
    connectionId: number;
    connectionTitle: string | null;
}

interface ExtractionStats {
    pending: number;
    approved: number;
    rejected: number;
    byCategory: Record<string, number>;
}

const CATEGORY_CONFIG: Record<
    ExtractionCategory,
    { icon: React.ElementType; label: string; color: string }
> = {
    identity: {
        icon: UserIcon,
        label: "Identity",
        color: "bg-purple-100 text-purple-700",
    },
    preference: {
        icon: GearIcon,
        label: "Preference",
        color: "bg-blue-100 text-blue-700",
    },
    person: {
        icon: UsersIcon,
        label: "Person",
        color: "bg-green-100 text-green-700",
    },
    project: {
        icon: BriefcaseIcon,
        label: "Project",
        color: "bg-orange-100 text-orange-700",
    },
    decision: {
        icon: LightbulbIcon,
        label: "Decision",
        color: "bg-yellow-100 text-yellow-700",
    },
    expertise: {
        icon: BrainIcon,
        label: "Expertise",
        color: "bg-pink-100 text-pink-700",
    },
    voice: {
        icon: MicrophoneIcon,
        label: "Voice",
        color: "bg-indigo-100 text-indigo-700",
    },
};

/**
 * Review page for imported knowledge extractions
 */
export default function ImportReviewPage() {
    const [extractions, setExtractions] = useState<Extraction[]>([]);
    const [stats, setStats] = useState<ExtractionStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [hasUnprocessed, setHasUnprocessed] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<{
        status: string;
        processedConversations: number;
        totalConversations: number;
        extractedCount: number;
    } | null>(null);

    // Fetch extractions
    const fetchExtractions = useCallback(async () => {
        try {
            const res = await fetch("/api/import/extract?status=pending");
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            setExtractions(data.extractions || []);
            setStats(data.stats || null);
            setHasUnprocessed(data.hasUnprocessedImports || false);
        } catch (error) {
            logger.error({ error }, "Failed to fetch extractions");
            toast.error("Failed to load extractions", {
                description: "Please try refreshing the page",
            });
        } finally {
            setLoading(false);
        }
    }, []);

    // Poll job status
    useEffect(() => {
        if (!jobId) return;

        const pollStatus = async () => {
            try {
                const res = await fetch(`/api/import/extract/${jobId}`);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = await res.json();
                setJobStatus(data);

                if (data.status === "completed") {
                    setJobId(null);
                    fetchExtractions();
                } else if (data.status === "failed") {
                    setJobId(null);
                    fetchExtractions();
                    toast.error("Extraction failed", {
                        description: data.errorMessage || "Please try again",
                    });
                }
            } catch (error) {
                logger.error({ error }, "Failed to poll job status");
            }
        };

        const interval = setInterval(pollStatus, 2000);
        pollStatus();

        return () => clearInterval(interval);
    }, [jobId, fetchExtractions]);

    useEffect(() => {
        fetchExtractions();
    }, [fetchExtractions]);

    // Start extraction
    const startExtraction = async () => {
        setProcessing(true);
        try {
            const res = await fetch("/api/import/extract", { method: "POST" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to start extraction");
            }
            const data = await res.json();
            if (data.jobId) {
                setJobId(data.jobId);
            }
        } catch (error) {
            logger.error({ error }, "Failed to start extraction");
            toast.error("Failed to start extraction", {
                description: "Please try again",
            });
        } finally {
            setProcessing(false);
        }
    };

    // Review action
    const reviewExtraction = async (
        id: string,
        action: "approve" | "reject" | "edit",
        editedContent?: string
    ) => {
        setProcessing(true);
        try {
            const res = await fetch("/api/import/extract/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actions: [{ id, action, editedContent }],
                }),
            });
            const data = await res.json();
            if (data.success || data.approved > 0 || data.rejected > 0) {
                setExtractions((prev) => prev.filter((e) => e.id !== id));
                setStats((prev) =>
                    prev
                        ? {
                              ...prev,
                              pending: prev.pending - 1,
                              approved:
                                  action === "approve" || action === "edit"
                                      ? prev.approved + 1
                                      : prev.approved,
                              rejected:
                                  action === "reject"
                                      ? prev.rejected + 1
                                      : prev.rejected,
                          }
                        : null
                );
            } else {
                toast.error("Failed to review extraction", {
                    description: data.errors?.join(", ") || "Please try again",
                });
            }
        } catch (error) {
            logger.error({ error }, "Failed to review extraction");
            toast.error("Failed to review extraction", {
                description: "Please try again",
            });
        } finally {
            setProcessing(false);
            setEditingId(null);
        }
    };

    // Approve all
    const approveAll = async () => {
        if (!stats) return;

        setProcessing(true);
        try {
            // Fetch ALL pending extractions (not just currently loaded 50)
            const allExtractions: Extraction[] = [];
            let offset = 0;
            const batchSize = 100;

            while (allExtractions.length < stats.pending) {
                const res = await fetch(
                    `/api/import/extract?status=pending&limit=${batchSize}&offset=${offset}`
                );
                if (!res.ok) break;
                const data = await res.json();
                if (!data.extractions || data.extractions.length === 0) break;
                allExtractions.push(...data.extractions);
                offset += batchSize;
            }

            const actions = allExtractions.map((e) => ({
                id: e.id,
                action: "approve" as const,
            }));

            const res = await fetch("/api/import/extract/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actions }),
            });
            const data = await res.json();
            if (data.success || data.approved > 0) {
                fetchExtractions();
                toast.success("Approved all extractions", {
                    description: `${data.approved} extractions saved to knowledge base`,
                });
            } else {
                toast.error("Failed to approve all", {
                    description: data.errors?.join(", ") || "Please try again",
                });
            }
        } catch (error) {
            logger.error({ error }, "Failed to approve all");
            toast.error("Failed to approve all", {
                description: "Please try again",
            });
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <StandardPageLayout>
                <div className="flex items-center justify-center py-12">
                    <SpinnerGapIcon className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
            </StandardPageLayout>
        );
    }

    // Show extraction progress
    if (jobId && jobStatus) {
        const progress =
            jobStatus.totalConversations > 0
                ? Math.round(
                      (jobStatus.processedConversations /
                          jobStatus.totalConversations) *
                          100
                  )
                : 0;

        return (
            <StandardPageLayout>
                <Card className="mx-auto max-w-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BrainIcon className="h-5 w-5" />
                            Analyzing Conversations
                        </CardTitle>
                        <CardDescription>
                            We're reading through your imported conversations to learn
                            about you.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>
                                    {jobStatus.processedConversations} /{" "}
                                    {jobStatus.totalConversations} conversations
                                </span>
                            </div>
                            <div className="bg-muted h-2 rounded-full">
                                <div
                                    className="bg-primary h-full rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Found {jobStatus.extractedCount} things so far...
                        </p>
                    </CardContent>
                </Card>
            </StandardPageLayout>
        );
    }

    // No extractions and no unprocessed imports
    if (extractions.length === 0 && !hasUnprocessed) {
        return (
            <StandardPageLayout>
                <Card className="mx-auto max-w-lg">
                    <CardHeader>
                        <CardTitle>Nothing to Review</CardTitle>
                        <CardDescription>
                            {stats && stats.approved > 0
                                ? `You've reviewed ${stats.approved} extractions. Import more conversations to continue learning.`
                                : "Import some conversations first, then we can learn about you."}
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

    // Has unprocessed imports, offer to extract
    if (extractions.length === 0 && hasUnprocessed) {
        return (
            <StandardPageLayout>
                <Card className="mx-auto max-w-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BrainIcon className="h-5 w-5" />
                            Ready to Learn
                        </CardTitle>
                        <CardDescription>
                            You have imported conversations we haven't analyzed yet.
                            Want us to learn about your preferences, projects, and the
                            people in your life?
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={startExtraction} disabled={processing}>
                            {processing ? (
                                <>
                                    <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <BrainIcon className="mr-2 h-4 w-4" />
                                    Start Learning
                                </>
                            )}
                        </Button>
                        <p className="text-muted-foreground text-xs">
                            This takes a few minutes. You'll review what we find before
                            it's saved.
                        </p>
                    </CardContent>
                </Card>
            </StandardPageLayout>
        );
    }

    return (
        <StandardPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">
                            Review Extracted Knowledge
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Review what we learned from your conversations
                        </p>
                    </div>
                    {extractions.length > 0 && (
                        <Button
                            onClick={approveAll}
                            disabled={processing}
                            variant="outline"
                        >
                            <CheckIcon className="mr-2 h-4 w-4" />
                            Approve All ({extractions.length})
                        </Button>
                    )}
                </div>

                {/* Stats */}
                {stats && (
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{stats.pending} pending</Badge>
                        <Badge variant="outline" className="text-green-600">
                            {stats.approved} approved
                        </Badge>
                        <Badge variant="outline" className="text-red-600">
                            {stats.rejected} skipped
                        </Badge>
                    </div>
                )}

                {/* Extractions */}
                <div className="space-y-3">
                    {extractions.map((extraction) => {
                        // Fallback for unexpected categories
                        const config = CATEGORY_CONFIG[extraction.category] ?? {
                            icon: BrainIcon,
                            label: extraction.category,
                            color: "bg-gray-100 text-gray-700",
                        };
                        const CategoryIcon = config.icon;
                        const isEditing = editingId === extraction.id;

                        return (
                            <Card key={extraction.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        {/* Category badge */}
                                        <Badge className={cn("shrink-0", config.color)}>
                                            <CategoryIcon className="mr-1 h-3 w-3" />
                                            {config.label}
                                        </Badge>

                                        {/* Content */}
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <p className="font-medium">
                                                {extraction.summary}
                                            </p>
                                            {isEditing ? (
                                                <textarea
                                                    value={editContent}
                                                    onChange={(
                                                        e: ChangeEvent<HTMLTextAreaElement>
                                                    ) => setEditContent(e.target.value)}
                                                    className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                                                />
                                            ) : (
                                                <p className="text-muted-foreground text-sm">
                                                    {extraction.content}
                                                </p>
                                            )}
                                            <p className="text-muted-foreground text-xs">
                                                From:{" "}
                                                {extraction.connectionTitle ||
                                                    "Untitled conversation"}
                                                {extraction.sourceTimestamp && (
                                                    <>
                                                        {" "}
                                                        ·{" "}
                                                        {new Date(
                                                            extraction.sourceTimestamp
                                                        ).toLocaleDateString()}
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex shrink-0 gap-1">
                                            {isEditing ? (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            reviewExtraction(
                                                                extraction.id,
                                                                "edit",
                                                                editContent
                                                            )
                                                        }
                                                        disabled={processing}
                                                    >
                                                        <CheckIcon className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setEditingId(null)
                                                        }
                                                    >
                                                        <XCircleIcon className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            reviewExtraction(
                                                                extraction.id,
                                                                "approve"
                                                            )
                                                        }
                                                        disabled={processing}
                                                        title="Approve"
                                                    >
                                                        <CheckIcon className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setEditingId(extraction.id);
                                                            setEditContent(
                                                                extraction.content
                                                            );
                                                        }}
                                                        disabled={processing}
                                                        title="Edit"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            reviewExtraction(
                                                                extraction.id,
                                                                "reject"
                                                            )
                                                        }
                                                        disabled={processing}
                                                        title="Skip"
                                                    >
                                                        <XCircleIcon className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Start new extraction if there are unprocessed */}
                {hasUnprocessed && (
                    <Card className="border-dashed">
                        <CardContent className="flex items-center justify-between p-4">
                            <p className="text-muted-foreground text-sm">
                                More imported conversations are available to analyze.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={startExtraction}
                                disabled={processing}
                            >
                                <BrainIcon className="mr-2 h-4 w-4" />
                                Analyze More
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </StandardPageLayout>
    );
}
