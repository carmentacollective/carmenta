"use client";

/**
 * Code Mode Entry Point
 *
 * Presents project selection for code mode. Selecting a project navigates
 * directly to a new session.
 *
 * Flow:
 * 1. User visits /code
 * 2. ProjectSelector shows available projects
 * 3. On selection, navigates to /code/[repo]/new (new session)
 * 4. To resume past sessions, navigate to /code/[repo] (session picker)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FolderGit2, ArrowRight, Loader2 } from "lucide-react";

import Image from "next/image";

import { ProjectSelector } from "@/components/code";
import { HolographicBackground } from "@/components/ui/holographic-background";
import type { Project } from "@/lib/code/projects";

/**
 * Derive repo slug from project path or name
 */
function getRepoSlug(project: Project): string {
    // Use the last segment of the path
    const pathSlug = project.path.split("/").pop() ?? "";
    // Fallback to name if path segment is empty
    return pathSlug || project.name.toLowerCase().replace(/\s+/g, "-");
}

export default function CodePage() {
    const router = useRouter();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);

    const handleProjectSelect = async (project: Project) => {
        setSelectedProject(project);
    };

    const handleStartCoding = async () => {
        if (!selectedProject) return;

        setIsNavigating(true);

        // Navigate directly to a new session
        const repoSlug = getRepoSlug(selectedProject);
        router.push(`/code/${repoSlug}/new`);
    };

    return (
        <div className="fixed inset-0 overflow-hidden">
            <HolographicBackground hideWatermark />

            <div className="z-content relative flex h-full items-center justify-center p-4">
                <motion.div
                    className="dark:bg-card/70 w-full max-w-md space-y-6 rounded-3xl border border-white/20 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10"
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="oracle-breathing relative h-10 w-10 shrink-0">
                            <Image
                                src="/logos/icon-transparent.png"
                                alt="Carmenta"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <h1 className="text-foreground text-xl font-semibold">
                                Code Mode
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                Choose a project to work on together
                            </p>
                        </div>
                    </div>

                    {/* Project Selection */}
                    <div className="space-y-4">
                        <label className="text-foreground block text-sm font-medium">
                            Project
                        </label>
                        <ProjectSelector
                            selectedProject={selectedProject}
                            onProjectSelect={handleProjectSelect}
                            className="w-full"
                        />

                        {selectedProject && (
                            <motion.div
                                className="rounded-xl bg-purple-50 p-4 dark:bg-purple-900/20"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                            >
                                <div className="flex items-start gap-3">
                                    <FolderGit2 className="mt-0.5 h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-purple-900 dark:text-purple-100">
                                            {selectedProject.name}
                                        </p>
                                        <p className="truncate text-sm text-purple-700 dark:text-purple-300">
                                            {selectedProject.path}
                                        </p>
                                        {selectedProject.description && (
                                            <p className="mt-1 text-sm text-purple-600 dark:text-purple-400">
                                                {selectedProject.description}
                                            </p>
                                        )}
                                        {selectedProject.gitBranch && (
                                            <p className="mt-1 text-xs text-purple-500">
                                                Branch: {selectedProject.gitBranch}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={handleStartCoding}
                        disabled={!selectedProject || isNavigating}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-medium text-white transition-all hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isNavigating ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Starting session...
                            </>
                        ) : (
                            <>
                                Start Coding
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </button>

                    {/* Hint */}
                    <p className="text-muted-foreground text-center text-xs">
                        We&apos;ll use Claude Agent SDK to work on your code together.
                        <br />
                        All changes happen in your local filesystem.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
