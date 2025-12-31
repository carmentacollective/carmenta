"use client";

/**
 * Code Project Page - Session Picker
 *
 * Shows all sessions for a project and allows creating new ones.
 *
 * URL: /code/[repo]
 * Example: /code/carmenta-code
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, FolderGit2 } from "lucide-react";
import Image from "next/image";

import { SessionPicker, type CodeSession } from "@/components/code/session-picker";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { logger } from "@/lib/client-logger";

export default function CodeProjectPage() {
    const params = useParams();
    const router = useRouter();
    const repo = (params?.repo as string) ?? "";

    const [sessions, setSessions] = useState<CodeSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Derive display name from repo slug
    const repoName = repo
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    useEffect(() => {
        async function fetchSessions() {
            try {
                const response = await fetch(`/api/code/${repo}/sessions`);
                if (!response.ok) {
                    throw new Error("Failed to fetch sessions");
                }
                const data = await response.json();
                setSessions(data.sessions);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Something went wrong";
                setError(message);
                logger.error({ error: err, repo }, "Failed to fetch code sessions");
            } finally {
                setIsLoading(false);
            }
        }

        fetchSessions();
    }, [repo]);

    return (
        <div className="fixed inset-0 overflow-hidden">
            <HolographicBackground hideWatermark />

            <div className="z-content relative flex h-full flex-col">
                {/* Header */}
                <header className="dark:bg-card/50 flex items-center gap-4 border-b border-white/10 bg-white/50 px-6 py-4 backdrop-blur-xl">
                    <button
                        onClick={() => router.push("/code")}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors"
                        aria-label="Back to projects"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <FolderGit2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-foreground font-semibold">
                                {repoName}
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                Code sessions
                            </p>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="flex flex-1 items-start justify-center overflow-auto p-6 pt-12">
                    {isLoading ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-3"
                        >
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                            <p className="text-muted-foreground">Loading sessions...</p>
                        </motion.div>
                    ) : error ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30"
                        >
                            <p className="text-red-700 dark:text-red-400">{error}</p>
                            <button
                                onClick={() => router.push("/code")}
                                className="mt-4 text-sm text-red-600 underline hover:no-underline dark:text-red-500"
                            >
                                Back to projects
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <SessionPicker
                                repoSlug={repo}
                                repoName={repoName}
                                sessions={sessions}
                            />
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <footer className="dark:bg-card/30 border-t border-white/10 bg-white/30 px-6 py-3 backdrop-blur-xl">
                    <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={16}
                            height={16}
                            className="opacity-60"
                        />
                        <span>Powered by Claude Agent SDK</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
