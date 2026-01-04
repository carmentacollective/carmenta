"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    FloppyDisk,
    Trash,
    WarningCircle,
    Play,
    Sparkle,
} from "@phosphor-icons/react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import { ScheduleEditor } from "@/components/ai-team/schedule-editor";
import { JobProgressViewer } from "@/components/ai-team/job-progress-viewer";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { logger } from "@/lib/client-logger";
import type { PublicJob } from "@/lib/actions/jobs";
import { generateJobSlug } from "@/lib/sqids";

interface EditAutomationFormProps {
    job: PublicJob;
}

/**
 * Client-side form for editing automation settings.
 * Receives server-loaded job data as props.
 */
export function EditAutomationForm({ job }: EditAutomationFormProps) {
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [developerMode, setDeveloperMode] = useState(false);
    const [viewingRun, setViewingRun] = useState<{ id: string } | null>(null);

    // Form state initialized from server data
    const [name, setName] = useState(job.name);
    const [prompt, setPrompt] = useState(job.prompt);
    const [scheduleCron, setScheduleCron] = useState(job.scheduleCron);
    const [scheduleDisplayText, setScheduleDisplayText] = useState(
        job.scheduleDisplayText
    );
    const [timezone, setTimezone] = useState(job.timezone);

    // Load developer mode preference from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("carmenta:developer-mode");
        setDeveloperMode(stored === "true");
    }, []);

    const handleScheduleChange = (schedule: {
        cron: string;
        displayText: string;
        timezone: string;
    }) => {
        setScheduleCron(schedule.cron);
        setScheduleDisplayText(schedule.displayText);
        setTimezone(schedule.timezone);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        try {
            // Use internalId (UUID) for API calls
            const response = await fetch(`/api/jobs/${job.internalId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    prompt,
                    scheduleCron,
                    scheduleDisplayText,
                    timezone,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save changes");
            }

            // Navigate to new canonical URL if name changed
            const newSlug = generateJobSlug(name);
            router.push(`/ai-team/${newSlug}/${job.id}`);
            router.refresh();
        } catch (error) {
            logger.error({ error, jobId: job.internalId }, "Failed to save automation");
            Sentry.captureException(error, {
                tags: { component: "edit-automation-form", action: "save" },
            });
            setError(error instanceof Error ? error.message : "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setShowDeleteConfirm(false);
        setDeleting(true);
        setError(null);

        try {
            // Use internalId (UUID) for API calls
            const response = await fetch(`/api/jobs/${job.internalId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to delete automation");
            }

            router.push("/ai-team?deleted=true");
        } catch (error) {
            logger.error(
                { error, jobId: job.internalId },
                "Failed to delete automation"
            );
            Sentry.captureException(error, {
                tags: { component: "edit-automation-form", action: "delete" },
            });
            setError(
                error instanceof Error ? error.message : "Failed to delete automation"
            );
        } finally {
            setDeleting(false);
        }
    };

    /**
     * Poll for the run created by a specific workflow.
     * Matches by workflowId to handle fast-completing runs and avoid clock skew issues.
     */
    const pollForNewRun = async (workflowId: string): Promise<string | null> => {
        const maxAttempts = 20; // 10 seconds total
        const pollInterval = 500;
        let consecutiveErrors = 0;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`/api/jobs/${job.internalId}`);

                if (!response.ok) {
                    consecutiveErrors++;
                    // Bail early on auth errors
                    if (response.status === 401 || response.status === 403) {
                        logger.warn(
                            { status: response.status },
                            "Auth error during polling"
                        );
                        return null;
                    }
                    if (consecutiveErrors >= 3) {
                        logger.warn({}, "Too many poll failures");
                        return null;
                    }
                    await new Promise((resolve) => setTimeout(resolve, pollInterval));
                    continue;
                }

                consecutiveErrors = 0;
                const data = await response.json();

                // Find run by workflow ID - works for any status (running, completed, failed)
                const matchingRun = data.job?.runs?.find(
                    (run: { temporalWorkflowId: string | null }) =>
                        run.temporalWorkflowId === workflowId
                );

                if (matchingRun) {
                    return matchingRun.id;
                }
            } catch (error) {
                consecutiveErrors++;
                logger.warn({ error }, "Network error during polling");
                if (consecutiveErrors >= 3) {
                    return null;
                }
            }

            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        return null;
    };

    const handleRunNow = async () => {
        setTriggering(true);
        setError(null);

        try {
            const response = await fetch(`/api/jobs/${job.internalId}/trigger`, {
                method: "POST",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(
                    data.message || data.error || "Couldn't start the automation"
                );
            }

            const { workflowId } = await response.json();

            // Poll for the new run by workflow ID
            const runId = await pollForNewRun(workflowId);

            if (runId) {
                setViewingRun({ id: runId });
            } else {
                // Run triggered but we couldn't find it - show inline message
                setError(
                    "Started in the background. Check the activity feed to see progress."
                );
            }
        } catch (error) {
            logger.error(
                { error, jobId: job.internalId },
                "Failed to trigger automation"
            );
            Sentry.captureException(error, {
                tags: { component: "edit-automation-form", action: "try_it" },
            });
            setError(
                error instanceof Error ? error.message : "Couldn't start the automation"
            );
        } finally {
            setTriggering(false);
        }
    };

    const hasChanges =
        name !== job.name ||
        prompt !== job.prompt ||
        scheduleCron !== job.scheduleCron ||
        scheduleDisplayText !== job.scheduleDisplayText ||
        timezone !== job.timezone;

    return (
        <StandardPageLayout maxWidth="standard" contentClassName="py-8">
            <div className="mx-auto max-w-2xl">
                {/* Header */}
                <div className="mb-8 flex items-center gap-3">
                    <button
                        onClick={() => router.push("/ai-team")}
                        className="text-foreground/60 hover:text-foreground p-1 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-foreground text-xl font-medium">
                            {job.name}
                        </h1>
                        <p className="text-foreground/60 text-sm">
                            Update your automation settings
                        </p>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {error && (
                        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-4 text-red-500">
                            <WarningCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-2">
                        <label
                            htmlFor="name"
                            className="text-foreground/70 text-sm font-medium"
                        >
                            Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="border-foreground/10 bg-foreground/[0.02] text-foreground placeholder:text-foreground/40 focus:border-primary w-full rounded-xl border px-4 py-3 transition-colors outline-none"
                            placeholder="Morning Email Digest"
                        />
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2">
                        <label
                            htmlFor="prompt"
                            className="text-foreground/70 text-sm font-medium"
                        >
                            Instructions
                        </label>
                        <textarea
                            id="prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={6}
                            className="border-foreground/10 bg-foreground/[0.02] text-foreground placeholder:text-foreground/40 focus:border-primary w-full resize-none rounded-xl border px-4 py-3 transition-colors outline-none"
                            placeholder="Check my email and summarize the important messages..."
                        />
                    </div>

                    {/* Schedule - using new ScheduleEditor component */}
                    <ScheduleEditor
                        scheduleCron={scheduleCron}
                        scheduleDisplayText={scheduleDisplayText}
                        timezone={timezone}
                        onScheduleChange={handleScheduleChange}
                        showCron={developerMode}
                    />

                    {/* Actions */}
                    <div className="border-foreground/10 flex items-center justify-between border-t pt-6">
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleting}
                            className="flex items-center gap-2 rounded-xl px-4 py-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                            <Trash className="h-4 w-4" />
                            {deleting ? "Deleting..." : "Delete"}
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/ai-team")}
                                className="text-foreground/60 hover:text-foreground px-4 py-2 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRunNow}
                                disabled={triggering || saving || hasChanges}
                                title={
                                    hasChanges
                                        ? "Save changes first"
                                        : "Run this automation now"
                                }
                                className="border-foreground/10 text-foreground hover:bg-foreground/5 flex items-center gap-2 rounded-xl border px-4 py-2 font-medium transition-colors disabled:opacity-50"
                            >
                                {triggering ? (
                                    <Sparkle className="h-4 w-4 animate-pulse" />
                                ) : (
                                    <Play className="h-4 w-4" />
                                )}
                                {triggering ? "Starting..." : "Try it"}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-6 py-2 font-medium transition-colors disabled:opacity-50"
                            >
                                <FloppyDisk className="h-4 w-4" />
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Delete confirmation dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="p-6">
                    <DialogHeader>
                        <DialogTitle>Delete Automation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{job.name}&quot;? This
                            cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="text-foreground/60 hover:text-foreground px-4 py-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
                        >
                            <Trash className="h-4 w-4" />
                            Delete
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Live run progress viewer */}
            {viewingRun && (
                <JobProgressViewer
                    jobId={job.internalId}
                    runId={viewingRun.id}
                    jobName={job.name}
                    onClose={() => setViewingRun(null)}
                />
            )}
        </StandardPageLayout>
    );
}
