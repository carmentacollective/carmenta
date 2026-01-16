"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle,
    WarningCircle,
    CircleNotch,
    Clock,
    Wrench,
    Bell,
    ArrowSquareOut,
    Code,
    Cpu,
    ToggleLeft,
    ToggleRight,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { ExecutionTimeline } from "./execution-timeline";
import type {
    JobExecutionTrace,
    JobErrorDetails,
    JobTokenUsage,
} from "@/lib/db/schema";

interface RunDetailData {
    run: {
        id: string;
        status: "pending" | "running" | "completed" | "failed";
        summary: string | null;
        startedAt: string | null;
        completedAt: string | null;
        durationMs: number | null;
        executionTrace: JobExecutionTrace | null;
        errorDetails: JobErrorDetails | null;
        tokenUsage: JobTokenUsage | null;
        modelId: string | null;
        toolCallsExecuted: number;
        notificationsSent: number;
        temporalWorkflowId: string | null;
        sentryTraceId: string | null;
        externalLinks: {
            sentry?: string;
            temporal?: string;
        };
        notifications: Array<{
            id: string;
            title: string;
            body: string;
            priority: string;
            createdAt: string;
        }>;
    };
    job: {
        id: string;
        name: string;
        prompt: string;
    };
}

interface JobRunDetailProps {
    jobId: string;
    runId: string;
    jobSlug: string;
    jobEncodedId: string;
}

export function JobRunDetail({
    jobId,
    runId,
    jobSlug,
    jobEncodedId,
}: JobRunDetailProps) {
    const [data, setData] = useState<RunDetailData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [developerMode, setDeveloperMode] = useState(false);

    // Load developer mode preference
    useEffect(() => {
        const saved = localStorage.getItem("carmenta:developer-mode");
        if (saved === "true") {
            setDeveloperMode(true);
        }
    }, []);

    // Save developer mode preference
    const toggleDeveloperMode = () => {
        const newValue = !developerMode;
        setDeveloperMode(newValue);
        localStorage.setItem("carmenta:developer-mode", String(newValue));
    };

    useEffect(() => {
        async function loadRunDetail() {
            try {
                const response = await fetch(`/api/jobs/${jobId}/runs/${runId}`);
                if (!response.ok) {
                    throw new Error("Failed to load run details");
                }
                const data = await response.json();
                setData(data);
            } catch (err) {
                logger.error({ error: err }, "Failed to load run detail");
                Sentry.captureException(err, {
                    tags: { component: "job-run-detail" },
                    extra: { jobId, runId },
                });
                setError("Failed to load run details");
            } finally {
                setIsLoading(false);
            }
        }

        loadRunDetail();
    }, [jobId, runId]);

    const formatDuration = (ms: number | null) => {
        if (ms === null) return "-";
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatRelativeTime = (dateString: string | null) => {
        if (!dateString) return "Unknown";
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                    <CircleNotch className="text-primary h-8 w-8 animate-spin" />
                    <p className="text-foreground/60">Loading run details...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                    <WarningCircle className="h-8 w-8 text-red-500" />
                    <p className="text-foreground/80">{error ?? "Run not found"}</p>
                    <Link
                        href={`/ai-team/${jobSlug}/${jobEncodedId}`}
                        className="text-primary hover:underline"
                    >
                        Back to automation
                    </Link>
                </div>
            </div>
        );
    }

    const { run, job } = data;
    const hasExternalLinks = run.externalLinks.sentry || run.externalLinks.temporal;

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Header */}
            <div className="space-y-4">
                <Link
                    href={`/ai-team/${jobSlug}/${jobEncodedId}`}
                    className="text-foreground/60 hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to {job.name}
                </Link>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        {run.status === "completed" ? (
                            <CheckCircle className="mt-1 h-6 w-6 text-green-500" />
                        ) : run.status === "failed" ? (
                            <WarningCircle className="mt-1 h-6 w-6 text-red-500" />
                        ) : (
                            <CircleNotch className="text-primary mt-1 h-6 w-6 animate-spin" />
                        )}
                        <div>
                            <h1 className="text-foreground text-2xl font-light">
                                Run Details
                            </h1>
                            <div className="text-foreground/60 mt-1 flex flex-wrap items-center gap-2 text-sm">
                                <span
                                    className={cn(
                                        "rounded-full px-2 py-0.5 text-xs font-medium",
                                        run.status === "completed" &&
                                            "bg-green-500/20 text-green-600",
                                        run.status === "failed" &&
                                            "bg-red-500/20 text-red-600",
                                        run.status === "running" &&
                                            "bg-primary/20 text-primary"
                                    )}
                                >
                                    {run.status}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(
                                        run.completedAt ?? run.startedAt
                                    )}
                                </span>
                                {run.durationMs && (
                                    <span>{formatDuration(run.durationMs)}</span>
                                )}
                                {run.toolCallsExecuted > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Wrench className="h-3 w-3" />
                                        {run.toolCallsExecuted} tool
                                        {run.toolCallsExecuted !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Developer mode toggle */}
                    <button
                        onClick={toggleDeveloperMode}
                        className="text-foreground/60 hover:text-foreground flex items-center gap-2 text-sm transition-colors"
                    >
                        <Code className="h-4 w-4" />
                        Dev Mode
                        {developerMode ? (
                            <ToggleRight className="text-primary h-5 w-5" />
                        ) : (
                            <ToggleLeft className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Error banner for failed runs */}
            {run.status === "failed" && run.errorDetails && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <div className="flex items-start gap-3">
                        <WarningCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                        <div className="min-w-0">
                            <p className="font-medium text-red-600">Execution Failed</p>
                            <p className="text-foreground/80 mt-1 text-sm">
                                {run.errorDetails.message}
                            </p>
                            {developerMode && run.errorDetails.stack && (
                                <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-500/10 p-2 font-mono text-xs text-red-600">
                                    {run.errorDetails.stack}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Summary */}
            <section className="border-foreground/10 rounded-xl border p-4">
                <h2 className="text-foreground mb-3 font-medium">Summary</h2>
                <p className="text-foreground/80 whitespace-pre-wrap">
                    {run.summary ?? "No summary available"}
                </p>
            </section>

            {/* Execution Timeline */}
            {run.executionTrace && (
                <section className="border-foreground/10 rounded-xl border p-4">
                    <h2 className="text-foreground mb-3 font-medium">
                        Execution Timeline
                    </h2>
                    <ExecutionTimeline
                        trace={run.executionTrace}
                        developerMode={developerMode}
                    />
                </section>
            )}

            {/* Notifications sent */}
            {run.notifications.length > 0 && (
                <section className="border-foreground/10 rounded-xl border p-4">
                    <h2 className="text-foreground mb-3 flex items-center gap-2 font-medium">
                        <Bell className="text-primary h-4 w-4" />
                        Notifications Sent ({run.notifications.length})
                    </h2>
                    <div className="space-y-2">
                        {run.notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className="bg-foreground/5 rounded-lg p-3"
                            >
                                <p className="text-foreground text-sm font-medium">
                                    {notification.title}
                                </p>
                                <p className="text-foreground/70 mt-0.5 text-sm">
                                    {notification.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Developer info */}
            {developerMode && (
                <section className="border-foreground/10 rounded-xl border p-4">
                    <h2 className="text-foreground mb-3 flex items-center gap-2 font-medium">
                        <Cpu className="text-primary h-4 w-4" />
                        Developer Info
                    </h2>
                    <div className="space-y-3 text-sm">
                        {/* Model and tokens */}
                        <div className="grid grid-cols-2 gap-4">
                            {run.modelId && (
                                <div>
                                    <p className="text-foreground/60 text-xs">Model</p>
                                    <p className="text-foreground font-mono">
                                        {run.modelId}
                                    </p>
                                </div>
                            )}
                            {run.tokenUsage && (
                                <div>
                                    <p className="text-foreground/60 text-xs">Tokens</p>
                                    <p className="text-foreground font-mono">
                                        {run.tokenUsage.inputTokens.toLocaleString()} in
                                        {" / "}
                                        {run.tokenUsage.outputTokens.toLocaleString()}{" "}
                                        out
                                        {run.tokenUsage.cachedInputTokens
                                            ? ` (${run.tokenUsage.cachedInputTokens.toLocaleString()} cached)`
                                            : ""}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* External links */}
                        {hasExternalLinks && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {run.externalLinks.sentry && (
                                    <a
                                        href={run.externalLinks.sentry}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:bg-primary/10 flex items-center gap-1 rounded-lg border border-current px-3 py-1.5 text-sm transition-colors"
                                    >
                                        View in Sentry
                                        <ArrowSquareOut className="h-3 w-3" />
                                    </a>
                                )}
                                {run.externalLinks.temporal && (
                                    <a
                                        href={run.externalLinks.temporal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:bg-primary/10 flex items-center gap-1 rounded-lg border border-current px-3 py-1.5 text-sm transition-colors"
                                    >
                                        View in Temporal
                                        <ArrowSquareOut className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Raw trace */}
                        {run.executionTrace && (
                            <details className="pt-2">
                                <summary className="text-foreground/60 hover:text-foreground cursor-pointer text-xs">
                                    Raw Execution Trace
                                </summary>
                                <pre className="bg-foreground/5 mt-2 max-h-60 overflow-auto rounded-lg p-3 font-mono text-xs">
                                    {JSON.stringify(run.executionTrace, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
