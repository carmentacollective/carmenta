"use client";

/**
 * ProjectSelector - Choose a project/repository to work on
 */

import { useCallback, useEffect, useState } from "react";
import {
    FolderGit2,
    GitBranch,
    FileCode,
    Clock,
    ChevronDown,
    RefreshCw,
    Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/code/projects";

interface ProjectSelectorProps {
    selectedProject: Project | null;
    onProjectSelect: (project: Project) => void;
    className?: string;
}

export function ProjectSelector({
    selectedProject,
    onProjectSelect,
    className,
}: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const fetchProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/code/projects");
            if (!response.ok) {
                throw new Error("Failed to fetch projects");
            }
            const data = await response.json();
            setProjects(data.projects || []);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
            logger.error({ error: message }, "Failed to fetch projects");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Filter projects by search query
    const filteredProjects = projects.filter(
        (project) =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Format relative time
    const formatRelativeTime = (date: Date | undefined) => {
        if (!date) return null;
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return "recent";
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "justify-between gap-2 font-normal",
                        !selectedProject && "text-muted-foreground",
                        className
                    )}
                >
                    <div className="flex items-center gap-2">
                        <FolderGit2 className="size-4" />
                        {selectedProject ? (
                            <span className="truncate">{selectedProject.name}</span>
                        ) : (
                            <span>Select project...</span>
                        )}
                    </div>
                    <ChevronDown className="size-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-[400px]">
                {/* Search input */}
                <div className="flex items-center gap-2 border-b px-3 py-2">
                    <Search className="size-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                            e.preventDefault();
                            fetchProjects();
                        }}
                        disabled={isLoading}
                    >
                        <RefreshCw
                            className={cn("size-4", isLoading && "animate-spin")}
                        />
                    </Button>
                </div>

                {/* Project list */}
                <div className="max-h-[400px] overflow-y-auto p-1">
                    {isLoading && projects.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Loading projects...
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-center text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {!isLoading && !error && filteredProjects.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            {searchQuery
                                ? "No projects match your search"
                                : "No projects found. Set CODE_SOURCE_DIR in your environment."}
                        </div>
                    )}

                    {filteredProjects.map((project) => (
                        <DropdownMenuItem
                            key={project.path}
                            onClick={() => {
                                onProjectSelect(project);
                                setIsOpen(false);
                            }}
                            className="flex cursor-pointer flex-col items-start gap-1 p-3"
                        >
                            <div className="flex w-full items-center gap-2">
                                <FolderGit2
                                    className={cn(
                                        "size-4",
                                        project.hasClaudeMd
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                    )}
                                />
                                <span className="font-medium">{project.name}</span>
                                {project.hasClaudeMd && (
                                    <span title="Has CLAUDE.md">
                                        <FileCode className="size-3 text-primary" />
                                    </span>
                                )}
                                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                                    {project.gitBranch && (
                                        <span className="flex items-center gap-1">
                                            <GitBranch className="size-3" />
                                            {project.gitBranch}
                                        </span>
                                    )}
                                    {project.lastModified && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {formatRelativeTime(project.lastModified)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {project.description && (
                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                    {project.description}
                                </p>
                            )}
                            <p className="line-clamp-1 text-xs text-muted-foreground/50">
                                {project.path}
                            </p>
                        </DropdownMenuItem>
                    ))}
                </div>

                <DropdownMenuSeparator />
                <div className="p-2 text-center text-xs text-muted-foreground">
                    {projects.length} project{projects.length === 1 ? "" : "s"}{" "}
                    available
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
