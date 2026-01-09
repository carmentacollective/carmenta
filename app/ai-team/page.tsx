"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
    UsersIcon,
    SparkleIcon,
    BellIcon,
    LightningIcon,
    GearIcon,
    PlusIcon,
    ClockIcon,
    WarningCircleIcon,
    CheckCircleIcon,
    BroadcastIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { JobProgressViewer } from "@/components/ai-team/job-progress-viewer";
import { LabelToggle } from "@/components/ui/label-toggle";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
    CarmentaSidecar,
    CarmentaToggle,
    useDesktopSidecarMargin,
    type SidecarWelcomeConfig,
} from "@/components/carmenta-assistant";
import { RobotIcon, PlayIcon, WrenchIcon } from "@phosphor-icons/react";
import { logger } from "@/lib/client-logger";

/**
 * Activity feed item from job runs
 */
interface ActivityItem {
    id: string;
    jobId: string;
    jobName: string;
    jobSlug: string;
    jobEncodedId: string;
    summary: string;
    status: "completed" | "failed" | "running";
    completedAt: Date | null;
    notificationCount: number;
    activeStreamId: string | null;
}

/**
 * Automation (scheduled job) with status
 */
interface Automation {
    id: string; // UUID for API calls
    encodedId: string; // Sqid for URLs
    slug: string; // Name slug for URLs
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
 * Page context for Carmenta
 */
const PAGE_CONTEXT = `User is on the AI Team page. They manage automated agents that run on schedules. They can ask to update agent configurations and prompts, run jobs manually, enable/disable automations, configure SMS notifications, or troubleshoot issues with their agents. Available automations and recent activity are shown on this page.`;

/**
 * AI Team-specific welcome configuration for the sidecar
 */
const AI_TEAM_WELCOME: SidecarWelcomeConfig = {
    heading: "Digital Chief of Staff",
    subtitle: "Let's manage your agents together",
    placeholder: "What should we work on?",
    suggestions: [
        {
            id: "run-agent",
            label: "Run an agent now",
            prompt: "I want to run one of my agents manually right now.",
            icon: PlayIcon,
            autoSubmit: false,
        },
        {
            id: "troubleshoot",
            label: "Something isn't working",
            prompt: "One of my agents isn't running correctly or I'm not getting the results I expected. Can you help me troubleshoot?",
            icon: WrenchIcon,
            autoSubmit: false,
        },
        {
            id: "new-agent",
            label: "Create a new agent",
            prompt: "I want to set up a new automated agent. What kinds of things can agents do for me?",
            icon: RobotIcon,
            autoSubmit: true,
        },
    ],
};

/**
 * Content component with all the UI logic
 */
function AITeamContent({
    refreshKey,
    onChangesComplete,
}: {
    refreshKey: number;
    onChangesComplete: () => void;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingJobs, setTogglingJobs] = useState<Set<string>>(new Set());
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [viewingActivity, setViewingActivity] = useState<ActivityItem | null>(null);

    // Carmenta sheet state
    const [carmentaOpen, setCarmentaOpen] = useState(false);

    // Handle success states from redirects
    useEffect(() => {
        if (!searchParams) return;

        const hired = searchParams.get("hired");
        const updated = searchParams.get("updated");
        const deleted = searchParams.get("deleted");

        if (hired === "true") {
            setSuccessMessage("New team member hired successfully!");
        } else if (updated === "true") {
            setSuccessMessage("Automation updated successfully!");
        } else if (deleted === "true") {
            setSuccessMessage("Automation deleted.");
        }

        // Clear the query params without triggering a refresh
        if (hired || updated || deleted) {
            router.replace("/ai-team", { scroll: false });
        }
    }, [searchParams, router]);

    // Auto-dismiss success message
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // Load data effect
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/jobs");
                if (!response.ok) throw new Error("Failed to fetch jobs");

                const data = await response.json();

                // Transform jobs to automations
                const automationList: Automation[] = data.jobs.map(
                    (job: {
                        id: string;
                        encodedId: string;
                        slug: string;
                        name: string;
                        prompt: string;
                        scheduleCron: string;
                        isActive: boolean;
                        lastRunAt: string | null;
                        nextRunAt: string | null;
                    }) => ({
                        id: job.id,
                        encodedId: job.encodedId,
                        slug: job.slug,
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
                            jobSlug: job.slug,
                            jobEncodedId: job.encodedId,
                            summary: run.summary ?? "No summary available",
                            status: run.status,
                            completedAt: run.completedAt
                                ? new Date(run.completedAt)
                                : null,
                            notificationCount: run.notificationsSent ?? 0,
                            activeStreamId: run.activeStreamId ?? null,
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
        };

        fetchData();
    }, [refreshKey]);

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

    // Get margin to apply when sidecar is open on desktop
    const sidecarMargin = useDesktopSidecarMargin(carmentaOpen);

    return (
        <StandardPageLayout
            maxWidth="standard"
            contentClassName="space-y-8 py-12"
            style={{
                marginLeft: sidecarMargin,
                transition: "margin-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
        >
            {/* Header */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 rounded-xl p-3">
                            <UsersIcon className="text-primary h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-foreground text-3xl font-light tracking-tight">
                                AI Team
                            </h1>
                            <p className="text-foreground/70">
                                Working in the background for us.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <CarmentaToggle
                            isOpen={carmentaOpen}
                            onClick={() => setCarmentaOpen(!carmentaOpen)}
                        />
                        <Link
                            href="/ai-team/hire"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Hire
                        </Link>
                    </div>
                </div>
            </section>

            {/* Success message banner */}
            {successMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-green-500/10 p-4 text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span className="font-medium">{successMessage}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-4">
                        <SparkleIcon className="text-primary h-8 w-8 animate-pulse" />
                        <p className="text-foreground/60">Loading your AI team...</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Main column - Activity Feed */}
                    <div className="space-y-6 lg:col-span-2">
                        {/* Notifications banner */}
                        {unreadNotificationCount > 0 && (
                            <div className="bg-primary/10 text-primary flex items-center gap-3 rounded-xl p-4">
                                <BellIcon className="h-5 w-5" />
                                <span className="font-medium">
                                    {unreadNotificationCount} item
                                    {unreadNotificationCount !== 1 ? "s" : ""} need
                                    attention
                                </span>
                            </div>
                        )}

                        {/* What's Happening */}
                        <div className="space-y-4">
                            <h2 className="text-foreground flex items-center gap-2 text-xl font-medium">
                                <LightningIcon className="text-primary h-5 w-5" />
                                What's Happening
                            </h2>

                            {activities.length === 0 ? (
                                <div className="border-foreground/5 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-2xl border py-12 text-center">
                                    <ClockIcon className="text-foreground/30 mb-4 h-10 w-10" />
                                    <p className="text-foreground/60">
                                        No activity yet. Your automations will show up
                                        here.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map((activity) => {
                                        const isClickable =
                                            activity.status !== "running";
                                        const content = (
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3">
                                                    {activity.status === "completed" ? (
                                                        <CheckCircleIcon className="mt-0.5 h-5 w-5 text-green-500" />
                                                    ) : activity.status === "failed" ? (
                                                        <WarningCircleIcon className="mt-0.5 h-5 w-5 text-red-500" />
                                                    ) : (
                                                        <SparkleIcon className="text-primary mt-0.5 h-5 w-5 animate-pulse" />
                                                    )}
                                                    <div>
                                                        <p className="text-foreground font-medium">
                                                            {activity.jobName}
                                                        </p>
                                                        <div className="text-foreground/70 text-sm">
                                                            <MarkdownRenderer
                                                                content={
                                                                    activity.summary
                                                                }
                                                                inline
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {activity.status === "running" &&
                                                        activity.activeStreamId && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setViewingActivity(
                                                                        activity
                                                                    );
                                                                }}
                                                                className="text-primary hover:bg-primary/10 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                                                            >
                                                                <BroadcastIcon className="h-3 w-3" />
                                                                Tap In
                                                            </button>
                                                        )}
                                                    <span className="text-foreground/50 text-xs whitespace-nowrap">
                                                        {activity.status === "running"
                                                            ? "Running"
                                                            : formatRelativeTime(
                                                                  activity.completedAt
                                                              )}
                                                    </span>
                                                </div>
                                            </div>
                                        );

                                        return isClickable ? (
                                            <Link
                                                key={activity.id}
                                                href={`/ai-team/${activity.jobSlug}/${activity.jobEncodedId}/runs/${activity.id}`}
                                                className="border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.04] block rounded-xl border p-4 transition-colors"
                                            >
                                                {content}
                                            </Link>
                                        ) : (
                                            <div
                                                key={activity.id}
                                                className="border-foreground/5 bg-foreground/[0.02] rounded-xl border p-4"
                                            >
                                                {content}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Automations */}
                    <div className="space-y-4">
                        <h2 className="text-foreground flex items-center gap-2 text-xl font-medium">
                            <GearIcon className="text-primary h-5 w-5" />
                            Your Automations
                        </h2>

                        {automations.length === 0 ? (
                            <div className="border-foreground/5 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-2xl border py-8 text-center">
                                <UsersIcon className="text-foreground/30 mb-4 h-10 w-10" />
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
                                    <PlusIcon className="h-4 w-4" />
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
                                                href={`/ai-team/${automation.slug}/${automation.encodedId}`}
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
                                            <LabelToggle
                                                checked={automation.isActive}
                                                onChange={() =>
                                                    handleToggleAutomation(automation)
                                                }
                                                disabled={togglingJobs.has(
                                                    automation.id
                                                )}
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Job Progress Viewer Modal */}
            {viewingActivity && (
                <JobProgressViewer
                    jobId={viewingActivity.jobId}
                    runId={viewingActivity.id}
                    jobName={viewingActivity.jobName}
                    onClose={() => setViewingActivity(null)}
                />
            )}

            {/* Carmenta Sidecar for contextual AI Team help */}
            <CarmentaSidecar
                open={carmentaOpen}
                onOpenChange={setCarmentaOpen}
                pageContext={PAGE_CONTEXT}
                onChangesComplete={onChangesComplete}
                welcomeConfig={AI_TEAM_WELCOME}
                title="Digital Chief of Staff"
                description="Let's manage your agents"
            />
        </StandardPageLayout>
    );
}

/**
 * Wrapper that handles refresh after Carmenta makes changes
 */
function AITeamWithCarmenta() {
    const [refreshKey, setRefreshKey] = useState(0);

    const handleChangesComplete = useCallback(() => {
        // Increment key to trigger data refresh in AITeamContent
        setRefreshKey((prev) => prev + 1);
    }, []);

    return (
        <AITeamContent
            refreshKey={refreshKey}
            onChangesComplete={handleChangesComplete}
        />
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
                            <SparkleIcon className="text-primary h-8 w-8 animate-pulse" />
                            <p className="text-foreground/60">
                                Loading your AI team...
                            </p>
                        </div>
                    </div>
                </StandardPageLayout>
            }
        >
            <AITeamWithCarmenta />
        </Suspense>
    );
}
