"use client";

import { CaretRightIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ToolIcon } from "./tool-icon";
import {
    type ToolStatus as ToolStatusType,
    getToolConfig,
} from "@/lib/tools/tool-config";

interface ToolStatusProps {
    /** Tool name from the registry */
    toolName: string;
    /** Brief description of what this tool call is doing */
    description?: string;
    /** Current execution status */
    status: ToolStatusType;
    /** Execution duration in milliseconds */
    duration?: number;
    /** Whether the expanded content is visible */
    expanded: boolean;
    /** Called when user clicks to expand/collapse */
    onToggle: () => void;
    /** Additional class names */
    className?: string;
}

/**
 * Unified collapsed view for all tool calls.
 *
 * Fixed height, consistent layout across all tool types.
 * Shows: icon · name · description · status · duration · chevron
 *
 * This component solves the "jolt" problem by ensuring all tools
 * have identical collapsed height regardless of their content.
 */
export function ToolStatus({
    toolName,
    description,
    status,
    duration,
    expanded,
    onToggle,
    className,
}: ToolStatusProps) {
    const config = getToolConfig(toolName, { fallbackToDefault: true });

    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                // Fixed height container
                "flex h-10 w-full items-center gap-3 rounded-lg px-3",
                // Base styles
                "text-left text-sm transition-colors",
                // Interactive states
                "focus-visible:ring-primary/50 hover:bg-white/5 focus-visible:ring-1 focus-visible:outline-none",
                // Status-specific backgrounds
                status === "error" && "bg-holo-blush/10",
                status === "running" && "bg-holo-lavender/5",
                className
            )}
        >
            {/* Tool icon */}
            <ToolIcon
                toolName={toolName}
                className={cn(
                    "h-4 w-4 shrink-0",
                    status === "running" && "animate-pulse"
                )}
            />

            {/* Tool name */}
            <span className="text-foreground/90 shrink-0 font-medium">
                {config.displayName}
            </span>

            {/* Description - truncated */}
            {description && (
                <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground min-w-0 flex-1 truncate">
                        {description}
                    </span>
                </>
            )}

            {/* Spacer when no description */}
            {!description && <span className="flex-1" />}

            {/* Status indicator */}
            <StatusIndicator status={status} />

            {/* Duration */}
            {duration !== undefined && status === "completed" && (
                <span className="text-muted-foreground/60 shrink-0 text-xs">
                    {formatDuration(duration)}
                </span>
            )}

            {/* Expand chevron */}
            <CaretRightIcon
                className={cn(
                    "text-muted-foreground/50 h-4 w-4 shrink-0 transition-transform duration-200",
                    expanded && "rotate-90"
                )}
            />
        </button>
    );
}

/**
 * Compact status indicator - just the icon, no label.
 */
function StatusIndicator({ status }: { status: ToolStatusType }) {
    switch (status) {
        case "pending":
            return (
                <span className="bg-muted-foreground/30 h-2 w-2 shrink-0 rounded-full" />
            );
        case "running":
            return (
                <span className="relative flex h-2 w-2 shrink-0">
                    <span className="bg-holo-lavender absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                    <span className="bg-holo-lavender relative inline-flex h-2 w-2 rounded-full" />
                </span>
            );
        case "completed":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />;
        case "error":
            return <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />;
    }
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 10) {
        return `${seconds.toFixed(1)}s`;
    }
    return `${Math.round(seconds)}s`;
}
