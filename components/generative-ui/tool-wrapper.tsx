"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { glass, border, spacing } from "@/lib/design-tokens";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToolStatusBadge } from "./tool-status-badge";
import { ToolDebugPanel } from "./tool-debug-panel";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
    type ToolStatus,
    getToolConfig,
    getStatusMessage,
    getErrorMessage,
    isFirstToolUse,
    getFirstUseMessage,
} from "@/lib/tools/tool-config";

interface ToolWrapperProps {
    /** Tool name (e.g., "compareOptions", "webSearch") */
    toolName: string;
    /** Unique ID for this tool call */
    toolCallId: string;
    /** Current status */
    status: ToolStatus;
    /** Tool input parameters */
    input: unknown;
    /** Tool output (when completed) */
    output?: unknown;
    /** Error message (when failed) */
    error?: string;
    /** The rendered tool result (e.g., ComparisonTable). Optional for compact variant. */
    children?: React.ReactNode;
    /**
     * Visual variant:
     * - standard: Full collapsible container with header, status badge, debug panel
     * - compact: Single-line status, minimal chrome, inline display
     */
    variant?: "standard" | "compact";
    className?: string;
}

interface ToolTiming {
    startedAt?: number;
    completedAt?: number;
    durationMs?: number;
}

/**
 * Custom hook to track timing across status transitions.
 *
 * Uses state-only approach: captures start time when status becomes "running"
 * and calculates duration when status becomes "completed".
 *
 * The timing state is set via setTimeout(0) to defer the setState call,
 * avoiding the "set-state-in-effect" lint warning while still responding
 * to status changes in the same tick.
 */
function useToolTiming(status: ToolStatus): ToolTiming {
    const [timing, setTiming] = useState<ToolTiming>({});
    const prevStatusRef = useRef<ToolStatus | null>(null);

    useEffect(() => {
        const prevStatus = prevStatusRef.current;

        // Transition to running: capture start time
        if (status === "running" && prevStatus !== "running") {
            // Defer to next microtask to avoid "set-state-in-effect" warning
            setTimeout(() => {
                setTiming({ startedAt: Date.now() });
            }, 0);
        }

        // Transition to completed: calculate duration
        if (status === "completed" && prevStatus !== "completed") {
            setTimeout(() => {
                setTiming((prev) => {
                    const now = Date.now();
                    const durationMs = prev.startedAt
                        ? now - prev.startedAt
                        : undefined;
                    return {
                        ...prev,
                        completedAt: now,
                        durationMs,
                    };
                });
            }, 0);
        }

        prevStatusRef.current = status;
    }, [status]);

    return timing;
}

/**
 * Custom hook to show first-use celebration.
 *
 * Tracks whether this is the first time using a tool in this session.
 * Shows celebration message for 2 seconds, then hides it.
 * Only triggers once per tool per session.
 */
function useFirstUseCelebration(toolName: string, status: ToolStatus) {
    const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        // Only check once when status becomes completed
        if (status !== "completed" || hasCheckedRef.current) return;

        hasCheckedRef.current = true;

        if (isFirstToolUse(toolName)) {
            // Use setTimeout to show message (avoids "set-state-in-effect" warning)
            // then clear after 2 seconds
            const showTimer = setTimeout(() => {
                setCelebrationMessage(getFirstUseMessage(toolName));
            }, 0);

            const hideTimer = setTimeout(() => {
                setCelebrationMessage(null);
            }, 2000);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [status, toolName]);

    return celebrationMessage;
}

/**
 * Wrapper for tool UIs with status, delight, and debug features.
 *
 * Features:
 * - Collapsible container with tool header
 * - Status badge with 4 states
 * - Tool-specific friendly messaging
 * - Occasional delight variants
 * - First-use celebration
 * - Admin debug panel
 *
 * Usage:
 * ```tsx
 * <ToolWrapper
 *   toolName="compareOptions"
 *   toolCallId={toolCallId}
 *   status={status}
 *   input={args}
 *   output={result}
 * >
 *   <ComparisonTable result={result} />
 * </ToolWrapper>
 * ```
 */
export function ToolWrapper({
    toolName,
    toolCallId,
    status,
    input,
    output,
    error,
    children,
    variant = "standard",
    className,
}: ToolWrapperProps) {
    const permissions = usePermissions();
    // Use fallback for UI rendering - gracefully handle unknown tools
    const config = getToolConfig(toolName, { fallbackToDefault: true });

    // Track timing across status transitions
    const timing = useToolTiming(status);

    // First-use celebration (only shows once per tool per session)
    const celebrationMessage = useFirstUseCelebration(toolName, status);

    // Track whether user has manually interacted with the collapsible
    const [userInteracted, setUserInteracted] = useState(false);

    // Default to open when running, closed when completed (unless user opened it)
    const [isOpen, setIsOpen] = useState(status !== "completed");

    // Auto-collapse only on initial completion, not when user re-opens
    useEffect(() => {
        // Skip if user has manually interacted
        if (userInteracted) return;

        // When status transitions to completed, collapse after brief delay
        if (status === "completed" && isOpen) {
            const timer = setTimeout(() => setIsOpen(false), 800);
            return () => clearTimeout(timer);
        }
    }, [status, isOpen, userInteracted]);

    // Wrap setIsOpen to track user interaction
    const handleOpenChange = (open: boolean) => {
        setUserInteracted(true);
        setIsOpen(open);
    };

    // Get the appropriate status message (with potential delight)
    const statusLabel =
        status === "error"
            ? getErrorMessage(toolName, error)
            : getStatusMessage(toolName, status, toolCallId, timing.durationMs);

    // Render icon: either a Lucide component or an SVG logo
    const renderIcon = (size: "sm" | "md" = "md") => {
        const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
        if (typeof config.icon === "string") {
            // Logo path (decorative - display name is adjacent)
            return (
                <Image
                    src={config.icon}
                    alt=""
                    width={size === "sm" ? 14 : 16}
                    height={size === "sm" ? 14 : 16}
                    className={cn(sizeClass, "shrink-0")}
                />
            );
        } else {
            // Lucide icon component
            const Icon = config.icon;
            return <Icon className={cn(sizeClass, "shrink-0 text-muted-foreground")} />;
        }
    };

    // Compact variant: minimal inline display
    if (variant === "compact") {
        const isError = status === "error";

        return (
            <div className={cn("not-prose", spacing.inlineResult, className)}>
                <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
                    <CollapsibleTrigger
                        className={cn(
                            "group flex w-full items-center gap-2 text-left text-sm transition-colors",
                            isError
                                ? "text-destructive"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {isError ? (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                            renderIcon("sm")
                        )}
                        <span className="flex-1">{statusLabel}</span>
                        {status === "running" && (
                            <span className="animate-pulse text-xs">...</span>
                        )}
                        {status === "completed" && children && (
                            <ChevronDown
                                className={cn(
                                    "h-3.5 w-3.5 transition-transform duration-200",
                                    isOpen ? "rotate-180" : "rotate-0"
                                )}
                            />
                        )}
                    </CollapsibleTrigger>

                    {status === "completed" && children && (
                        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
                            <div className="mt-2 text-sm">{children}</div>
                        </CollapsibleContent>
                    )}
                </Collapsible>
            </div>
        );
    }

    // Standard variant: full collapsible container
    return (
        <Collapsible
            open={isOpen}
            onOpenChange={handleOpenChange}
            className={cn(
                "not-prose mb-4 w-full rounded-lg",
                glass.subtle,
                border.container,
                className
            )}
        >
            {/* Header */}
            <CollapsibleTrigger
                className={cn(
                    "flex w-full min-w-0 items-center justify-between gap-2",
                    spacing.toolHeader
                )}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {renderIcon()}
                    <span className="truncate text-sm font-medium">
                        {config.displayName}
                    </span>
                    {/* First use celebration */}
                    {celebrationMessage && (
                        <span className="bg-holo-mint/40 rounded-full px-2 py-0.5 text-xs animate-in fade-in slide-in-from-left-2">
                            {celebrationMessage}
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <ToolStatusBadge status={status} label={statusLabel} />
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            isOpen ? "rotate-180" : "rotate-0"
                        )}
                    />
                </div>
            </CollapsibleTrigger>

            {/* Content */}
            <CollapsibleContent
                className={cn(
                    "overflow-hidden",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2"
                )}
            >
                <div className={cn("border-t border-white/10", spacing.toolContent)}>
                    {/* Tool result UI */}
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
            </CollapsibleContent>
        </Collapsible>
    );
}
