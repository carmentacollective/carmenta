"use client";

/**
 * Import Widget
 *
 * Reusable import flow that can be embedded in different contexts:
 * - Full page (/import) - conversations + knowledge extraction
 * - Connections page - quick conversation import
 * - Knowledge Base page - knowledge-only extraction
 *
 * Modes:
 * - "full": Import conversations with optional knowledge extraction
 * - "knowledge-only": Extract knowledge without importing conversations
 */

import { useState, useCallback, useRef, useMemo } from "react";
import {
    FileZipIcon,
    CheckCircleIcon,
    WarningCircleIcon,
    CalendarIcon,
    ArrowRightIcon,
    FunnelIcon,
    XIcon,
    MagnifyingGlassIcon,
    BrainIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DiscoveryInvitation,
    DiscoveryProgress,
    DiscoveryComplete,
} from "@/components/discovery";
import { ImportStepper, type ImportStep } from "@/components/import/import-stepper";
import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import {
    commitImport,
    type ImportCommitResult,
    type ImportedUserSettings,
} from "@/lib/actions/import";
import type { ConversationForImport } from "@/app/api/import/chatgpt/route";
import type { ExtractionStats } from "@/lib/import/extraction/types";

// ============================================================================
// Types
// ============================================================================

export type ImportMode = "full" | "knowledge-only";
type Provider = "chatgpt" | "anthropic";
type ImportState =
    | "idle"
    | "uploading"
    | "parsing"
    | "preview"
    | "importing"
    | "extracting"
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

export interface ImportWidgetProps {
    /** Import mode - full (conversations + knowledge) or knowledge-only */
    mode: ImportMode;
    /** Compact display for embedded use */
    compact?: boolean;
    /** Show the stepper progress indicator */
    showStepper?: boolean;
    /** Callback when import completes successfully */
    onSuccess?: (result: ImportCommitResult | ExtractionStats) => void;
    /** Callback when user cancels/closes */
    onCancel?: () => void;
    /** Additional class names */
    className?: string;
    /** Pre-selected provider */
    defaultProvider?: Provider;
    /** Whether to show provider tabs */
    showProviderTabs?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Component
// ============================================================================

export function ImportWidget({
    mode,
    compact = false,
    showStepper = true,
    onSuccess,
    onCancel,
    className,
    defaultProvider = "anthropic",
    showProviderTabs = true,
}: ImportWidgetProps) {
    const router = useRouter();

    // Provider selection
    const [selectedProvider, setSelectedProvider] = useState<Provider>(defaultProvider);
    const currentProvider = PROVIDERS[selectedProvider];

    // Import state
    const [state, setState] = useState<ImportState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [fullConversations, setFullConversations] = useState<ConversationForImport[]>(
        []
    );
    const [userSettings, setUserSettings] = useState<ImportedUserSettings | null>(null);
    const [importResult, setImportResult] = useState<ImportCommitResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [filters, setFilters] = useState<ImportFilters>(DEFAULT_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Discovery state
    // Note: For knowledge-only mode, state machine works differently:
    // 1. state="extracting" while calling API
    // 2. state="success" + discoveryState="processing" during extraction (prevents loading spinner + discovery UI overlap)
    // 3. discoveryState="complete" when extraction finishes
    // This allows both state="success" and discoveryState="processing" to be true simultaneously.
    const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("idle");
    const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
    const [extractionStats, setExtractionStats] = useState<ExtractionStats | null>(
        null
    );
    const [isApprovingAll, setIsApprovingAll] = useState(false);

    // Derive current step for the stepper
    const currentStep: ImportStep = useMemo(() => {
        if (state !== "success" && state !== "extracting") return "upload";
        if (discoveryState === "complete") return "review";
        if (discoveryState === "processing" || state === "extracting")
            return "discover";
        return "discover";
    }, [state, discoveryState]);

    // Filter conversations
    const filteredConversations = useMemo(() => {
        if (!fullConversations.length) return [];

        return fullConversations.filter((conv) => {
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
            if (filters.keywordInclude.trim()) {
                const keywords = filters.keywordInclude
                    .toLowerCase()
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean);
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
            if (filters.keywordExclude.trim()) {
                const keywords = filters.keywordExclude
                    .toLowerCase()
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean);
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
            if (filters.minMessages) {
                const min = parseInt(filters.minMessages, 10);
                if (!isNaN(min) && conv.messageCount < min) return false;
            }
            if (filters.maxMessages) {
                const max = parseInt(filters.maxMessages, 10);
                if (!isNaN(max) && conv.messageCount > max) return false;
            }
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

    // ========================================================================
    // File Handling
    // ========================================================================

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

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const formData = new FormData();
                formData.append("file", file);

                setState("parsing");

                const response = await fetch(currentProvider.apiEndpoint, {
                    method: "POST",
                    body: formData,
                    signal: abortController.signal,
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
                setUserSettings(data.userSettings || null);
                setState("preview");

                logger.info(
                    {
                        conversationCount: data.stats.conversationCount,
                        provider: selectedProvider,
                        mode,
                    },
                    `${currentProvider.name} export parsed successfully`
                );
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    logger.info(
                        { provider: selectedProvider },
                        "Parse cancelled by user"
                    );
                    return;
                }

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
                    tags: {
                        component: "import-widget",
                        platform: selectedProvider,
                        mode,
                    },
                });
            } finally {
                abortControllerRef.current = null;
            }
        },
        [clearFileInput, currentProvider, selectedProvider, mode]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
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
            if (file) handleFileSelect(file);
        },
        [handleFileSelect]
    );

    const handleClickUpload = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // ========================================================================
    // Reset / Cancel
    // ========================================================================

    const handleReset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        setState("idle");
        setError(null);
        setParsedData(null);
        setFullConversations([]);
        setImportResult(null);
        setFilters(DEFAULT_FILTERS);
        setFiltersOpen(false);
        setDiscoveryState("idle");
        setDiscoveryJobId(null);
        setExtractionStats(null);
        setIsApprovingAll(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const handleRetryFromError = useCallback(() => {
        setError(null);
        if (parsedData) {
            setState("preview");
        } else {
            handleReset();
        }
    }, [parsedData, handleReset]);

    // ========================================================================
    // Import (Full Mode)
    // ========================================================================

    const handleImport = useCallback(async () => {
        if (filteredConversations.length === 0) {
            setError("We need at least one chat to bring over. Loosen those filters?");
            setState("error");
            return;
        }

        setState("importing");
        setError(null);

        try {
            const result = await commitImport(
                filteredConversations,
                selectedProvider,
                userSettings
            );

            if (result.success) {
                setImportResult(result);
                setState("success");
                if (result.connectionIds.length > 0) {
                    setDiscoveryState("invited");
                }
                logger.info(
                    {
                        connectionsCreated: result.connectionsCreated,
                        messagesImported: result.messagesImported,
                        provider: selectedProvider,
                        mode,
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
                tags: { component: "import-widget-commit", platform: selectedProvider },
            });
        }
    }, [filteredConversations, selectedProvider, userSettings, mode]);

    // ========================================================================
    // Knowledge-Only Extraction
    // ========================================================================

    const handleExtractKnowledge = useCallback(async () => {
        if (filteredConversations.length === 0) {
            setError(
                "We need at least one conversation to extract knowledge from. Loosen those filters?"
            );
            setState("error");
            return;
        }

        setState("extracting");
        setError(null);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            // For knowledge-only mode, we send conversations directly to extraction
            // without creating permanent connections
            const response = await fetch("/api/import/extract-knowledge-only", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversations: filteredConversations,
                    provider: selectedProvider,
                }),
                signal: abortController.signal,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Extraction failed");
            }

            if (data.jobId) {
                setDiscoveryJobId(data.jobId);
                setState("success"); // Transition from "extracting" to prevent double-render
                setDiscoveryState("processing");
            } else {
                // No extractions found
                setExtractionStats({
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
                setState("success");
                setDiscoveryState("complete");
            }
        } catch (err) {
            // Ignore abort errors (user canceled)
            if (err instanceof Error && err.name === "AbortError") {
                return;
            }

            const message =
                err instanceof Error ? err.message : "Knowledge extraction failed";
            setError(message);
            setState("error");
            logger.error({ error: err }, "Knowledge extraction failed");
            Sentry.captureException(err, {
                tags: { component: "import-widget-extract", mode: "knowledge-only" },
            });
        } finally {
            abortControllerRef.current = null;
        }
    }, [filteredConversations, selectedProvider]);

    // ========================================================================
    // Discovery Handlers
    // ========================================================================

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
        if (onSuccess && importResult) {
            onSuccess(importResult);
        } else {
            router.push("/");
        }
    }, [router, onSuccess, importResult]);

    const handleDiscoveryComplete = useCallback((stats: ExtractionStats) => {
        setExtractionStats(stats);
        setDiscoveryState("complete");
    }, []);

    const handleDiscoveryError = useCallback((errorMessage: string) => {
        setError(errorMessage);
        setDiscoveryState("idle");
        setState("error");
    }, []);

    const handleKeepEverything = useCallback(async () => {
        if (!extractionStats?.pending) {
            if (onSuccess) {
                const result =
                    mode === "knowledge-only" ? extractionStats : importResult;
                if (result) {
                    onSuccess(result);
                }
            } else {
                router.push("/");
            }
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
            if (onSuccess) {
                const result =
                    mode === "knowledge-only" ? extractionStats : importResult;
                if (result) {
                    onSuccess(result);
                }
            } else {
                router.push("/");
            }
        } catch (err) {
            logger.error({ error: err }, "Failed to approve all extractions");
            setError("Network error. Please check your connection and try again.");
            setIsApprovingAll(false);
        }
    }, [extractionStats, router, onSuccess, mode, importResult]);

    // ========================================================================
    // Provider Selection
    // ========================================================================

    const hasUnsavedWork = useMemo(() => {
        const filtersModified =
            filters.dateStart !== DEFAULT_FILTERS.dateStart ||
            filters.dateEnd !== DEFAULT_FILTERS.dateEnd ||
            filters.keywordInclude !== DEFAULT_FILTERS.keywordInclude ||
            filters.keywordExclude !== DEFAULT_FILTERS.keywordExclude ||
            filters.minMessages !== DEFAULT_FILTERS.minMessages ||
            filters.maxMessages !== DEFAULT_FILTERS.maxMessages ||
            filters.customGptOnly !== DEFAULT_FILTERS.customGptOnly;
        return filtersModified || parsedData !== null;
    }, [filters, parsedData]);

    const handleSelectProvider = useCallback(
        (provider: Provider) => {
            if (hasUnsavedWork) {
                const confirmed = window.confirm(
                    "Switching providers will clear your current import. Continue?"
                );
                if (!confirmed) return;
            }

            setSelectedProvider(provider);
            handleReset();
        },
        [hasUnsavedWork, handleReset]
    );

    // ========================================================================
    // Helpers
    // ========================================================================

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

    // Mode-specific labels
    const actioningLabel =
        mode === "knowledge-only" ? "Extracting knowledge..." : "Importing...";

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className={cn("space-y-6", className)}>
            {/* Provider Tabs */}
            {showProviderTabs && state === "idle" && (
                <Tabs
                    value={selectedProvider}
                    onValueChange={(value: string) =>
                        handleSelectProvider(value as Provider)
                    }
                >
                    <TabsList className="grid w-full max-w-xs grid-cols-2">
                        {PROVIDER_ORDER.map((key) => {
                            const provider = PROVIDERS[key];
                            return (
                                <TabsTrigger
                                    key={key}
                                    value={key}
                                    className="flex items-center gap-2"
                                >
                                    <div className="relative h-4 w-4 overflow-hidden rounded">
                                        <Image
                                            src={provider.logo}
                                            alt={provider.name}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    {provider.name}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </Tabs>
            )}

            {/* Upload UI */}
            {state === "idle" && (
                <div className="space-y-4">
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

                    <div
                        className={cn(
                            "cursor-pointer rounded-lg border-2 border-dashed text-center transition-colors",
                            "bg-background/80 backdrop-blur-sm",
                            compact ? "p-8" : "p-12",
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
                            className={cn(
                                "text-muted-foreground mx-auto",
                                compact ? "h-8 w-8" : "h-12 w-12"
                            )}
                            weight="duotone"
                        />
                        <p className="text-muted-foreground mt-4">
                            Drop your {currentProvider.name} export here, or{" "}
                            <span className="text-primary font-medium">
                                click to browse
                            </span>
                        </p>
                    </div>

                    {onCancel && (
                        <div className="flex justify-end">
                            <Button variant="ghost" onClick={onCancel}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Loading State */}
            {(state === "uploading" || state === "parsing") && (
                <Card>
                    <CardContent className={cn(compact ? "py-8" : "py-12")}>
                        <div className="flex flex-col items-center justify-center text-center">
                            <LoadingSpinner size={compact ? 32 : 48} />
                            <p className="mt-4 font-medium">
                                {state === "uploading"
                                    ? "Uploading..."
                                    : "Reading your history..."}
                            </p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                This is worth doing carefully.
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="text-muted-foreground mt-4"
                            >
                                Cancel
                            </Button>
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
                            <div className="mt-4 flex gap-2">
                                <Button
                                    variant="default"
                                    onClick={handleRetryFromError}
                                >
                                    {parsedData ? "Back to Preview" : "Try again"}
                                </Button>
                                {parsedData && (
                                    <Button variant="outline" onClick={handleReset}>
                                        Start Over
                                    </Button>
                                )}
                            </div>
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
                                    <p className="font-medium">Found your history</p>
                                    <p className="text-muted-foreground text-sm">
                                        {parsedData.stats.conversationCount.toLocaleString()}{" "}
                                        conversations with{" "}
                                        {parsedData.stats.totalMessageCount.toLocaleString()}{" "}
                                        messages
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mode indicator for knowledge-only */}
                    {mode === "knowledge-only" && (
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="py-4">
                                <div className="flex items-center gap-3">
                                    <BrainIcon className="text-primary h-6 w-6" />
                                    <div>
                                        <p className="text-sm font-medium">
                                            Knowledge extraction mode
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            We&apos;ll extract insights and add them to
                                            your knowledge base
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Stats */}
                    {!compact && (
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
                                                Conversations
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
                    )}

                    {/* Filters */}
                    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                        <div className="flex items-center justify-between">
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <FunnelIcon className="h-4 w-4" />
                                    Filter Conversations
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
                                                        onChange={(e) =>
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
                                                        onChange={(e) =>
                                                            setFilters((f) => ({
                                                                ...f,
                                                                dateEnd: e.target.value,
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
                                                        onChange={(e) =>
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
                                                        onChange={(e) =>
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
                                                    onChange={(e) =>
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
                                                    onChange={(e) =>
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

                                        {/* Custom GPT Filter */}
                                        {selectedProvider === "chatgpt" && (
                                            <div className="space-y-2 sm:col-span-2">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.customGptOnly}
                                                        onChange={(e) =>
                                                            setFilters((f) => ({
                                                                ...f,
                                                                customGptOnly:
                                                                    e.target.checked,
                                                            }))
                                                        }
                                                        className="h-4 w-4 rounded border-gray-300"
                                                    />
                                                    <span className="text-sm">
                                                        Only Custom GPT conversations
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
                                    <CardTitle>
                                        {mode === "knowledge-only"
                                            ? "Conversations to Analyze"
                                            : "Conversations to Import"}
                                    </CardTitle>
                                    <CardDescription>
                                        {hasActiveFilters ? (
                                            <>
                                                Showing{" "}
                                                {filteredConversations.length.toLocaleString()}{" "}
                                                of{" "}
                                                {fullConversations.length.toLocaleString()}{" "}
                                                conversations
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
                                        No conversations match those filters
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
                                <div
                                    className={cn(
                                        "space-y-2 overflow-y-auto",
                                        compact ? "max-h-64" : "max-h-96"
                                    )}
                                >
                                    {filteredConversations.slice(0, 50).map((conv) => (
                                        <div
                                            key={conv.id}
                                            className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">
                                                    {conv.title}
                                                </p>
                                                <p className="text-muted-foreground text-sm">
                                                    {conv.messageCount} messages ·{" "}
                                                    {formatDate(conv.createdAt)}
                                                    {conv.model && ` · ${conv.model}`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredConversations.length > 50 && (
                                        <p className="text-muted-foreground py-2 text-center text-sm">
                                            ...and {filteredConversations.length - 50}{" "}
                                            more conversations
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
                            onClick={
                                mode === "knowledge-only"
                                    ? handleExtractKnowledge
                                    : handleImport
                            }
                            className="gap-2"
                            disabled={filteredConversations.length === 0}
                        >
                            {mode === "knowledge-only" ? (
                                <>
                                    <BrainIcon className="h-4 w-4" />
                                    Extract Knowledge
                                </>
                            ) : (
                                <>
                                    Import{" "}
                                    {hasActiveFilters
                                        ? `${filteredConversations.length.toLocaleString()} Conversations`
                                        : "All"}
                                    <ArrowRightIcon className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Importing / Extracting State */}
            {(state === "importing" || state === "extracting") && (
                <Card>
                    <CardContent className={cn(compact ? "py-8" : "py-12")}>
                        <div className="flex flex-col items-center justify-center text-center">
                            <LoadingSpinner size={compact ? 32 : 48} />
                            <p className="mt-4 font-medium">{actioningLabel}</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                This is worth doing carefully.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Success State - Discovery Flow (Full Mode) */}
            {state === "success" && importResult && mode === "full" && (
                <>
                    {showStepper && (
                        <ImportStepper currentStep={currentStep} className="mb-8" />
                    )}

                    {error && (
                        <Card className="mb-6 border-red-500/30 bg-red-500/5">
                            <CardContent className="flex items-center justify-between py-4">
                                <p className="text-sm text-red-600">{error}</p>
                                {discoveryState === "idle" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setError(null);
                                            setDiscoveryState("invited");
                                        }}
                                        className="ml-4 shrink-0"
                                    >
                                        Try Discovery Again
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Phase 1: Discovery Invitation */}
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
                            onError={handleDiscoveryError}
                        />
                    )}

                    {/* Phase 3: Discovery Complete */}
                    {discoveryState === "complete" && extractionStats && (
                        <DiscoveryComplete
                            stats={extractionStats}
                            onKeepEverything={handleKeepEverything}
                            isApproving={isApprovingAll}
                        />
                    )}

                    {/* Fallback: Simple success (no discovery or skipped) */}
                    {discoveryState === "idle" && (
                        <Card className="border-green-500/30 bg-green-500/5">
                            <CardContent className={cn(compact ? "py-8" : "py-12")}>
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
                                        messages
                                        {importResult.skippedDuplicates > 0 && (
                                            <span className="mt-1 block">
                                                (Already had{" "}
                                                {importResult.skippedDuplicates} of
                                                these)
                                            </span>
                                        )}
                                    </p>
                                    <div className="mt-6 flex gap-3">
                                        <Button variant="outline" onClick={handleReset}>
                                            Import More
                                        </Button>
                                        {onSuccess ? (
                                            <Button
                                                onClick={() => onSuccess(importResult)}
                                            >
                                                Done
                                            </Button>
                                        ) : (
                                            <Button onClick={() => router.push("/")}>
                                                Start connecting
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Knowledge-Only Discovery Flow */}
            {discoveryState === "processing" &&
                discoveryJobId &&
                mode === "knowledge-only" && (
                    <>
                        {showStepper && (
                            <ImportStepper currentStep={currentStep} className="mb-8" />
                        )}
                        <DiscoveryProgress
                            jobId={discoveryJobId}
                            totalConversations={filteredConversations.length}
                            onComplete={handleDiscoveryComplete}
                            onError={handleDiscoveryError}
                        />
                    </>
                )}

            {discoveryState === "complete" &&
                extractionStats &&
                mode === "knowledge-only" && (
                    <>
                        {showStepper && (
                            <ImportStepper currentStep={currentStep} className="mb-8" />
                        )}
                        <DiscoveryComplete
                            stats={extractionStats}
                            onKeepEverything={handleKeepEverything}
                            isApproving={isApprovingAll}
                        />
                    </>
                )}
        </div>
    );
}
