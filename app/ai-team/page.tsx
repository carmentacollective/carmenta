"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
    UsersIcon,
    SparkleIcon,
    BellIcon,
    LightningIcon,
    PlusIcon,
    ClockIcon,
    WarningCircleIcon,
    CheckCircleIcon,
    BroadcastIcon,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { JobProgressViewer } from "@/components/ai-team/job-progress-viewer";
import { LabelToggle } from "@/components/ui/label-toggle";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
    CarmentaSidecar,
    CarmentaToggle,
    type SidecarWelcomeConfig,
} from "@/components/carmenta-assistant";
import type { Playbook } from "@/components/connection";
import { PlaybookPreviewCard } from "@/components/ai-team/playbook-preview-card";
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
const PAGE_CONTEXT = `User is on the AI Team page. They manage automated agents that run on schedules. They can ask to update agent configurations and prompts, run jobs manually, enable/disable automations, configure SMS notifications, or troubleshoot issues with their agents. Available automations and activity are shown on this page.`;

/**
 * AI Team-specific welcome configuration for the sidecar
 */
const AI_TEAM_WELCOME: SidecarWelcomeConfig = {
    heading: "Digital Chief of Staff",
    subtitle: "Let's manage your agents together",
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
 * Hire mode welcome configuration
 */
const HIRE_WELCOME: SidecarWelcomeConfig = {
    heading: "Hire a New Team Member",
    subtitle: "Describe what you need and we'll set it up",
    suggestions: [
        {
            id: "email-triage",
            label: "Email triage",
            prompt: "Check my email every morning and flag what matters",
            icon: BellIcon,
            autoSubmit: false,
        },
        {
            id: "competitor-monitor",
            label: "Monitor competitors",
            prompt: "Monitor competitor news and summarize weekly",
            icon: LightningIcon,
            autoSubmit: false,
        },
        {
            id: "slack-triage",
            label: "Slack triage",
            prompt: "Triage my Slack DMs and surface the urgent ones",
            icon: BroadcastIcon,
            autoSubmit: false,
        },
    ],
};

/**
 * Page context for hire mode
 */
const HIRE_PAGE_CONTEXT = `User is hiring a new AI team member. Guide them conversationally to understand what they need automated. Ask about: what task, how often it should run, what actions to take, and what integrations are needed. When you have enough info, signal readiness with READY_TO_HIRE.`;

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
    const [activityFilter, setActivityFilter] = useState<string | null>(null);
    const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
        new Set()
    );

    // Compute unique job names for filter chips (sorted for stability)
    const uniqueJobNames = Array.from(new Set(activities.map((a) => a.jobName)))
        .sort()
        .slice(0, 4);

    // Filter activities based on selected filter
    const filteredActivities =
        activityFilter === null
            ? activities
            : activities.filter((a) => a.jobName === activityFilter);

    // Clear expanded state when filter changes
    useEffect(() => {
        setExpandedActivities(new Set());
    }, [activityFilter]);

    // Clear filter if selected filter is no longer in visible chips
    useEffect(() => {
        if (activityFilter !== null && !uniqueJobNames.includes(activityFilter)) {
            setActivityFilter(null);
        }
    }, [uniqueJobNames, activityFilter]);

    // Toggle expanded state for an activity
    const toggleActivityExpanded = (activityId: string) => {
        setExpandedActivities((prev) => {
            const next = new Set(prev);
            if (next.has(activityId)) {
                next.delete(activityId);
            } else {
                next.add(activityId);
            }
            return next;
        });
    };

    // Carmenta sidecar state
    const [carmentaOpen, setCarmentaOpen] = useState(false);
    const [hireMode, setHireMode] = useState(false);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [isHiring, setIsHiring] = useState(false);

    // Track timeout for hire mode reset to prevent race conditions
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Start hire mode - opens sidecar with hire config
    const handleStartHire = useCallback(() => {
        // Cancel any pending reset
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
        }
        setHireMode(true);
        setPlaybook(null);
        setCarmentaOpen(true);
    }, []);

    // Close sidecar and reset hire state
    const handleCloseSidecar = useCallback((open: boolean) => {
        setCarmentaOpen(open);
        if (!open) {
            // Reset hire mode after animation, cancel any existing timeout
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
            }
            resetTimeoutRef.current = setTimeout(() => {
                setHireMode(false);
                setPlaybook(null);
                resetTimeoutRef.current = null;
            }, 300);
        } else {
            // Opening - cancel any pending reset
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
                resetTimeoutRef.current = null;
            }
        }
    }, []);

    // Handle playbook extraction from hire wizard
    const handlePlaybookReady = useCallback((newPlaybook: Playbook) => {
        logger.info({ playbookName: newPlaybook.name }, "Playbook ready for hire");
        setPlaybook(newPlaybook);
    }, []);

    // Create the automation from playbook
    const handleHire = useCallback(async () => {
        if (!playbook || isHiring) return;

        setIsHiring(true);

        try {
            const response = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: playbook.name,
                    prompt: playbook.prompt,
                    scheduleCron: playbook.schedule.cron,
                    scheduleDisplayText: playbook.schedule.displayText,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (!response.ok) {
                let errorMessage = "Failed to create automation";
                try {
                    const error = await response.json();
                    errorMessage = error.error ?? errorMessage;
                } catch {
                    // Failed to parse error response
                }
                throw new Error(errorMessage);
            }

            // Success - close sidecar and show toast
            setCarmentaOpen(false);
            setHireMode(false);
            setPlaybook(null);
            toast.success("New team member hired!");
            onChangesComplete();
        } catch (error) {
            logger.error({ error }, "Failed to hire automation");
            toast.error("Failed to create automation. Please try again.");
            Sentry.captureException(error, {
                tags: { component: "ai-team-page", action: "hire" },
            });
        } finally {
            setIsHiring(false);
        }
    }, [playbook, isHiring, onChangesComplete]);

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

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="space-y-8 py-12">
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
                            onClick={() => handleCloseSidecar(!carmentaOpen)}
                        />
                        <button
                            onClick={handleStartHire}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Hire
                        </button>
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
            ) : automations.length === 0 ? (
                /* Welcome state - consolidated CTA for first-time users */
                <div className="glass-panel mx-auto max-w-2xl px-8 py-16 text-center">
                    <div className="bg-primary/10 mx-auto mb-6 w-fit rounded-2xl p-4">
                        <UsersIcon className="text-primary h-12 w-12" />
                    </div>
                    <h2 className="text-foreground mb-3 text-2xl font-medium">
                        Build your AI team
                    </h2>
                    <p className="text-foreground/60 mx-auto mb-8 max-w-md text-lg">
                        Hire team members who work on schedules—monitoring, research,
                        updates, anything that runs automatically while we focus
                        elsewhere.
                    </p>
                    <button
                        onClick={handleStartHire}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Hire Your First Team Member
                    </button>
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

                        {/* Activity Section */}
                        <div id="activity" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-foreground flex items-center gap-2 text-xl font-medium">
                                    <LightningIcon className="text-primary h-5 w-5" />
                                    Activity
                                </h2>
                                {/* Filter chips for multi-agent filtering */}
                                {activities.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setActivityFilter(null)}
                                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                                activityFilter === null
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                                            }`}
                                        >
                                            All
                                        </button>
                                        {uniqueJobNames.map((jobName) => (
                                            <button
                                                key={jobName}
                                                onClick={() =>
                                                    setActivityFilter(jobName)
                                                }
                                                className={`max-w-[120px] truncate rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                                    activityFilter === jobName
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                                                }`}
                                                title={jobName}
                                            >
                                                {jobName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {activities.length === 0 ? (
                                <div className="glass-panel flex flex-col items-center justify-center py-12 text-center">
                                    <ClockIcon className="text-foreground/30 mb-4 h-10 w-10" />
                                    <p className="text-foreground/60">
                                        Your team hasn't run yet. Activity will appear
                                        here as they work.
                                    </p>
                                </div>
                            ) : filteredActivities.length === 0 ? (
                                <div className="glass-panel flex flex-col items-center justify-center py-8 text-center">
                                    <p className="text-foreground/60">
                                        No activity found for this filter.
                                    </p>
                                    <button
                                        onClick={() => setActivityFilter(null)}
                                        className="text-primary mt-2 text-sm font-medium hover:underline"
                                    >
                                        Clear filter
                                    </button>
                                </div>
                            ) : (
                                <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                                    {filteredActivities.map((activity) => {
                                        const isClickable =
                                            activity.status !== "running";
                                        const isExpanded = expandedActivities.has(
                                            activity.id
                                        );

                                        const content = (
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                                    {activity.status === "completed" ? (
                                                        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                                                    ) : activity.status === "failed" ? (
                                                        <WarningCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                                                    ) : (
                                                        <SparkleIcon className="text-primary mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-foreground font-medium">
                                                            {activity.jobName}
                                                        </p>
                                                        <div
                                                            className={`text-foreground/70 text-sm ${
                                                                isExpanded
                                                                    ? ""
                                                                    : "line-clamp-2"
                                                            }`}
                                                        >
                                                            <MarkdownRenderer
                                                                content={
                                                                    activity.summary
                                                                }
                                                                inline
                                                            />
                                                        </div>
                                                        {/* Expand/collapse toggle */}
                                                        {activity.summary.length >
                                                            100 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    toggleActivityExpanded(
                                                                        activity.id
                                                                    );
                                                                }}
                                                                className="text-primary mt-1 text-xs font-medium hover:underline"
                                                            >
                                                                {isExpanded
                                                                    ? "Show less"
                                                                    : "Show more"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
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
                                                className="glass-panel block p-4 transition-all hover:scale-[1.01] hover:shadow-md"
                                            >
                                                {content}
                                            </Link>
                                        ) : (
                                            <div
                                                key={activity.id}
                                                className="glass-panel p-4"
                                            >
                                                {content}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Team Members */}
                    <div className="space-y-4">
                        <h2 className="text-foreground flex items-center gap-2 text-xl font-medium">
                            <UsersIcon className="text-primary h-5 w-5" />
                            Your Team
                        </h2>

                        <div className="space-y-3">
                            {automations.map((automation) => (
                                <div
                                    key={automation.id}
                                    className="glass-panel group p-4 transition-all hover:scale-[1.01] hover:shadow-md"
                                >
                                    <div className="flex items-center justify-between">
                                        <Link
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
                                        </Link>
                                        <LabelToggle
                                            checked={automation.isActive}
                                            onChange={() =>
                                                handleToggleAutomation(automation)
                                            }
                                            loading={togglingJobs.has(automation.id)}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
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

            {/* Carmenta Sidecar for contextual AI Team help + hire mode */}
            {/* Key forces remount when mode changes to clear chat state */}
            <CarmentaSidecar
                key={hireMode ? "hire" : "manage"}
                open={carmentaOpen}
                onOpenChange={handleCloseSidecar}
                pageContext={hireMode ? HIRE_PAGE_CONTEXT : PAGE_CONTEXT}
                onChangesComplete={onChangesComplete}
                welcomeConfig={hireMode ? HIRE_WELCOME : AI_TEAM_WELCOME}
                title={hireMode ? "Hire a New Team Member" : "Digital Chief of Staff"}
                description={
                    hireMode ? "Describe what you need" : "Let's manage your agents"
                }
                endpoint={hireMode ? "/api/ai-team/hire" : "/api/dcos"}
                onPlaybookReady={hireMode ? handlePlaybookReady : undefined}
                auxiliaryContent={
                    hireMode && playbook ? (
                        <PlaybookPreviewCard
                            playbook={playbook}
                            onHire={handleHire}
                            isHiring={isHiring}
                        />
                    ) : undefined
                }
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
