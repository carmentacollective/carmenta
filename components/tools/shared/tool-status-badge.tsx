"use client";

import { Circle, Clock, CheckCircle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface ToolStatusBadgeProps {
    status: ToolStatus;
    label: string;
    className?: string;
}

/**
 * Status badge for tool execution with four states.
 *
 * Visual design follows Vercel AI Chatbot patterns with
 * Carmenta's holographic color palette:
 * - Pending: Muted gray, subtle
 * - Running: Soft lavender with pulse animation
 * - Completed: Mint green with checkmark
 * - Error: Coral/blush with X
 */
export function ToolStatusBadge({ status, label, className }: ToolStatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                "transition-all duration-200",
                {
                    // Pending: subtle gray
                    "bg-muted/50 text-muted-foreground": status === "pending",
                    // Running: soft lavender with pulse
                    "bg-holo-lavender/30 text-foreground/80": status === "running",
                    // Completed: mint green
                    "bg-holo-mint/30 text-foreground/80": status === "completed",
                    // Error: coral/blush
                    "bg-holo-blush/50 text-red-700": status === "error",
                },
                className
            )}
        >
            <StatusIcon status={status} />
            <span>{label}</span>
        </span>
    );
}

function StatusIcon({ status }: { status: ToolStatus }) {
    const iconClass = "h-3.5 w-3.5";

    switch (status) {
        case "pending":
            return <Circle className={cn(iconClass, "text-muted-foreground/60")} />;
        case "running":
            return <Clock className={cn(iconClass, "text-primary/70 animate-pulse")} />;
        case "completed":
            return (
                <CheckCircle
                    className={cn(iconClass, "text-green-600 dark:text-green-400")}
                />
            );
        case "error":
            return <XCircle className={cn(iconClass, "text-red-500")} />;
    }
}
