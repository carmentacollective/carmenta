"use client";

/**
 * ClickUp Tool UI - Rich Task Management Display
 *
 * Uses ToolWrapper for consistent status display.
 * Rich visual displays for tasks, lists, comments, time tracking.
 */

import { useState } from "react";
import Image from "next/image";
import {
    ChevronDown,
    ChevronRight,
    Clock,
    ExternalLink,
    Flag,
    MessageSquare,
    Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "./tool-renderer";

interface ClickUpToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

// ClickUp priority colors (1=urgent, 2=high, 3=normal, 4=low)
const PRIORITY_CONFIG: Record<
    number,
    { label: string; color: string; bgColor: string }
> = {
    1: {
        label: "Urgent",
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    2: {
        label: "High",
        color: "text-orange-600",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
    3: {
        label: "Normal",
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    4: {
        label: "Low",
        color: "text-gray-500",
        bgColor: "bg-gray-100 dark:bg-gray-800/50",
    },
};

// Status color mapping (ClickUp uses custom status colors, these are common defaults)
const STATUS_COLORS: Record<string, string> = {
    open: "bg-gray-400",
    "in progress": "bg-blue-500",
    review: "bg-purple-500",
    complete: "bg-green-500",
    closed: "bg-green-600",
    done: "bg-green-500",
    default: "bg-gray-400",
};

function getStatusColor(status: string): string {
    const normalized = status.toLowerCase();
    return STATUS_COLORS[normalized] || STATUS_COLORS.default;
}

/**
 * Main ClickUp tool result component using ToolRenderer for consistent collapsed state.
 */
export function ClickUpToolResult({
    toolCallId,
    status,
    action,
    input,
    output,
    error,
}: ClickUpToolResultProps) {
    const hasVisualContent = isVisualAction(action) && status === "completed";

    return (
        <ToolRenderer
            toolName="clickup"
            toolCallId={toolCallId}
            status={status}
            input={input}
            output={output}
            error={error}
        >
            {hasVisualContent && <ClickUpContent action={action} output={output} />}
        </ToolRenderer>
    );
}

/**
 * Check if this action type produces rich visual content
 */
function isVisualAction(action: string): boolean {
    return [
        "list_teams",
        "list_spaces",
        "list_lists",
        "list_tasks",
        "get_task",
        "list_comments",
        "list_time_entries",
    ].includes(action);
}

/**
 * Render rich content for visual actions
 */
function ClickUpContent({
    action,
    output,
}: {
    action: string;
    output?: Record<string, unknown>;
}) {
    switch (action) {
        case "list_teams":
            return <TeamsDisplay output={output} />;
        case "list_spaces":
            return <SpacesDisplay output={output} />;
        case "list_lists":
            return <ListsDisplay output={output} />;
        case "list_tasks":
            return <TasksDisplay output={output} />;
        case "get_task":
            return <TaskDetailDisplay output={output} />;
        case "list_comments":
            return <CommentsDisplay output={output} />;
        case "list_time_entries":
            return <TimeEntriesDisplay output={output} />;
        default:
            return null;
    }
}

// ============================================================================
// HIERARCHY DISPLAYS (Teams → Spaces → Lists)
// ============================================================================

interface Team {
    id: string;
    name: string;
    color?: string;
}

function TeamsDisplay({ output }: { output?: Record<string, unknown> }) {
    const teams = (output?.teams as Team[]) ?? [];

    if (teams.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
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
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {teams.length} workspace{teams.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {teams.map((team) => (
                    <div
                        key={team.id}
                        className="border-border/50 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: team.color || "#7B68EE" }}
                        />
                        <span className="text-sm font-medium">{team.name}</span>
                        <code className="text-muted-foreground text-xs">{team.id}</code>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface Space {
    id: string;
    name: string;
    private?: boolean;
}

function SpacesDisplay({ output }: { output?: Record<string, unknown> }) {
    const spaces = (output?.spaces as Space[]) ?? [];

    if (spaces.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>No spaces found</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {spaces.length} space{spaces.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {spaces.map((space) => (
                    <div
                        key={space.id}
                        className="border-border/50 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <ChevronRight className="text-primary h-4 w-4" />
                        <span className="text-sm font-medium">{space.name}</span>
                        {space.private && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Private
                            </span>
                        )}
                        <code className="text-muted-foreground text-xs">
                            {space.id}
                        </code>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface List {
    id: string;
    name: string;
}

function ListsDisplay({ output }: { output?: Record<string, unknown> }) {
    const lists = (output?.lists as List[]) ?? [];

    if (lists.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>No lists found</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>
                    {lists.length} list{lists.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {lists.map((list) => (
                    <div
                        key={list.id}
                        className="border-border/50 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <div className="bg-primary h-2 w-2 rounded-sm" />
                        <span className="text-sm font-medium">{list.name}</span>
                        <code className="text-muted-foreground text-xs">{list.id}</code>
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
    id: string;
    title: string;
    status: string;
    priority?: string | number;
    assignees?: string[];
    dueDate?: string;
    url?: string;
    description?: string;
    tags?: string[];
    startDate?: string;
}

function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
    const priority =
        typeof task.priority === "number"
            ? task.priority
            : task.priority
              ? ({ urgent: 1, high: 2, normal: 3, low: 4 }[
                    task.priority.toLowerCase()
                ] ?? 0)
              : 0;
    const priorityConfig = priority ? PRIORITY_CONFIG[priority] : null;

    return (
        <div
            className={cn(
                "group border-border/50 bg-card/50 hover:border-primary/30 rounded-lg border transition-all hover:shadow-md",
                compact ? "p-2" : "p-3"
            )}
        >
            <div className="flex items-start gap-3">
                {/* Status dot */}
                <div
                    className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        getStatusColor(task.status)
                    )}
                    title={task.status}
                />

                <div className="min-w-0 flex-1">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                        <h4
                            className={cn(
                                "text-foreground font-medium",
                                compact ? "text-sm" : "text-base"
                            )}
                        >
                            {task.title}
                        </h4>
                        {task.url && (
                            <a
                                href={task.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                title="Open in ClickUp"
                            >
                                <ExternalLink className="text-muted-foreground hover:text-primary h-4 w-4" />
                            </a>
                        )}
                    </div>

                    {/* Meta row */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        <span className="text-muted-foreground rounded px-1.5 py-0.5 text-xs font-medium capitalize">
                            {task.status}
                        </span>

                        {/* Priority badge */}
                        {priorityConfig && (
                            <span
                                className={cn(
                                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                                    priorityConfig.bgColor,
                                    priorityConfig.color
                                )}
                            >
                                <Flag className="h-3 w-3" />
                                {priorityConfig.label}
                            </span>
                        )}

                        {/* Due date */}
                        {task.dueDate && (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                {formatDate(task.dueDate)}
                            </span>
                        )}

                        {/* Assignees */}
                        {task.assignees && task.assignees.length > 0 && (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                <Users className="h-3 w-3" />
                                {task.assignees.slice(0, 2).join(", ")}
                                {task.assignees.length > 2 &&
                                    ` +${task.assignees.length - 2}`}
                            </span>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1">
                                {task.tags.slice(0, 3).map((tag) => (
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

                    {/* Description preview (non-compact only) */}
                    {!compact && task.description && (
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                            {task.description}
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
                    src="/logos/clickup.svg"
                    alt="ClickUp"
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
                    src="/logos/clickup.svg"
                    alt="ClickUp"
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
                    <TaskCard key={task.id} task={task} compact={tasks.length > 5} />
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
        id: output.id as string,
        title: output.title as string,
        status: output.status as string,
        priority: output.priority as string | undefined,
        assignees: output.assignees as string[] | undefined,
        dueDate: output.dueDate as string | undefined,
        startDate: output.startDate as string | undefined,
        url: output.url as string | undefined,
        description: output.description as string | undefined,
        tags: output.tags as string[] | undefined,
    };

    // Handle assignees - can be strings (from list_tasks) or objects (from get_task)
    if (
        output.assignees &&
        Array.isArray(output.assignees) &&
        output.assignees.length > 0
    ) {
        const first = output.assignees[0];
        if (typeof first === "string") {
            // Already strings (from list_tasks)
            task.assignees = output.assignees as string[];
        } else {
            // Objects with username/email (from get_task)
            task.assignees = (
                output.assignees as Array<{ username?: string; email?: string }>
            ).map((a) => a.username || a.email || "Unknown");
        }
    }

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span>Task Details</span>
            </div>
            <TaskCard task={task} />

            {/* Custom fields if present */}
            <CustomFieldsSection customFields={output.customFields} />
        </div>
    );
}

/**
 * Custom fields section - handles the type complexity of customFields
 */
function CustomFieldsSection({ customFields }: { customFields: unknown }) {
    if (!customFields || !Array.isArray(customFields) || customFields.length === 0) {
        return null;
    }

    const fields = customFields as Array<{ id?: string; name: string; value: unknown }>;

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
                        <div key={field.id ?? `field-${idx}`} className="text-xs">
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
// COMMENTS DISPLAY
// ============================================================================

interface Comment {
    id: string;
    text: string;
    author: string;
    date: string;
}

function CommentsDisplay({ output }: { output?: Record<string, unknown> }) {
    const comments = (output?.comments as Comment[]) ?? [];
    const [expanded, setExpanded] = useState(false);

    if (comments.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <MessageSquare className="h-4 w-4" />
                <span>No comments</span>
            </div>
        );
    }

    const displayComments = expanded ? comments : comments.slice(0, 3);

    return (
        <div className="px-4 py-3">
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                <span>
                    {comments.length} comment{comments.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="space-y-2">
                {displayComments.map((comment) => (
                    <div
                        key={comment.id}
                        className="border-border/50 bg-muted/20 rounded-lg border p-3"
                    >
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium">
                                {comment.author}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {formatDate(comment.date)}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-sm">{comment.text}</p>
                    </div>
                ))}
            </div>
            {comments.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-primary mt-2 flex items-center gap-1 text-sm hover:underline"
                >
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 transition-transform",
                            expanded && "rotate-180"
                        )}
                    />
                    {expanded ? "Show less" : `Show ${comments.length - 3} more`}
                </button>
            )}
        </div>
    );
}

// ============================================================================
// TIME ENTRIES DISPLAY
// ============================================================================

interface TimeEntry {
    id: string;
    user: string;
    durationMs: number;
    start: string;
    end?: string;
    description?: string;
}

function TimeEntriesDisplay({ output }: { output?: Record<string, unknown> }) {
    const entries = (output?.timeEntries as TimeEntry[]) ?? [];

    if (entries.length === 0) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                <Clock className="h-4 w-4" />
                <span>No time entries</span>
            </div>
        );
    }

    const totalMs = entries.reduce((sum, e) => sum + e.durationMs, 0);

    return (
        <div className="px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>
                        {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
                    </span>
                </div>
                <span className="text-foreground text-sm font-medium">
                    Total: {formatDuration(totalMs)}
                </span>
            </div>
            <div className="space-y-2">
                {entries.map((entry) => (
                    <div
                        key={entry.id}
                        className="border-border/50 bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                        <div>
                            <span className="text-sm font-medium">{entry.user}</span>
                            {entry.description && (
                                <p className="text-muted-foreground text-xs">
                                    {entry.description}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-medium">
                                {formatDuration(entry.durationMs)}
                            </span>
                            <p className="text-muted-foreground text-xs">
                                {formatDate(entry.start)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateInput: string | number): string {
    if (!dateInput) return "";

    // Handle Unix timestamps (ms)
    const timestamp =
        typeof dateInput === "string" ? parseInt(dateInput, 10) : dateInput;
    if (!isNaN(timestamp) && timestamp > 1000000000000) {
        // Looks like a Unix timestamp in ms
        const date = new Date(timestamp);
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    // Try parsing as ISO date
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
