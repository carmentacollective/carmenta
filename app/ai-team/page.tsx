"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    Users,
    Sparkles,
    Bell,
    Zap,
    Settings,
    Plus,
    ToggleLeft,
    ToggleRight,
    Clock,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
} from "lucide-react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { logger } from "@/lib/client-logger";

/**
 * Activity feed item from job runs
 */
interface ActivityItem {
    id: string;
    jobId: string;
    jobName: string;
    summary: string;
    status: "completed" | "failed" | "running";
    completedAt: Date | null;
    notificationCount: number;
}

/**
 * Automation (scheduled job) with status
 */
interface Automation {
    id: string;
    name: string;
    prompt: string;
    scheduleCron: string;
    isActive: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
}

/**
 * Notification for user attention
 */
interface Notification {
    id: string;
    title: string;
    body: string;
    priority: "low" | "normal" | "high" | "urgent";
    jobName: string;
    createdAt: Date;
    readAt: Date | null;
}

/**
 * Content component with all the UI logic
 */
function AITeamContent() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingJobs, setTogglingJobs] = useState<Set<string>>(new Set());

    const loadData = useCallback(async () => {
        try {
            const response = await fetch("/api/jobs");
            if (!response.ok) throw new Error("Failed to fetch jobs");

            const data = await response.json();

            // Transform jobs to automations
            const automationList: Automation[] = data.jobs.map(
                (job: {
                    id: string;
                    name: string;
                    prompt: string;
                    scheduleCron: string;
                    isActive: boolean;
                    lastRunAt: string | null;
                    nextRunAt: string | null;
                }) => ({
                    id: job.id,
                    name: job.name,
                    prompt: job.prompt,
                    scheduleCron: job.scheduleCron,
                    isActive: job.isActive,
                    lastRunAt: job.lastRunAt ? new Date(job.lastRunAt) : null,
                    nextRunAt: job.nextRunAt ? new Date(job.nextRunAt) : null,
                })
            );

            // Extract recent activities from job runs
            const activityList: ActivityItem[] = [];
            const notificationList: Notification[] = [];

            for (const job of data.jobs) {
                for (const run of job.runs ?? []) {
                    activityList.push({
                        id: run.id,
                        jobId: job.id,
                        jobName: job.name,
                        summary: run.summary ?? "No summary available",
                        status: run.status,
                        completedAt: run.completedAt ? new Date(run.completedAt) : null,
                        notificationCount: run.notificationsSent ?? 0,
                    });
                }
                for (const notification of job.notifications ?? []) {
                    notificationList.push({
                        id: notification.id,
                        title: notification.title,
                        body: notification.body,
                        priority: notification.priority,
                        jobName: job.name,
                        createdAt: new Date(notification.createdAt),
                        readAt: notification.readAt
                            ? new Date(notification.readAt)
                            : null,
                    });
                }
            }

            // Sort by most recent
            activityList.sort((a, b) => {
                const aTime = a.completedAt?.getTime() ?? 0;
                const bTime = b.completedAt?.getTime() ?? 0;
                return bTime - aTime;
            });

            setAutomations(automationList);
            setActivities(activityList.slice(0, 10));
            setNotifications(notificationList.filter((n) => !n.readAt));
        } catch (error) {
            logger.error({ error }, "Failed to load AI team data");
            Sentry.captureException(error, {
                tags: { component: "ai-team-page", action: "load_data" },
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleToggleAutomation = async (automation: Automation) => {
        const newActiveState = !automation.isActive;
        setTogglingJobs((prev) => new Set(prev).add(automation.id));

        // Optimistic update
        setAutomations((prev) =>
            prev.map((a) =>
                a.id === automation.id ? { ...a, isActive: newActiveState } : a
            )
        );

        try {
            const response = await fetch(`/api/jobs/${automation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: newActiveState }),
            });

            if (!response.ok) throw new Error("Failed to toggle automation");
        } catch (error) {
            // Revert optimistic update on failure
            setAutomations((prev) =>
                prev.map((a) =>
                    a.id === automation.id ? { ...a, isActive: automation.isActive } : a
                )
            );

            logger.error(
                { error, automationId: automation.id },
                "Failed to toggle automation"
            );
            Sentry.captureException(error, {
                tags: { component: "ai-team-page", action: "toggle_automation" },
                extra: { automationId: automation.id },
            });
        } finally {
            setTogglingJobs((prev) => {
                const next = new Set(prev);
                next.delete(automation.id);
                return next;
            });
        }
    };

    const formatRelativeTime = (date: Date | null) => {
        if (!date) return "Never";

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

    const formatNextRun = (date: Date | null) => {
        if (!date) return "Not scheduled";

        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (diff < 0) return "Running soon";
        if (minutes < 60) return `in ${minutes}m`;
        if (hours < 24) return `in ${hours}h`;
        return date.toLocaleDateString();
    };

    const unreadNotificationCount = notifications.length;

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="space-y-8 py-12">
            {/* Header */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <Users className="text-primary h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-3xl font-light tracking-tight">
                                AI Team
                            </h1>
                            <p className="text-foreground/70">
                                Your agents are working in the background.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/ai-team/hire"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Hire New
                    </Link>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-4">
                        <Sparkles className="text-primary h-8 w-8 animate-pulse" />
                        <p className="text-foreground/60">Loading your AI team...</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Main column - Activity Feed */}
                    <div className="space-y-6 lg:col-span-2">
                        {/* Notifications banner */}
                        {unreadNotificationCount > 0 && (
                            <div className="bg-primary/10 text-primary flex items-center justify-between rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <Bell className="h-5 w-5" />
                                    <span className="font-medium">
                                        {unreadNotificationCount} item
                                        {unreadNotificationCount !== 1 ? "s" : ""} need
                                        your attention
                                    </span>
                                </div>
                                <ChevronRight className="h-5 w-5" />
                            </div>
                        )}

                        {/* What's Happening */}
                        <div className="space-y-4">
                            <h2 className="text-foreground flex items-center gap-2 text-xl font-medium">
                                <Zap className="text-primary h-5 w-5" />
                                What's Happening
                            </h2>

                            {activities.length === 0 ? (
                                <div className="border-foreground/5 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-2xl border py-12 text-center">
                                    <Clock className="text-foreground/30 mb-4 h-10 w-10" />
                                    <p className="text-foreground/60">
                                        No activity yet. Your automations will show up
                                        here.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="border-foreground/5 bg-foreground/[0.02] rounded-xl border p-4"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3">
                                                    {activity.status === "completed" ? (
                                                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />
                                                    ) : activity.status === "failed" ? (
                                                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
                                                    ) : (
                                                        <Sparkles className="text-primary mt-0.5 h-5 w-5 animate-pulse" />
                                                    )}
                                                    <div>
                                                        <p className="text-foreground font-medium">
                                                            {activity.jobName}
                                                        </p>
                                                        <p className="text-foreground/70 text-sm">
                                                            {activity.summary}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-foreground/50 text-xs whitespace-nowrap">
                                                    {formatRelativeTime(
                                                        activity.completedAt
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Automations */}
                    <div className="space-y-4">
                        <h2 className="text-foreground flex items-center gap-2 text-xl font-medium">
                            <Settings className="text-primary h-5 w-5" />
                            Your Automations
                        </h2>

                        {automations.length === 0 ? (
                            <div className="border-foreground/5 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-2xl border py-8 text-center">
                                <Users className="text-foreground/30 mb-4 h-10 w-10" />
                                <p className="text-foreground/80 font-medium">
                                    No automations yet
                                </p>
                                <p className="text-foreground/60 mt-1 text-sm">
                                    Hire your first team member to get started.
                                </p>
                                <Link
                                    href="/ai-team/hire"
                                    className="text-primary mt-4 flex items-center gap-1 text-sm font-medium hover:underline"
                                >
                                    <Plus className="h-4 w-4" />
                                    Hire Now
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {automations.map((automation) => (
                                    <div
                                        key={automation.id}
                                        className="border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.04] group rounded-xl border p-4 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <a
                                                href={`/ai-team/${automation.id}`}
                                                className="min-w-0 flex-1"
                                            >
                                                <p className="text-foreground group-hover:text-primary truncate font-medium transition-colors">
                                                    {automation.name}
                                                </p>
                                                <p className="text-foreground/50 text-xs">
                                                    {automation.isActive
                                                        ? `Next: ${formatNextRun(automation.nextRunAt)}`
                                                        : "Paused"}
                                                </p>
                                            </a>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleToggleAutomation(automation);
                                                }}
                                                disabled={togglingJobs.has(
                                                    automation.id
                                                )}
                                                className="text-foreground/70 hover:text-foreground p-1 transition-colors disabled:opacity-50"
                                                title={
                                                    automation.isActive
                                                        ? "Pause"
                                                        : "Resume"
                                                }
                                            >
                                                {automation.isActive ? (
                                                    <ToggleRight className="text-primary h-6 w-6" />
                                                ) : (
                                                    <ToggleLeft className="h-6 w-6" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </StandardPageLayout>
    );
}

/**
 * AITeamPage - Main export with Suspense boundary
 */
export default function AITeamPage() {
    return (
        <Suspense
            fallback={
                <StandardPageLayout maxWidth="standard" contentClassName="py-12">
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4">
                            <Sparkles className="text-primary h-8 w-8 animate-pulse" />
                            <p className="text-foreground/60">
                                Loading your AI team...
                            </p>
                        </div>
                    </div>
                </StandardPageLayout>
            }
        >
            <AITeamContent />
        </Suspense>
    );
}
