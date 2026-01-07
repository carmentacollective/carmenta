"use client";

import { useState, useCallback, useRef } from "react";
import {
    UploadIcon,
    FileZipIcon,
    CheckCircleIcon,
    WarningCircleIcon,
    SpinnerIcon,
    ChatCircleDotsIcon,
    CalendarIcon,
    ArrowRightIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import type { ImportParseResponse } from "@/app/api/import/chatgpt/route";

type ImportState = "idle" | "uploading" | "parsing" | "preview" | "error";

interface ParsedData {
    importId: string;
    conversations: ImportParseResponse["conversations"];
    stats: ImportParseResponse["stats"];
}

/**
 * Import page for bringing data from other AI platforms into Carmenta
 */
export default function ImportPage() {
    const [state, setState] = useState<ImportState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        if (!file.name.endsWith(".zip")) {
            setError(
                "Please upload a ZIP file. ChatGPT exports are downloaded as .zip files."
            );
            setState("error");
            return;
        }

        // 100MB limit
        if (file.size > 100 * 1024 * 1024) {
            setError(
                `File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 100MB.`
            );
            setState("error");
            return;
        }

        setState("uploading");
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            setState("parsing");

            const response = await fetch("/api/import/chatgpt", {
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
            setState("preview");

            logger.info(
                { conversationCount: data.stats.conversationCount },
                "ChatGPT export parsed successfully"
            );
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to parse export";
            setError(message);
            setState("error");
            logger.error({ error: err }, "Failed to parse ChatGPT export");
            Sentry.captureException(err, {
                tags: { component: "import", platform: "chatgpt" },
            });
        }
    }, []);

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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

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

    return (
        <StandardPageLayout maxWidth="standard" verticalPadding="normal">
            <div className="space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                            <UploadIcon className="h-5 w-5" weight="duotone" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Import Data
                        </h1>
                    </div>
                    <p className="text-muted-foreground max-w-2xl">
                        Bring your AI history to Carmenta. We&apos;ll import your
                        conversations so you don&apos;t have to start over.
                    </p>
                </div>

                {/* Main Content */}
                {state === "idle" && (
                    <div className="space-y-6">
                        {/* ChatGPT Import Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ChatCircleDotsIcon
                                        className="h-5 w-5"
                                        weight="duotone"
                                    />
                                    Import from ChatGPT
                                </CardTitle>
                                <CardDescription>
                                    Upload your ChatGPT data export to import your
                                    conversation history.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Instructions */}
                                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                                    <p className="text-muted-foreground mb-3 font-medium">
                                        How to export from ChatGPT:
                                    </p>
                                    <ol className="text-muted-foreground list-inside list-decimal space-y-1.5">
                                        <li>Open ChatGPT and go to Settings</li>
                                        <li>Click &quot;Data Controls&quot;</li>
                                        <li>Click &quot;Export Data&quot;</li>
                                        <li>
                                            Wait for the email (usually 5-30 minutes)
                                        </li>
                                        <li>Download and upload the ZIP file here</li>
                                    </ol>
                                </div>

                                {/* Upload Zone */}
                                <div
                                    className={cn(
                                        "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                                        isDragging
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50 hover:bg-muted/30"
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
                                        Drag and drop your ChatGPT export ZIP file here,
                                        or{" "}
                                        <span className="text-primary font-medium">
                                            click to browse
                                        </span>
                                    </p>
                                    <p className="text-muted-foreground/70 mt-2 text-sm">
                                        Maximum file size: 100MB
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Coming Soon */}
                        <div className="text-muted-foreground border-border/50 rounded-lg border p-4 text-center text-sm">
                            <p>
                                <span className="font-medium">Coming soon:</span> Import
                                from Claude, Gemini, and other AI platforms
                            </p>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {(state === "uploading" || state === "parsing") && (
                    <Card>
                        <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center text-center">
                                <SpinnerIcon
                                    className="text-primary h-10 w-10 animate-spin"
                                    weight="bold"
                                />
                                <p className="mt-4 font-medium">
                                    {state === "uploading"
                                        ? "Uploading..."
                                        : "Reading your export..."}
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    This may take a moment for large exports
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
                                        <p className="font-medium">
                                            Export parsed successfully
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            Found{" "}
                                            {parsedData.stats.conversationCount.toLocaleString()}{" "}
                                            conversations with{" "}
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
                                        <ChatCircleDotsIcon className="text-muted-foreground h-5 w-5" />
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
                                        <ChatCircleDotsIcon className="text-muted-foreground h-5 w-5" />
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
                                        <CalendarIcon className="text-muted-foreground h-5 w-5" />
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

                        {/* Conversation Preview */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Conversations to Import</CardTitle>
                                <CardDescription>
                                    Preview of your conversations. Click import to add
                                    them to Carmenta.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-96 space-y-2 overflow-y-auto">
                                    {parsedData.conversations
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
                                                        {conv.messageCount} messages ·{" "}
                                                        {formatDate(conv.createdAt)}
                                                        {conv.model &&
                                                            ` · ${conv.model}`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    {parsedData.conversations.length > 50 && (
                                        <p className="text-muted-foreground py-2 text-center text-sm">
                                            ...and{" "}
                                            {parsedData.conversations.length - 50} more
                                            conversations
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={handleReset}>
                                Cancel
                            </Button>
                            <Button disabled className="gap-2">
                                Import All Conversations
                                <ArrowRightIcon className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Coming Soon Notice */}
                        <p className="text-muted-foreground text-center text-sm">
                            Full import functionality coming soon. For now, you can
                            preview your export data.
                        </p>
                    </div>
                )}
            </div>
        </StandardPageLayout>
    );
}
