"use client";

/**
 * ClickUp Tool UI - Rich Task Management Display
 *
 * ClickUp is visual project management. Users want to SEE their tasks, status,
 * priorities, and team members - not parse JSON. This component renders:
 *
 * - Task cards with status colors, priority badges, assignees
 * - Hierarchy navigation (Teams → Spaces → Lists)
 * - Comments thread with authors
 * - Time tracking entries
 * - Direct links to ClickUp
 */

import { useState } from "react";
import Image from "next/image";
import {
    AlertCircle,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    ExternalLink,
    Flag,
    Loader2,
    MessageSquare,
    Plus,
    Trash2,
    Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ToolStatus } from "@/lib/tools/tool-config";

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
 * Main ClickUp tool result component
 */
export function ClickUpToolResult({
    status,
    action,
    input,
    output,
    error,
}: ClickUpToolResultProps) {
    // Loading state
    if (status === "running") {
        return (
            <div className="flex items-center gap-3 px-4 py-3">
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                />
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                    {getLoadingMessage(action, input)}
                </span>
            </div>
        );
    }

    // Error state
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm">{error || `ClickUp ${action} failed`}</span>
            </div>
        );
    }

    // Success - render based on action
    return renderContent(action, input, output);
}

/**
 * Generate loading message based on action
 */
function getLoadingMessage(action: string, input: Record<string, unknown>): string {
    switch (action) {
        case "list_teams":
            return "Loading workspaces...";
        case "list_spaces":
            return "Loading spaces...";
        case "list_lists":
            return "Loading lists...";
        case "list_tasks": {
            const listId = input.list_id as string;
            return listId ? "Loading tasks..." : "Searching tasks...";
        }
        case "get_task":
            return "Loading task details...";
        case "create_task":
            return "Creating task...";
        case "update_task":
            return "Updating task...";
        case "delete_task":
            return "Deleting task...";
        case "create_comment":
            return "Adding comment...";
        case "list_comments":
            return "Loading comments...";
        case "list_time_entries":
            return "Loading time entries...";
        case "describe":
            return "Loading capabilities...";
        default:
            return `Running ${action}...`;
    }
}

/**
 * Render content based on action type
 */
function renderContent(
    action: string,
    input: Record<string, unknown>,
    output?: Record<string, unknown>
) {
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
        case "create_task":
            return <TaskCreatedDisplay output={output} />;
        case "update_task":
            return <TaskUpdatedDisplay output={output} />;
        case "delete_task":
            return <TaskDeletedDisplay output={output} />;
        case "create_comment":
            return <CommentCreatedDisplay output={output} />;
        case "list_comments":
            return <CommentsDisplay output={output} />;
        case "list_time_entries":
            return <TimeEntriesDisplay output={output} />;
        case "describe":
            return <DescribeDisplay />;
        case "raw_api":
            return <RawApiDisplay output={output} />;
        default:
            return <GenericDisplay action={action} output={output} />;
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
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
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
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
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
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                        <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: team.color || "#7B68EE" }}
                        />
                        <span className="text-sm font-medium">{team.name}</span>
                        <code className="text-xs text-muted-foreground">{team.id}</code>
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
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
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
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
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
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{space.name}</span>
                        {space.private && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Private
                            </span>
                        )}
                        <code className="text-xs text-muted-foreground">
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
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
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
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
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
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                        <div className="h-2 w-2 rounded-sm bg-primary" />
                        <span className="text-sm font-medium">{list.name}</span>
                        <code className="text-xs text-muted-foreground">{list.id}</code>
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
                "group rounded-lg border border-border/50 bg-card/50 transition-all hover:border-primary/30 hover:shadow-md",
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
                                "font-medium text-foreground",
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
                                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </a>
                        )}
                    </div>

                    {/* Meta row */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        <span className="rounded px-1.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
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
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDate(task.dueDate)}
                            </span>
                        )}

                        {/* Assignees */}
                        {task.assignees && task.assignees.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
                                        className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Description preview (non-compact only) */}
                    {!compact && task.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
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
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
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
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
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
            <div className="px-4 py-3 text-sm text-muted-foreground">No task data</div>
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

    // Handle assignees that come as objects
    if (output.assignees && Array.isArray(output.assignees)) {
        task.assignees = (
            output.assignees as Array<{ username?: string; email?: string }>
        ).map((a) => a.username || a.email || "Unknown");
    }

    return (
        <div className="px-4 py-3">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
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
        <div className="mt-3 rounded-lg border border-border/50 bg-muted/20 p-3">
            <h5 className="mb-2 text-xs font-medium text-muted-foreground">
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
// SUCCESS DISPLAYS (Create, Update, Delete)
// ============================================================================

function TaskCreatedDisplay({ output }: { output?: Record<string, unknown> }) {
    const title = output?.title as string;
    const url = output?.url as string;
    const taskId = output?.taskId as string;

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Task created</span>
                    {url && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">{title || taskId}</p>
            </div>
        </div>
    );
}

function TaskUpdatedDisplay({ output }: { output?: Record<string, unknown> }) {
    const title = output?.title as string;
    const status = output?.status as string;

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
                <span className="font-medium text-foreground">Task updated</span>
                <p className="text-sm text-muted-foreground">
                    {title}
                    {status && ` → ${status}`}
                </p>
            </div>
        </div>
    );
}

function TaskDeletedDisplay({ output }: { output?: Record<string, unknown> }) {
    const taskId = output?.taskId as string;

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
                <span className="font-medium text-foreground">Task deleted</span>
                <p className="text-sm text-muted-foreground">ID: {taskId}</p>
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

function CommentCreatedDisplay({ output }: { output?: Record<string, unknown> }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
                <span className="font-medium text-foreground">Comment added</span>
                <p className="text-sm text-muted-foreground">
                    {(output?.note as string) || "Comment posted successfully"}
                </p>
            </div>
        </div>
    );
}

function CommentsDisplay({ output }: { output?: Record<string, unknown> }) {
    const comments = (output?.comments as Comment[]) ?? [];
    const [expanded, setExpanded] = useState(false);

    if (comments.length === 0) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>No comments</span>
            </div>
        );
    }

    const displayComments = expanded ? comments : comments.slice(0, 3);

    return (
        <div className="px-4 py-3">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>
                    {comments.length} comment{comments.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="space-y-2">
                {displayComments.map((comment) => (
                    <div
                        key={comment.id}
                        className="rounded-lg border border-border/50 bg-muted/20 p-3"
                    >
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium">
                                {comment.author}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {formatDate(comment.date)}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.text}</p>
                    </div>
                ))}
            </div>
            {comments.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
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
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>No time entries</span>
            </div>
        );
    }

    const totalMs = entries.reduce((sum, e) => sum + e.durationMs, 0);

    return (
        <div className="px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                        {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
                    </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                    Total: {formatDuration(totalMs)}
                </span>
            </div>
            <div className="space-y-2">
                {entries.map((entry) => (
                    <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                    >
                        <div>
                            <span className="text-sm font-medium">{entry.user}</span>
                            {entry.description && (
                                <p className="text-xs text-muted-foreground">
                                    {entry.description}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-medium">
                                {formatDuration(entry.durationMs)}
                            </span>
                            <p className="text-xs text-muted-foreground">
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
// UTILITY DISPLAYS
// ============================================================================

function DescribeDisplay() {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
                <span className="font-medium text-foreground">ClickUp connected</span>
                <p className="text-sm text-muted-foreground">
                    Ready to manage tasks, lists, and workspaces
                </p>
            </div>
        </div>
    );
}

function RawApiDisplay({ output }: { output?: Record<string, unknown> }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="px-4 py-3">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground"
            >
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span className="flex-1">API call completed</span>
                {output && (
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 transition-transform",
                            expanded && "rotate-180"
                        )}
                    />
                )}
            </button>
            {expanded && output && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(output, null, 2)}
                </pre>
            )}
        </div>
    );
}

function GenericDisplay({
    action,
    output,
}: {
    action: string;
    output?: Record<string, unknown>;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="px-4 py-3">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground"
            >
                <Image
                    src="/logos/clickup.svg"
                    alt="ClickUp"
                    width={16}
                    height={16}
                    className="h-4 w-4 opacity-60"
                />
                <span className="flex-1">Completed {action}</span>
                {output && (
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 transition-transform",
                            expanded && "rotate-180"
                        )}
                    />
                )}
            </button>
            {expanded && output && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(output, null, 2)}
                </pre>
            )}
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
