"use client";

import { useState, useEffect, useRef } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { glass, border, spacing } from "@/lib/design-tokens";
import { ToolStatus } from "./tool-status";
import { ToolDebugPanel } from "./tool-debug-panel";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
    type ToolStatus as ToolStatusType,
    getToolConfig,
    getToolDescription,
} from "@/lib/tools/tool-config";
import { formatMcpError, getMcpServerName } from "@/lib/tools/mcp-error-messages";

interface ToolRendererProps {
    /** Tool name from the registry */
    toolName: string;
    /** Unique ID for this tool call */
    toolCallId: string;
    /** Current execution status */
    status: ToolStatusType;
    /** Tool input arguments */
    input: Record<string, unknown>;
    /** Tool output (when completed) */
    output?: Record<string, unknown>;
    /** Error message (when failed) */
    error?: string;
    /** The expanded content to show when user clicks to expand */
    children?: React.ReactNode;
    /** Additional class names */
    className?: string;
}

interface ToolTiming {
    startedAt?: number;
    completedAt?: number;
    durationMs?: number;
}

/**
 * Track timing across status transitions.
 */
function useToolTiming(status: ToolStatusType): ToolTiming {
    const [timing, setTiming] = useState<ToolTiming>({});
    const prevStatusRef = useRef<ToolStatusType | null>(null);

    useEffect(() => {
        const prevStatus = prevStatusRef.current;

        if (status === "running" && prevStatus !== "running") {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing timing state with external status prop
            setTiming({ startedAt: Date.now() });
        }

        if (status === "completed" && prevStatus !== "completed") {
            setTiming((prev) => {
                const now = Date.now();
                const durationMs = prev.startedAt ? now - prev.startedAt : undefined;
                return { ...prev, completedAt: now, durationMs };
            });
        }

        prevStatusRef.current = status;
    }, [status]);

    return timing;
}

/**
 * Tool renderer with fixed-height collapsed state.
 *
 * Solves the "jolt" problem: all tools have consistent collapsed height,
 * so streaming messages don't cause layout shifts.
 *
 * Behavior:
 * - Collapsed by default (fixed height via ToolStatus)
 * - Expands on click to show tool-specific content
 * - Auto-expands on error (if configured)
 * - Smooth animation on expand/collapse
 */
export function ToolRenderer({
    toolName,
    toolCallId: _toolCallId,
    status,
    input,
    output,
    error,
    children,
    className,
}: ToolRendererProps) {
    const permissions = usePermissions();
    const config = getToolConfig(toolName, { fallbackToDefault: true });
    const timing = useToolTiming(status);

    // Collapsed by default - user expands on demand
    const [expanded, setExpanded] = useState(false);

    // Track previous status to detect transitions to error state
    const prevStatusRef = useRef<ToolStatusType | null>(null);

    // Auto-expand on error (configurable per tool, default true)
    useEffect(() => {
        const prevStatus = prevStatusRef.current;
        const shouldAutoExpand = config.autoExpandOnError !== false;

        // Expand on error: either transition to error OR initial render with error
        if (status === "error" && shouldAutoExpand) {
            if (prevStatus === null || prevStatus !== "error") {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing UI state with external error status
                setExpanded(true);
            }
        }

        prevStatusRef.current = status;
    }, [status, config.autoExpandOnError]);

    // Extract description from tool args
    const description = getToolDescription(toolName, input);

    // Only show expanded content when we have children
    const hasExpandedContent = children !== undefined;

    return (
        <div
            className={cn(
                "not-prose mb-2 w-full overflow-hidden rounded-lg",
                glass.subtle,
                border.container,
                className
            )}
        >
            {/* Fixed-height collapsed view */}
            <ToolStatus
                toolName={toolName}
                description={description}
                status={status}
                duration={timing.durationMs}
                expanded={expanded}
                expandable={hasExpandedContent}
                onToggle={() => setExpanded(!expanded)}
            />

            {/* Error message - visible to ALL users when there's an error */}
            {status === "error" && error && (
                <ToolErrorDisplay toolName={toolName} error={error} />
            )}

            {/* Expanded content with animation */}
            {expanded && hasExpandedContent && (
                <div
                    className={cn(
                        "border-t border-white/10",
                        spacing.toolContent,
                        "animate-in fade-in-0 slide-in-from-top-2 duration-200"
                    )}
                >
                    {/* Tool-specific content */}
                    {children}

                    {/* Admin debug panel */}
                    {permissions.isAdmin && (
                        <div className="mt-4 border-t border-dashed border-white/10 pt-3">
                            <ToolDebugPanel
                                toolName={toolName}
                                input={input}
                                output={output}
                                error={error}
                                startedAt={timing.startedAt}
                                completedAt={timing.completedAt}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Error display for tool failures.
 * Shows human-readable message with optional action hint.
 * Visible to ALL users, not just admins.
 */
function ToolErrorDisplay({ toolName, error }: { toolName: string; error: string }) {
    // Get server name for MCP tools
    const isMcpTool = toolName.startsWith("mcp_") || toolName.startsWith("mcp-");
    const serverName = isMcpTool ? getMcpServerName(toolName) : undefined;

    // Format the error for human consumption
    const formatted = formatMcpError(error, serverName);

    return (
        <div
            className={cn(
                "flex items-start gap-2 border-t border-red-500/20 px-3 py-2",
                "bg-red-500/5 text-sm"
            )}
        >
            <WarningCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
                <p className="text-red-600 dark:text-red-400">{formatted.message}</p>
                {formatted.action && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatted.action}
                    </p>
                )}
            </div>
        </div>
    );
}
