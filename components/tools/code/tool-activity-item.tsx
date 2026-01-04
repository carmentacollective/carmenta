"use client";

/**
 * ToolActivityItem - Beautiful inline tool activity display
 *
 * Shows Claude Code tool execution as a compact, scannable activity item:
 * - Status indicator (green=complete, amber=running, red=error)
 * - Tool icon and name
 * - Brief parameter summary
 * - Result summary (when complete)
 * - Expands on click to show full detailed view
 *
 * Designed for inline sequential display within message flow,
 * replacing the floating pills approach.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretRight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ToolIcon } from "../shared";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface ToolActivityItemProps {
    toolCallId: string;
    toolName: string;
    status: ToolStatus;
    /** Brief description of what this tool is doing */
    summary: string;
    /** Result summary shown when complete (e.g., "Read 61 lines", "3 matches") */
    resultSummary?: string;
    /** The expanded detail view - existing card components */
    children: React.ReactNode;
    /** Additional class names */
    className?: string;
}

/**
 * Status indicator with beautiful animations
 */
function StatusDot({ status }: { status: ToolStatus }) {
    switch (status) {
        case "pending":
            return (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-400/40" />
            );
        case "running":
            return (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                </span>
            );
        case "completed":
            return (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            );
        case "error":
            return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />;
    }
}

export function ToolActivityItem({
    toolCallId,
    toolName,
    status,
    summary,
    resultSummary,
    children,
    className,
}: ToolActivityItemProps) {
    const [expanded, setExpanded] = useState(false);
    const isComplete = status === "completed";
    const isRunning = status === "running";
    const isError = status === "error";

    // Auto-expand on error
    const shouldAutoExpand = isError && !expanded;
    if (shouldAutoExpand) {
        // Use effect would cause extra render, this is immediate
        setExpanded(true);
    }

    return (
        <div className={cn("w-full", className)} data-tool-call-id={toolCallId}>
            {/* Compact activity row */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "group flex w-full items-center gap-2.5 px-1 py-2 text-left",
                    "transition-colors duration-150",
                    "rounded-lg hover:bg-white/5",
                    // Status-specific subtle backgrounds
                    isRunning && "bg-amber-500/5",
                    isError && "bg-red-500/5"
                )}
            >
                {/* Status dot */}
                <StatusDot status={status} />

                {/* Tool icon */}
                <ToolIcon
                    toolName={toolName}
                    className={cn(
                        "text-muted-foreground h-4 w-4 shrink-0",
                        isRunning && "animate-pulse"
                    )}
                />

                {/* Tool name */}
                <span className="text-foreground/90 shrink-0 text-sm font-medium">
                    {toolName}
                </span>

                {/* Summary / params */}
                <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-sm">
                    {summary}
                </span>

                {/* Result summary - elegant right-aligned */}
                {resultSummary && isComplete && (
                    <span className="text-muted-foreground/70 shrink-0 text-xs font-medium">
                        {resultSummary}
                    </span>
                )}

                {/* Expand chevron */}
                <CaretRight
                    className={cn(
                        "text-muted-foreground/40 h-4 w-4 shrink-0 transition-transform duration-200",
                        "group-hover:text-muted-foreground/60",
                        expanded && "rotate-90"
                    )}
                />
            </button>

            {/* Expanded detail view */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="pt-1 pb-2 pl-7">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Result row - shows indented result below the tool activity
 * For tools that have simple text results that should show inline
 */
interface ResultRowProps {
    children: React.ReactNode;
    className?: string;
}

export function ResultRow({ children, className }: ResultRowProps) {
    return (
        <div className={cn("flex items-start gap-2.5 py-0.5 pl-5", className)}>
            {/* Tree connector */}
            <span className="text-muted-foreground/40 text-sm select-none">└</span>
            {/* Result content */}
            <span className="text-muted-foreground text-sm">{children}</span>
        </div>
    );
}
