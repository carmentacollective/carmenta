"use client";

/**
 * Asana Tool UI - Task Management Display
 *
 * Uses ToolRenderer for consistent status display.
 * Provides rich visual displays for tasks, projects, and workspaces.
 */

import Image from "next/image";
import {
    ArrowSquareOut,
    Clock,
    Users,
    Tag,
    CheckCircle,
    Circle,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

/**
 * Map Asana color names to hex codes
 * Based on Asana's standard project colors
 */
const ASANA_COLORS: Record<string, string> = {
    "dark-pink": "#E362E3",
    "dark-green": "#2D7E2E",
    "dark-blue": "#1F76C2",
    "dark-red": "#D9534F",
    "dark-teal": "#299C9F",
    "dark-brown": "#B06F3F",
    "dark-orange": "#FF6B35",
    "dark-purple": "#8B5AAF",
    "dark-warm-gray": "#B07D5C",
    pink: "#FC9EEA",
    green: "#7ED47A",
    blue: "#6CBEED",
    red: "#E96768",
    teal: "#4ECBC4",
    brown: "#E1956C",
    orange: "#FFC77D",
    purple: "#C99AFF",
    "warm-gray": "#C9AF98",
    "light-pink": "#FBD6E9",
    "light-green": "#C3EB8D",
    "light-blue": "#B9ECFA",
    "light-red": "#FCB3B3",
    "light-teal": "#91F2EE",
    "light-brown": "#E6CCA6",
    "light-orange": "#FFD5B5",
    "light-purple": "#E8D5FF",
    "light-warm-gray": "#E0D7D1",
    none: "#F0F0F0",
};

interface AsanaToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Main Asana tool result component using ToolRenderer for consistent collapsed state.
 */
export function AsanaToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: AsanaToolResultProps) {
    const hasVisualContent = isVisualAction(action) && status === "completed";

    return (
        <ToolRenderer
            toolName="asana"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {hasVisualContent && <AsanaContent action={action} output={output} />}
        </ToolRenderer>
    );
}

/**
 * Check if this action type produces rich visual content
 */
function isVisualAction(action: string): boolean {
    return [
        "list_workspaces",
        "list_projects",
        "search_tasks",
        "list_project_tasks",
        "get_task",
        "get_me",
    ].includes(action);
}

/**
 * Render rich content for visual actions
 */
function AsanaContent({
    action,
    output,
}: {
    action: string;
    output?: Record<string, unknown>;
}) {
    switch (action) {
        case "get_me":
            return <UserDisplay output={output} />;
        case "list_workspaces":
            return <WorkspacesDisplay output={output} />;
        case "list_projects":
            return <ProjectsDisplay output={output} />;
        case "search_tasks":
        case "list_project_tasks":
            return <TasksDisplay output={output} />;
        case "get_task":
            return <TaskDetailDisplay output={output} />;
        default:
            return null;
    }
}

// ============================================================================
// USER DISPLAY
// ============================================================================

function UserDisplay({ output }: { output?: Record<string, unknown> }) {
    if (!output) return null;

    const workspaces =
        (output.workspaces as Array<{ gid: string; name: string }>) ?? [];

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>Connected as {output.name as string}</span>
            </div>
            {workspaces.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {workspaces.map((ws) => (
                        <div
                            key={ws.gid}
                            className="border-border/50 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                        >
                            <div className="bg-primary h-2 w-2 rounded-full" />
                            <span className="text-sm font-medium">{ws.name}</span>
                            <code className="text-muted-foreground text-xs">
                                {ws.gid}
                            </code>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// WORKSPACE & PROJECT DISPLAYS
// ============================================================================

function WorkspacesDisplay({ output }: { output?: Record<string, unknown> }) {
    const workspaces =
        (output?.workspaces as Array<{ gid: string; name: string }>) ?? [];

    if (workspaces.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>No workspaces found</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {workspaces.map((ws) => (
                    <div
                        key={ws.gid}
                        className="border-border/50 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <div className="bg-primary h-2 w-2 rounded-full" />
                        <span className="text-sm font-medium">{ws.name}</span>
                        <code className="text-muted-foreground text-xs">{ws.gid}</code>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface Project {
    gid: string;
    name: string;
    color?: string;
    notes?: string;
    url?: string;
}

function ProjectsDisplay({ output }: { output?: Record<string, unknown> }) {
    const projects = (output?.projects as Project[]) ?? [];

    if (projects.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>No projects found</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {projects.length} project{projects.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {projects.map((project) => (
                    <div
                        key={project.gid}
                        className="border-border/50 bg-muted/30 group flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <div
                            className="h-3 w-3 rounded-sm"
                            style={{
                                backgroundColor: project.color
                                    ? ASANA_COLORS[project.color] || "#F06A6A"
                                    : "#F06A6A",
                            }}
                        />
                        <span className="text-sm font-medium">{project.name}</span>
                        <code className="text-muted-foreground text-xs">
                            {project.gid}
                        </code>
                        {project.url && (
                            <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                                <ArrowSquareOut className="text-muted-foreground hover:text-primary h-4 w-4" />
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// TASK DISPLAYS
// ============================================================================

interface Task {
    gid: string;
    name: string;
    notes?: string;
    completed: boolean;
    assignee?: string;
    due_on?: string;
    projects?: string[];
    tags?: string[];
    url?: string;
}

interface CustomField {
    name: string;
    value: unknown;
}

function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
    const isOverdue =
        task.due_on && !task.completed && new Date(task.due_on) < new Date();

    return (
        <div
            className={cn(
                "group border-border/50 bg-card/50 hover:border-primary/30 rounded-lg border transition-all hover:shadow-md",
                compact ? "p-2" : "p-3"
            )}
        >
            <div className="flex items-start gap-3">
                {/* Completion indicator */}
                {task.completed ? (
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                ) : (
                    <Circle className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                        <h4
                            className={cn(
                                "text-foreground font-medium",
                                compact ? "text-sm" : "text-base",
                                task.completed && "text-muted-foreground line-through"
                            )}
                        >
                            {task.name}
                        </h4>
                        {task.url && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a
                                        href={task.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        <ArrowSquareOut className="text-muted-foreground hover:text-primary h-4 w-4" />
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent>Open in Asana</TooltipContent>
                            </Tooltip>
                        )}
                    </div>

                    {/* Meta row */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {/* Due date */}
                        {task.due_on && (
                            <span
                                className={cn(
                                    "flex items-center gap-1 text-xs",
                                    isOverdue
                                        ? "font-medium text-red-500"
                                        : "text-muted-foreground"
                                )}
                            >
                                <Clock className="h-3 w-3" />
                                {formatDate(task.due_on)}
                            </span>
                        )}

                        {/* Assignee */}
                        {task.assignee && (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                <Users className="h-3 w-3" />
                                {task.assignee}
                            </span>
                        )}

                        {/* Projects */}
                        {task.projects && task.projects.length > 0 && (
                            <span className="text-muted-foreground text-xs">
                                in {task.projects.slice(0, 2).join(", ")}
                                {task.projects.length > 2 &&
                                    ` +${task.projects.length - 2}`}
                            </span>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                                <Tag className="text-muted-foreground h-3 w-3" />
                                {task.tags.slice(0, 2).map((tag) => (
                                    <span
                                        key={tag}
                                        className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes preview (non-compact only) */}
                    {!compact && task.notes && (
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                            {task.notes}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function TasksDisplay({ output }: { output?: Record<string, unknown> }) {
    const tasks = (output?.tasks as Task[]) ?? [];
    const totalCount = (output?.totalCount as number) ?? tasks.length;

    if (tasks.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>No tasks found</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {totalCount} task{totalCount !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex flex-col gap-2">
                {tasks.map((task) => (
                    <TaskCard key={task.gid} task={task} compact={tasks.length > 5} />
                ))}
            </div>
        </div>
    );
}

function TaskDetailDisplay({ output }: { output?: Record<string, unknown> }) {
    if (!output) {
        return (
            <div className="text-muted-foreground px-4 py-3 text-sm">No task data</div>
        );
    }

    const task: Task = {
        gid: output.gid as string,
        name: output.name as string,
        completed: output.completed as boolean,
        notes: output.notes as string | undefined,
        assignee:
            (output.assignee as { name?: string } | undefined)?.name ??
            (output.assignee as string | undefined),
        due_on: output.due_on as string | undefined,
        projects: (output.projects as Array<{ name: string }> | undefined)?.map(
            (p) => p.name
        ),
        tags: output.tags as string[] | undefined,
        url: output.url as string | undefined,
    };

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/asana.svg"
                    alt="Asana"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>Task Details</span>
            </div>
            <TaskCard task={task} />

            {/* Custom fields if present */}
            <CustomFieldsSection
                customFields={output.customFields as CustomField[] | undefined}
            />
        </div>
    );
}

/**
 * Custom fields section
 */
function CustomFieldsSection({
    customFields,
}: {
    customFields: CustomField[] | undefined;
}) {
    if (!customFields || customFields.length === 0) {
        return null;
    }

    const fields = customFields;

    return (
        <div className="border-border/50 bg-muted/20 mt-3 rounded-lg border p-3">
            <h5 className="text-muted-foreground mb-2 text-xs font-medium">
                Custom Fields
            </h5>
            <div className="flex flex-wrap gap-2">
                {fields.map((field, idx) => {
                    const displayValue =
                        field.value != null ? String(field.value) : "—";
                    return (
                        <div key={`field-${idx}`} className="text-xs">
                            <span className="text-muted-foreground">{field.name}:</span>{" "}
                            <span className="font-medium">{displayValue}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateInput: string): string {
    if (!dateInput) return "";

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const inputDate = new Date(dateInput);
    inputDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
        (inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
