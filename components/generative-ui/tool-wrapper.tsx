"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToolStatusBadge } from "./tool-status-badge";
import { ToolDebugPanel } from "./tool-debug-panel";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import {
    type ToolStatus,
    getToolConfig,
    getStatusMessage,
    getErrorMessage,
    isFirstToolUse,
    getFirstUseMessage,
} from "@/lib/tools/tool-config";

interface ToolWrapperProps {
    /** Tool name (e.g., "getWeather", "compareOptions") */
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
    /** The rendered tool result (e.g., WeatherCard) */
    children: React.ReactNode;
    className?: string;
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
 *   toolName="getWeather"
 *   toolCallId={toolCallId}
 *   status={status}
 *   input={args}
 *   output={result}
 * >
 *   <WeatherCard result={result} />
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
    className,
}: ToolWrapperProps) {
    const isAdmin = useIsAdmin();
    const config = getToolConfig(toolName);
    const Icon = config.icon;

    // Track timing for duration-based delight
    const prevStatusRef = useRef<ToolStatus | null>(null);
    const [timing, setTiming] = useState<{
        startedAt?: number;
        durationMs?: number;
        completedAt?: number;
    }>({});

    // Track first use celebration
    const [showFirstUse, setShowFirstUse] = useState(false);

    // Default to open when running, closed when completed
    const [isOpen, setIsOpen] = useState(status !== "completed");

    // Track status transitions and capture timing
    useEffect(() => {
        const prevStatus = prevStatusRef.current;
        const currentStatus = status;

        // Status changed to running - capture start time
        // This is a legitimate use case: capturing external state (time) at a specific moment
        if (currentStatus === "running" && prevStatus !== "running") {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- capturing timestamp at status transition
            setTiming((prev) => ({ ...prev, startedAt: Date.now() }));
        }

        // Status changed to completed - calculate duration
        if (currentStatus === "completed" && prevStatus !== "completed") {
            setTiming((prev) => {
                if (prev.startedAt) {
                    const now = Date.now();
                    return {
                        ...prev,
                        durationMs: now - prev.startedAt,
                        completedAt: now,
                    };
                }
                return prev;
            });
        }

        prevStatusRef.current = currentStatus;
    }, [status]);

    // Check for first use when tool completes
    useEffect(() => {
        if (status === "completed") {
            if (isFirstToolUse(toolName)) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time celebration trigger
                setShowFirstUse(true);
                // Hide after 2 seconds
                const timer = setTimeout(() => setShowFirstUse(false), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [status, toolName]);

    // Auto-collapse when completed (after a brief delay to show result)
    useEffect(() => {
        if (status === "completed" && isOpen) {
            const timer = setTimeout(() => setIsOpen(false), 300);
            return () => clearTimeout(timer);
        }
    }, [status, isOpen]);

    // Get the appropriate status message (with potential delight)
    const statusLabel =
        status === "error"
            ? getErrorMessage(toolName, error)
            : getStatusMessage(toolName, status, toolCallId, timing.durationMs);

    // First use message
    const firstUseMessage = showFirstUse ? getFirstUseMessage(toolName) : null;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn(
                "not-prose mb-4 w-full rounded-lg border border-white/20",
                "bg-white/30 backdrop-blur-sm",
                className
            )}
        >
            {/* Header */}
            <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                        {config.displayName}
                    </span>
                    {/* First use celebration */}
                    {firstUseMessage && (
                        <span className="bg-holo-mint/40 rounded-full px-2 py-0.5 text-xs animate-in fade-in slide-in-from-left-2">
                            {firstUseMessage}
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
                <div className="border-t border-white/10 p-4">
                    {/* Tool result UI */}
                    {children}

                    {/* Admin debug panel */}
                    {isAdmin && (
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
