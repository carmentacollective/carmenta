"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Save, Trash2, Sparkles, AlertCircle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { logger } from "@/lib/client-logger";

/**
 * Automation details for editing
 */
interface Automation {
    id: string;
    name: string;
    prompt: string;
    scheduleCron: string;
    timezone: string;
    isActive: boolean;
}

/**
 * Edit automation page
 */
export default function EditAutomationPage() {
    const router = useRouter();
    const params = useParams<{ jobId: string }>();
    const jobId = params?.jobId;

    const [automation, setAutomation] = useState<Automation | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [prompt, setPrompt] = useState("");
    const [scheduleCron, setScheduleCron] = useState("");
    const [timezone, setTimezone] = useState("");

    const loadAutomation = useCallback(async () => {
        if (!jobId) {
            setError("Invalid automation ID");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/jobs/${jobId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    setError("Automation not found");
                    return;
                }
                throw new Error("Failed to load automation");
            }

            const data = await response.json();
            setAutomation(data.job);
            setName(data.job.name);
            setPrompt(data.job.prompt);
            setScheduleCron(data.job.scheduleCron);
            setTimezone(data.job.timezone || "UTC");
        } catch (error) {
            logger.error({ error, jobId }, "Failed to load automation");
            Sentry.captureException(error, {
                tags: { component: "edit-automation-page", action: "load" },
            });
            setError("Failed to load automation");
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        loadAutomation();
    }, [loadAutomation]);

    const handleSave = async () => {
        if (!automation) return;

        setSaving(true);
        setError(null);

        try {
            const response = await fetch(`/api/jobs/${jobId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    prompt,
                    scheduleCron,
                    timezone,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save changes");
            }

            router.push("/ai-team?updated=true");
        } catch (error) {
            logger.error({ error, jobId }, "Failed to save automation");
            Sentry.captureException(error, {
                tags: { component: "edit-automation-page", action: "save" },
            });
            setError(error instanceof Error ? error.message : "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!automation) return;

        setShowDeleteConfirm(false);
        setDeleting(true);
        setError(null);

        try {
            const response = await fetch(`/api/jobs/${jobId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to delete automation");
            }

            router.push("/ai-team?deleted=true");
        } catch (error) {
            logger.error({ error, jobId }, "Failed to delete automation");
            Sentry.captureException(error, {
                tags: { component: "edit-automation-page", action: "delete" },
            });
            setError(
                error instanceof Error ? error.message : "Failed to delete automation"
            );
        } finally {
            setDeleting(false);
        }
    };

    const hasChanges =
        automation &&
        (name !== automation.name ||
            prompt !== automation.prompt ||
            scheduleCron !== automation.scheduleCron ||
            timezone !== (automation.timezone || "UTC"));

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
                            {loading
                                ? "Loading..."
                                : automation?.name || "Edit Automation"}
                        </h1>
                        <p className="text-foreground/60 text-sm">
                            Update your automation settings
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4">
                            <Sparkles className="text-primary h-8 w-8 animate-pulse" />
                            <p className="text-foreground/60">Loading automation...</p>
                        </div>
                    </div>
                ) : error && !automation ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                        <p className="text-foreground/80 font-medium">{error}</p>
                        <button
                            onClick={() => router.push("/ai-team")}
                            className="text-primary mt-4 hover:underline"
                        >
                            Back to AI Team
                        </button>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {error && (
                            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-4 text-red-500">
                                <AlertCircle className="h-5 w-5" />
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

                        {/* Schedule */}
                        <div className="space-y-2">
                            <label
                                htmlFor="schedule"
                                className="text-foreground/70 text-sm font-medium"
                            >
                                Schedule (Cron Expression)
                            </label>
                            <div className="relative">
                                <Clock className="text-foreground/40 absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2" />
                                <input
                                    id="schedule"
                                    type="text"
                                    value={scheduleCron}
                                    onChange={(e) => setScheduleCron(e.target.value)}
                                    className="border-foreground/10 bg-foreground/[0.02] text-foreground placeholder:text-foreground/40 focus:border-primary w-full rounded-xl border py-3 pr-4 pl-11 transition-colors outline-none"
                                    placeholder="0 9 * * 1-5"
                                />
                            </div>
                            <p className="text-foreground/50 text-xs">
                                Examples: &quot;0 9 * * 1-5&quot; (weekdays at 9am),
                                &quot;0 */2 * * *&quot; (every 2 hours)
                            </p>
                        </div>

                        {/* Timezone */}
                        <div className="space-y-2">
                            <label
                                htmlFor="timezone"
                                className="text-foreground/70 text-sm font-medium"
                            >
                                Timezone
                            </label>
                            <select
                                id="timezone"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="border-foreground/10 bg-foreground/[0.02] text-foreground focus:border-primary w-full rounded-xl border px-4 py-3 transition-colors outline-none"
                            >
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">Eastern Time</option>
                                <option value="America/Chicago">Central Time</option>
                                <option value="America/Denver">Mountain Time</option>
                                <option value="America/Los_Angeles">
                                    Pacific Time
                                </option>
                                <option value="Europe/London">London</option>
                                <option value="Europe/Paris">Paris</option>
                                <option value="Asia/Tokyo">Tokyo</option>
                            </select>
                        </div>

                        {/* Actions */}
                        <div className="border-foreground/10 flex items-center justify-between border-t pt-6">
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={deleting}
                                className="flex items-center gap-2 rounded-xl px-4 py-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" />
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
                                    onClick={handleSave}
                                    disabled={saving || !hasChanges}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-6 py-2 font-medium transition-colors disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Delete confirmation dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="p-6">
                    <DialogHeader>
                        <DialogTitle>Delete Automation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{automation?.name}
                            &quot;? This cannot be undone.
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
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </StandardPageLayout>
    );
}
