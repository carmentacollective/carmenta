"use client";

import { useState, useEffect, useRef } from "react";

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
            setTimeout(() => {
                setTiming({ startedAt: Date.now() });
            }, 0);
        }

        if (status === "completed" && prevStatus !== "completed") {
            setTimeout(() => {
                setTiming((prev) => {
                    const now = Date.now();
                    const durationMs = prev.startedAt
                        ? now - prev.startedAt
                        : undefined;
                    return { ...prev, completedAt: now, durationMs };
                });
            }, 0);
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

    // Auto-expand on error transition (configurable per tool, default true)
    useEffect(() => {
        const prevStatus = prevStatusRef.current;
        const shouldAutoExpand = config.autoExpandOnError !== false;

        // Only expand on transition TO error state
        if (status === "error" && prevStatus !== "error" && shouldAutoExpand) {
            // Defer to avoid synchronous setState in effect
            setTimeout(() => setExpanded(true), 0);
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
                onToggle={() => hasExpandedContent && setExpanded(!expanded)}
                className={!hasExpandedContent ? "cursor-default" : undefined}
            />

            {/* Expanded content with animation */}
            {expanded && hasExpandedContent && (
                <div
                    className={cn(
                        "border-t border-white/10",
                        spacing.toolContent,
                        "duration-200 animate-in fade-in-0 slide-in-from-top-2"
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
