"use client";

/**
 * SessionPicker - Select or create code sessions for a project
 *
 * Shows recent sessions for a project with:
 * - Session title (auto-generated or edited)
 * - Last activity time
 * - Preview snippet
 * - New session button
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    MessageSquare,
    Clock,
    ChevronRight,
    Loader2,
    Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";

export interface CodeSession {
    id: string;
    slug: string;
    title: string | null;
    lastActivityAt: Date;
    messageCount: number;
    lastMessagePreview?: string;
    isStreaming?: boolean;
}

interface SessionPickerProps {
    repoSlug: string;
    repoName: string;
    sessions: CodeSession[];
    className?: string;
}

export function SessionPicker({
    repoSlug,
    repoName,
    sessions,
    className,
}: SessionPickerProps) {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);

    const handleNewSession = () => {
        setIsCreating(true);
        // Navigate to new session - session will be created on first message
        router.push(`/code/${repoSlug}/new`);
    };

    const handleSelectSession = (session: CodeSession) => {
        const slug = session.slug || "_";
        router.push(`/code/${repoSlug}/${slug}/${session.id}`);
    };

    const formatTime = (date: Date) => {
        return formatDistanceToNow(new Date(date), { addSuffix: true });
    };

    return (
        <div className={cn("w-full max-w-2xl", className)}>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-foreground text-2xl font-semibold">
                        {repoName}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {sessions.length === 0
                            ? "Start a new coding session"
                            : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
                    </p>
                </div>
                <button
                    onClick={handleNewSession}
                    disabled={isCreating}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 font-medium text-white transition-all hover:bg-purple-700 disabled:opacity-50"
                >
                    {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                    New Session
                </button>
            </div>

            {/* Session List */}
            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {sessions.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-2xl border border-dashed py-12"
                        >
                            <Sparkles className="text-muted-foreground mb-3 h-8 w-8" />
                            <p className="text-muted-foreground text-center">
                                No sessions yet.
                                <br />
                                Start one to begin coding together.
                            </p>
                        </motion.div>
                    ) : (
                        sessions.map((session, index) => (
                            <motion.button
                                key={session.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleSelectSession(session)}
                                className="group border-border bg-card flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all hover:border-purple-300 hover:bg-purple-50/50 dark:hover:border-purple-800 dark:hover:bg-purple-950/20"
                            >
                                {/* Icon */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                    {session.isStreaming ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <MessageSquare className="h-5 w-5" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-foreground truncate font-medium">
                                            {session.title || "Untitled Session"}
                                        </span>
                                        {session.isStreaming && (
                                            <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            {formatTime(session.lastActivityAt)}
                                        </span>
                                        <span>·</span>
                                        <span>
                                            {session.messageCount} message
                                            {session.messageCount !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    {session.lastMessagePreview && (
                                        <p className="text-muted-foreground mt-1.5 truncate text-sm">
                                            {session.lastMessagePreview}
                                        </p>
                                    )}
                                </div>

                                {/* Arrow */}
                                <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                            </motion.button>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
