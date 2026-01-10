"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
    UploadIcon,
    FileZipIcon,
    CheckCircleIcon,
    WarningCircleIcon,
    CalendarIcon,
    ArrowRightIcon,
    FunnelIcon,
    XIcon,
    MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    DiscoveryInvitation,
    DiscoveryProgress,
    DiscoveryComplete,
} from "@/components/discovery";
import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import { commitImport, type ImportCommitResult } from "@/lib/actions/import";
import type { ConversationForImport } from "@/app/api/import/chatgpt/route";
import type { ExtractionStats } from "@/lib/import/extraction/types";

type Provider = "chatgpt" | "anthropic";
type ImportState =
    | "idle"
    | "uploading"
    | "parsing"
    | "preview"
    | "importing"
    | "success"
    | "error";

type DiscoveryState = "idle" | "invited" | "starting" | "processing" | "complete";

interface ConversationPreview {
    id: string;
    title: string;
    messageCount: number;
    createdAt: string;
    model?: string | null;
}

interface ImportStats {
    conversationCount: number;
    totalMessageCount: number;
    dateRange: {
        earliest: string;
        latest: string;
    };
}

interface ParsedData {
    importId: string;
    conversations: ConversationPreview[];
    stats: ImportStats;
}

interface ImportFilters {
    dateStart: string;
    dateEnd: string;
    keywordInclude: string;
    keywordExclude: string;
    minMessages: string;
    maxMessages: string;
    customGptOnly: boolean;
}

const DEFAULT_FILTERS: ImportFilters = {
    dateStart: "",
    dateEnd: "",
    keywordInclude: "",
    keywordExclude: "",
    minMessages: "",
    maxMessages: "",
    customGptOnly: false,
};

const PROVIDERS = {
    chatgpt: {
        name: "ChatGPT",
        logo: "/logos/openai.svg",
        apiEndpoint: "/api/import/chatgpt",
        instructions:
            "Go to ChatGPT Settings → Data Controls → Export Data. You'll receive an email with a download link.",
        exportUrl: "https://chatgpt.com/settings#settings/DataControls",
        exportUrlLabel: "Open ChatGPT Settings",
    },
    anthropic: {
        name: "Claude",
        logo: "/logos/anthropic.svg",
        apiEndpoint: "/api/import/anthropic",
        instructions:
            "Go to Claude Settings → Privacy & Data Controls → Export Data. You'll receive an email with a download link.",
        exportUrl: "https://claude.ai/settings/data-privacy-controls",
        exportUrlLabel: "Open Claude Settings",
    },
} as const;

const PROVIDER_ORDER: Provider[] = ["anthropic", "chatgpt"];

/**
 * Import page for bringing data from other AI platforms into Carmenta
 */
export default function ImportPage() {
    const router = useRouter();
    const { isLoaded, isSignedIn } = useAuth();

    // Redirect to sign-in if not authenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/sign-in?redirect_url=/import");
        }
    }, [isLoaded, isSignedIn, router]);

    // All hooks must be called before any conditional returns
    const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
    const [state, setState] = useState<ImportState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [fullConversations, setFullConversations] = useState<ConversationForImport[]>(
        []
    );
    const [importResult, setImportResult] = useState<ImportCommitResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [filters, setFilters] = useState<ImportFilters>(DEFAULT_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Discovery state
    const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("idle");
    const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
    const [extractionStats, setExtractionStats] = useState<ExtractionStats | null>(
        null
    );
    const [isApprovingAll, setIsApprovingAll] = useState(false);

    const currentProvider = PROVIDERS[selectedProvider];

    // Filter conversations based on current filters
    const filteredConversations = useMemo(() => {
        if (!fullConversations.length) return [];

        return fullConversations.filter((conv) => {
            // Date range filter
            // Parse dates with 'T00:00:00' suffix to ensure local timezone interpretation
            // (bare YYYY-MM-DD may be parsed as UTC in some browsers)
            if (filters.dateStart) {
                const convDate = new Date(conv.createdAt);
                const startDate = new Date(filters.dateStart + "T00:00:00");
                if (convDate < startDate) return false;
            }
            if (filters.dateEnd) {
                const convDate = new Date(conv.createdAt);
                const endDate = new Date(filters.dateEnd + "T23:59:59.999");
                if (convDate > endDate) return false;
            }

            // Keyword include filter (searches title and content)
            if (filters.keywordInclude.trim()) {
                const keywords = filters.keywordInclude
                    .toLowerCase()
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean);
                // Skip filter if no valid keywords after cleaning (e.g., just commas)
                if (keywords.length > 0) {
                    const titleLower = conv.title.toLowerCase();
                    const contentLower = conv.messages
                        .map((m) => m.content)
                        .join(" ")
                        .toLowerCase();
                    const hasKeyword = keywords.some(
                        (kw) => titleLower.includes(kw) || contentLower.includes(kw)
                    );
                    if (!hasKeyword) return false;
                }
            }

            // Keyword exclude filter
            if (filters.keywordExclude.trim()) {
                const keywords = filters.keywordExclude
                    .toLowerCase()
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean);
                // Skip filter if no valid keywords after cleaning
                if (keywords.length > 0) {
                    const titleLower = conv.title.toLowerCase();
                    const contentLower = conv.messages
                        .map((m) => m.content)
                        .join(" ")
                        .toLowerCase();
                    const hasExcludedKeyword = keywords.some(
                        (kw) => titleLower.includes(kw) || contentLower.includes(kw)
                    );
                    if (hasExcludedKeyword) return false;
                }
            }

            // Min messages filter
            if (filters.minMessages) {
                const min = parseInt(filters.minMessages, 10);
                if (!isNaN(min) && conv.messageCount < min) return false;
            }

            // Max messages filter
            if (filters.maxMessages) {
                const max = parseInt(filters.maxMessages, 10);
                if (!isNaN(max) && conv.messageCount > max) return false;
            }

            // Custom GPT only filter (ChatGPT-specific)
            if (filters.customGptOnly) {
                const convWithGpt = conv as { customGptId?: string };
                if (!convWithGpt.customGptId) return false;
            }

            return true;
        });
    }, [fullConversations, filters]);

    const hasActiveFilters = useMemo(() => {
        return (
            filters.dateStart !== "" ||
            filters.dateEnd !== "" ||
            filters.keywordInclude !== "" ||
            filters.keywordExclude !== "" ||
            filters.minMessages !== "" ||
            filters.maxMessages !== "" ||
            filters.customGptOnly
        );
    }, [filters]);

    const clearFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const clearFileInput = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const handleFileSelect = useCallback(
        async (file: File) => {
            if (!file.name.endsWith(".zip")) {
                setError(
                    "That doesn't look like a ZIP file. Exports come as .zip files."
                );
                setState("error");
                clearFileInput();
                return;
            }

            // 500MB limit - exports can be very large (users report 186MB, 375MB+)
            if (file.size > 500 * 1024 * 1024) {
                setError(
                    `That file is too large (${Math.round(file.size / 1024 / 1024)}MB). We can handle up to 500MB.`
                );
                setState("error");
                clearFileInput();
                return;
            }

            setState("uploading");
            setError(null);

            try {
                const formData = new FormData();
                formData.append("file", file);

                setState("parsing");

                const response = await fetch(currentProvider.apiEndpoint, {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || "Failed to parse export");
                }

                setParsedData({
                    importId: data.importId,
                    conversations: data.conversations,
                    stats: data.stats,
                });
                setFullConversations(data.fullConversations || []);
                setState("preview");

                logger.info(
                    {
                        conversationCount: data.stats.conversationCount,
                        provider: selectedProvider,
                    },
                    `${currentProvider.name} export parsed successfully`
                );
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Failed to parse export";
                setError(message);
                setState("error");
                clearFileInput();
                logger.error(
                    { error: err, provider: selectedProvider },
                    "Failed to parse export"
                );
                Sentry.captureException(err, {
                    tags: { component: "import", platform: selectedProvider },
                });
            }
        },
        [clearFileInput, currentProvider, selectedProvider]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileSelect(file);
            }
        },
        [handleFileSelect]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileSelect(file);
            }
        },
        [handleFileSelect]
    );

    const handleClickUpload = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleReset = useCallback(() => {
        setState("idle");
        setError(null);
        setParsedData(null);
        setFullConversations([]);
        setImportResult(null);
        setFilters(DEFAULT_FILTERS);
        setFiltersOpen(false);
        // Reset discovery state
        setDiscoveryState("idle");
        setDiscoveryJobId(null);
        setExtractionStats(null);
        setIsApprovingAll(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const handleImport = useCallback(async () => {
        if (filteredConversations.length === 0) {
            setError("We need at least one chat to bring over. Loosen those filters?");
            setState("error");
            return;
        }

        setState("importing");
        setError(null);

        try {
            const result = await commitImport(filteredConversations, selectedProvider);

            if (result.success) {
                setImportResult(result);
                setState("success");
                // Show discovery invitation if we created connections
                if (result.connectionIds.length > 0) {
                    setDiscoveryState("invited");
                }
                logger.info(
                    {
                        connectionsCreated: result.connectionsCreated,
                        messagesImported: result.messagesImported,
                        provider: selectedProvider,
                    },
                    "Import completed successfully"
                );
            } else {
                setError(result.errors[0] || "Import failed");
                setState("error");
                logger.error(
                    { errors: result.errors, provider: selectedProvider },
                    "Import failed"
                );
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Import failed";
            setError(message);
            setState("error");
            logger.error({ error: err, provider: selectedProvider }, "Import error");
            Sentry.captureException(err, {
                tags: { component: "import-commit", platform: selectedProvider },
            });
        }
    }, [filteredConversations, selectedProvider]);

    const handleSelectProvider = useCallback((provider: Provider) => {
        setSelectedProvider(provider);
        setState("idle");
        setError(null);
        setParsedData(null);
        setFullConversations([]);
        setFilters(DEFAULT_FILTERS);
        // Reset discovery state when switching providers
        setDiscoveryState("idle");
        setDiscoveryJobId(null);
        setExtractionStats(null);
        setIsApprovingAll(false);
    }, []);

    // Discovery handlers
    const handleBeginDiscovery = useCallback(async () => {
        if (!importResult?.connectionIds.length) return;

        setDiscoveryState("starting");

        try {
            const response = await fetch("/api/import/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    connectionIds: importResult.connectionIds,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // If extraction service unavailable, show feedback and skip to success
                logger.warn({ error: data.error }, "Discovery unavailable");
                setError(
                    "Discovery isn't available right now. Your conversations were imported—you can explore them anytime."
                );
                setDiscoveryState("idle");
                return;
            }

            if (data.jobId) {
                setDiscoveryJobId(data.jobId);
                setDiscoveryState("processing");
            } else {
                // No job started (no unprocessed imports)
                setDiscoveryState("idle");
            }
        } catch (err) {
            logger.error({ error: err }, "Failed to start discovery");
            setError("Network error starting discovery. Please try again.");
            setDiscoveryState("idle");
        }
    }, [importResult?.connectionIds]);

    const handleSkipDiscovery = useCallback(() => {
        setDiscoveryState("idle");
        router.push("/");
    }, [router]);

    const handleDiscoveryComplete = useCallback((stats: ExtractionStats) => {
        setExtractionStats(stats);
        setDiscoveryState("complete");
    }, []);

    const handleContinueToApp = useCallback(() => {
        router.push("/");
    }, [router]);

    const handleKeepEverything = useCallback(async () => {
        if (!extractionStats?.pending) {
            router.push("/");
            return;
        }

        setIsApprovingAll(true);

        try {
            const response = await fetch("/api/import/extract/approve-all", {
                method: "POST",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                logger.error({ error: data.error }, "Failed to approve extractions");
                setError(data.error || "Couldn't save findings. Please try again.");
                setIsApprovingAll(false);
                return;
            }

            logger.info({}, "All extractions approved");
            router.push("/");
        } catch (err) {
            logger.error({ error: err }, "Failed to approve all extractions");
            setError("Network error. Please check your connection and try again.");
            setIsApprovingAll(false);
        }
    }, [extractionStats?.pending, router]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatDateRange = (earliest: string, latest: string) => {
        const start = formatDate(earliest);
        const end = formatDate(latest);
        return start === end ? start : `${start} - ${end}`;
    };

    // Show loading while checking auth, or nothing if not signed in (redirect in progress)
    if (!isLoaded || !isSignedIn) {
        return (
            <StandardPageLayout maxWidth="standard" verticalPadding="normal">
                <div className="flex min-h-[50vh] items-center justify-center">
                    <LoadingSpinner size={32} />
                </div>
            </StandardPageLayout>
        );
    }

    return (
        <StandardPageLayout maxWidth="standard" verticalPadding="normal">
            <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                            <UploadIcon className="h-5 w-5" weight="duotone" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Bring your AI history home
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        Your past connections become the foundation we build on
                        together.
                    </p>
                </div>

                {/* Provider Tabs */}
                <div className="flex gap-2">
                    {PROVIDER_ORDER.map((key) => {
                        const provider = PROVIDERS[key];
                        const isSelected = selectedProvider === key;
                        return (
                            <button
                                key={key}
                                onClick={() => handleSelectProvider(key)}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                                    isSelected
                                        ? "bg-primary/10 text-primary ring-primary/20 ring-1"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <div className="relative h-5 w-5 overflow-hidden rounded">
                                    <Image
                                        src={provider.logo}
                                        alt={provider.name}
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                                {provider.name}
                            </button>
                        );
                    })}
                </div>

                {/* Upload UI - shown in idle state */}
                {state === "idle" && (
                    <div className="space-y-4">
                        {/* Instructions - single integrated CTA */}
                        <p className="text-muted-foreground text-sm">
                            <a
                                href={currentProvider.exportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                {currentProvider.exportUrlLabel}
                            </a>
                            {" → "}
                            {selectedProvider === "anthropic"
                                ? "Privacy & Data Controls → Export Data"
                                : "Data Controls → Export Data"}
                            . You&apos;ll receive an email with a download link.
                        </p>

                        {/* Upload Zone */}
                        <div
                            className={cn(
                                "cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors",
                                "bg-background/80 backdrop-blur-sm",
                                isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={handleClickUpload}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip"
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                            <FileZipIcon
                                className="text-muted-foreground mx-auto h-12 w-12"
                                weight="duotone"
                            />
                            <p className="text-muted-foreground mt-4">
                                Drop your {currentProvider.name} chats here, or{" "}
                                <span className="text-primary font-medium">
                                    click to find them
                                </span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {(state === "uploading" || state === "parsing") && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <LoadingSpinner size={48} />
                                <p className="mt-4 font-medium">
                                    {state === "uploading"
                                        ? "Uploading..."
                                        : "Reading your history..."}
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    This is worth doing carefully.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error State */}
                {state === "error" && error && (
                    <Card className="border-destructive/50">
                        <CardContent className="py-8">
                            <div className="flex flex-col items-center justify-center text-center">
                                <WarningCircleIcon
                                    className="text-destructive h-10 w-10"
                                    weight="duotone"
                                />
                                <p className="mt-4 font-medium">{error}</p>
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={handleReset}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Preview State */}
                {state === "preview" && parsedData && (
                    <div className="space-y-6">
                        {/* Success Banner */}
                        <Card className="border-green-500/30 bg-green-500/5">
                            <CardContent className="py-6">
                                <div className="flex items-center gap-4">
                                    <CheckCircleIcon
                                        className="h-8 w-8 flex-shrink-0 text-green-600"
                                        weight="duotone"
                                    />
                                    <div>
                                        <p className="font-medium">There they are</p>
                                        <p className="text-muted-foreground text-sm">
                                            {parsedData.stats.conversationCount.toLocaleString()}{" "}
                                            chats with{" "}
                                            {parsedData.stats.totalMessageCount.toLocaleString()}{" "}
                                            messages
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats */}
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="border-border/40 relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border bg-white p-1 shadow-sm dark:bg-gray-50">
                                            <Image
                                                src={currentProvider.logo}
                                                alt={currentProvider.name}
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-semibold">
                                                {parsedData.stats.conversationCount.toLocaleString()}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                Chats
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
                                            <span className="text-lg font-semibold">
                                                #
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-semibold">
                                                {parsedData.stats.totalMessageCount.toLocaleString()}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                Messages
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <CalendarIcon className="text-muted-foreground h-8 w-8" />
                                        <div>
                                            <p className="text-sm font-semibold">
                                                {formatDateRange(
                                                    parsedData.stats.dateRange.earliest,
                                                    parsedData.stats.dateRange.latest
                                                )}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                Date Range
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filters */}
                        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                            <div className="flex items-center justify-between">
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <FunnelIcon className="h-4 w-4" />
                                        Filter Chats
                                        {hasActiveFilters && (
                                            <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
                                                Active
                                            </span>
                                        )}
                                    </Button>
                                </CollapsibleTrigger>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="text-muted-foreground gap-1"
                                    >
                                        <XIcon className="h-3 w-3" />
                                        Clear filters
                                    </Button>
                                )}
                            </div>
                            <CollapsibleContent className="mt-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="grid gap-6 sm:grid-cols-2">
                                            {/* Date Range */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-medium">
                                                    Date Range
                                                </h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <label
                                                            htmlFor="dateStart"
                                                            className="text-muted-foreground text-xs"
                                                        >
                                                            From
                                                        </label>
                                                        <input
                                                            id="dateStart"
                                                            type="date"
                                                            value={filters.dateStart}
                                                            onChange={(
                                                                e: React.ChangeEvent<HTMLInputElement>
                                                            ) =>
                                                                setFilters((f) => ({
                                                                    ...f,
                                                                    dateStart:
                                                                        e.target.value,
                                                                }))
                                                            }
                                                            className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label
                                                            htmlFor="dateEnd"
                                                            className="text-muted-foreground text-xs"
                                                        >
                                                            To
                                                        </label>
                                                        <input
                                                            id="dateEnd"
                                                            type="date"
                                                            value={filters.dateEnd}
                                                            onChange={(
                                                                e: React.ChangeEvent<HTMLInputElement>
                                                            ) =>
                                                                setFilters((f) => ({
                                                                    ...f,
                                                                    dateEnd:
                                                                        e.target.value,
                                                                }))
                                                            }
                                                            className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Message Count */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-medium">
                                                    Message Count
                                                </h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <label
                                                            htmlFor="minMessages"
                                                            className="text-muted-foreground text-xs"
                                                        >
                                                            At least
                                                        </label>
                                                        <input
                                                            id="minMessages"
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={filters.minMessages}
                                                            onChange={(
                                                                e: React.ChangeEvent<HTMLInputElement>
                                                            ) =>
                                                                setFilters((f) => ({
                                                                    ...f,
                                                                    minMessages:
                                                                        e.target.value,
                                                                }))
                                                            }
                                                            className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label
                                                            htmlFor="maxMessages"
                                                            className="text-muted-foreground text-xs"
                                                        >
                                                            At most
                                                        </label>
                                                        <input
                                                            id="maxMessages"
                                                            type="number"
                                                            min="0"
                                                            placeholder="∞"
                                                            value={filters.maxMessages}
                                                            onChange={(
                                                                e: React.ChangeEvent<HTMLInputElement>
                                                            ) =>
                                                                setFilters((f) => ({
                                                                    ...f,
                                                                    maxMessages:
                                                                        e.target.value,
                                                                }))
                                                            }
                                                            className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Keyword Include */}
                                            <div className="space-y-2">
                                                <label
                                                    htmlFor="keywordInclude"
                                                    className="text-sm font-medium"
                                                >
                                                    Search for
                                                </label>
                                                <div className="relative">
                                                    <MagnifyingGlassIcon className="text-muted-foreground absolute top-2 left-2 h-4 w-4" />
                                                    <input
                                                        id="keywordInclude"
                                                        placeholder="python, react, api..."
                                                        value={filters.keywordInclude}
                                                        onChange={(
                                                            e: React.ChangeEvent<HTMLInputElement>
                                                        ) =>
                                                            setFilters((f) => ({
                                                                ...f,
                                                                keywordInclude:
                                                                    e.target.value,
                                                            }))
                                                        }
                                                        className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* Keyword Exclude */}
                                            <div className="space-y-2">
                                                <label
                                                    htmlFor="keywordExclude"
                                                    className="text-sm font-medium"
                                                >
                                                    Skip anything with
                                                </label>
                                                <div className="relative">
                                                    <XIcon className="text-muted-foreground absolute top-2 left-2 h-4 w-4" />
                                                    <input
                                                        id="keywordExclude"
                                                        placeholder="test, draft, temp..."
                                                        value={filters.keywordExclude}
                                                        onChange={(
                                                            e: React.ChangeEvent<HTMLInputElement>
                                                        ) =>
                                                            setFilters((f) => ({
                                                                ...f,
                                                                keywordExclude:
                                                                    e.target.value,
                                                            }))
                                                        }
                                                        className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* Custom GPT Filter (ChatGPT only) */}
                                            {selectedProvider === "chatgpt" && (
                                                <div className="space-y-2 sm:col-span-2">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                filters.customGptOnly
                                                            }
                                                            onChange={(
                                                                e: React.ChangeEvent<HTMLInputElement>
                                                            ) =>
                                                                setFilters((f) => ({
                                                                    ...f,
                                                                    customGptOnly:
                                                                        e.target
                                                                            .checked,
                                                                }))
                                                            }
                                                            className="h-4 w-4 rounded border-gray-300"
                                                        />
                                                        <span className="text-sm">
                                                            Only Custom GPT chats
                                                        </span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* Conversation Preview */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Chats to Import</CardTitle>
                                        <CardDescription>
                                            {hasActiveFilters ? (
                                                <>
                                                    Showing{" "}
                                                    {filteredConversations.length.toLocaleString()}{" "}
                                                    of{" "}
                                                    {fullConversations.length.toLocaleString()}{" "}
                                                    chats
                                                </>
                                            ) : (
                                                <>Everything we found. Take a look.</>
                                            )}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredConversations.length === 0 ? (
                                    <div className="text-muted-foreground py-8 text-center">
                                        <FunnelIcon className="mx-auto h-8 w-8 opacity-50" />
                                        <p className="mt-2">
                                            No chats match those filters
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearFilters}
                                            className="mt-2"
                                        >
                                            Clear filters
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="max-h-96 space-y-2 overflow-y-auto">
                                        {filteredConversations
                                            .slice(0, 50)
                                            .map((conv) => (
                                                <div
                                                    key={conv.id}
                                                    className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-medium">
                                                            {conv.title}
                                                        </p>
                                                        <p className="text-muted-foreground text-sm">
                                                            {conv.messageCount} messages
                                                            ·{" "}
                                                            {formatDate(conv.createdAt)}
                                                            {conv.model &&
                                                                ` · ${conv.model}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        {filteredConversations.length > 50 && (
                                            <p className="text-muted-foreground py-2 text-center text-sm">
                                                ...and{" "}
                                                {filteredConversations.length - 50} more
                                                chats
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={handleReset}>
                                Start Over
                            </Button>
                            <Button
                                onClick={handleImport}
                                className="gap-2"
                                disabled={filteredConversations.length === 0}
                            >
                                Import{" "}
                                {hasActiveFilters
                                    ? `${filteredConversations.length.toLocaleString()} Chats`
                                    : "All Chats"}
                                <ArrowRightIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Importing State */}
                {state === "importing" && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <LoadingSpinner size={48} />
                                <p className="mt-4 font-medium">
                                    Bringing your chats over...
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    This is worth doing carefully.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Success State - Discovery Flow */}
                {state === "success" && importResult && (
                    <>
                        {/* Show errors during discovery flow */}
                        {error && (
                            <Card className="mb-6 border-red-500/30 bg-red-500/5">
                                <CardContent className="py-4">
                                    <p className="text-sm text-red-600">{error}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Phase 1: Discovery Invitation (including starting state) */}
                        {(discoveryState === "invited" ||
                            discoveryState === "starting") && (
                            <DiscoveryInvitation
                                connectionsCreated={importResult.connectionsCreated}
                                messagesImported={importResult.messagesImported}
                                skippedDuplicates={importResult.skippedDuplicates}
                                onBeginDiscovery={handleBeginDiscovery}
                                onSkipDiscovery={handleSkipDiscovery}
                                isStarting={discoveryState === "starting"}
                            />
                        )}

                        {/* Phase 2: Discovery Progress */}
                        {discoveryState === "processing" && discoveryJobId && (
                            <DiscoveryProgress
                                jobId={discoveryJobId}
                                totalConversations={importResult.connectionsCreated}
                                onComplete={handleDiscoveryComplete}
                                onContinue={handleContinueToApp}
                            />
                        )}

                        {/* Phase 3: Discovery Complete */}
                        {discoveryState === "complete" && extractionStats && (
                            <DiscoveryComplete
                                stats={extractionStats}
                                // Review page not built yet - omit handler to hide button
                                // onReviewFindings={handleReviewFindings}
                                onKeepEverything={handleKeepEverything}
                                isApproving={isApprovingAll}
                            />
                        )}

                        {/* Fallback: Simple success (no discovery or skipped) */}
                        {discoveryState === "idle" && (
                            <Card className="border-green-500/30 bg-green-500/5">
                                <CardContent className="py-12">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <CheckCircleIcon
                                            className="h-12 w-12 text-green-600"
                                            weight="duotone"
                                        />
                                        <p className="mt-4 text-xl font-medium">
                                            All here now
                                        </p>
                                        <p className="text-muted-foreground mt-2">
                                            {importResult.connectionsCreated.toLocaleString()}{" "}
                                            connections with{" "}
                                            {importResult.messagesImported.toLocaleString()}{" "}
                                            messages in Carmenta
                                            {importResult.skippedDuplicates > 0 && (
                                                <span className="mt-1 block">
                                                    (Already had{" "}
                                                    {importResult.skippedDuplicates} of
                                                    these)
                                                </span>
                                            )}
                                        </p>
                                        <div className="mt-6 flex gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={handleReset}
                                            >
                                                Import More
                                            </Button>
                                            <Button onClick={() => router.push("/")}>
                                                Start connecting
                                            </Button>
                                        </div>
                                        {importResult.errors.length > 0 && (
                                            <p className="text-muted-foreground mt-4 text-sm">
                                                {importResult.errors.length} connection
                                                {importResult.errors.length === 1
                                                    ? ""
                                                    : "s"}{" "}
                                                couldn&apos;t be imported
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </StandardPageLayout>
    );
}
