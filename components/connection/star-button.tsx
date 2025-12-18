"use client";

/**
 * StarButton Component
 *
 * A toggle button for starring/unstarring connections.
 * Shows filled star when starred, outline when not.
 * Uses consistent icon sizing with other connection actions.
 */

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarButtonProps {
    isStarred: boolean;
    onToggle: () => void;
    /** Size variant */
    size?: "sm" | "md";
    /** Additional CSS classes */
    className?: string;
    /** Whether to always show or only on hover (requires parent to have group class) */
    showOnHover?: boolean;
    /** Accessible label */
    label?: string;
}

export function StarButton({
    isStarred,
    onToggle,
    size = "sm",
    className,
    showOnHover = false,
    label,
}: StarButtonProps) {
    const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    const padding = size === "sm" ? "p-1.5" : "p-2";

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
            className={cn(
                "relative z-10 rounded-md transition-all",
                padding,
                // Visibility: always show if starred, otherwise follow showOnHover
                isStarred
                    ? "opacity-100"
                    : showOnHover
                      ? "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      : "opacity-100",
                // Background on hover
                isStarred ? "hover:bg-amber-50" : "hover:bg-foreground/5",
                // Focus ring
                "focus-visible:ring-2",
                isStarred
                    ? "focus-visible:ring-amber-300"
                    : "focus-visible:ring-foreground/20",
                className
            )}
            title={label || (isStarred ? "Unstar connection" : "Star connection")}
            aria-label={label || (isStarred ? "Unstar connection" : "Star connection")}
            aria-pressed={isStarred}
        >
            <Star
                className={cn(
                    iconSize,
                    "transition-all duration-150",
                    isStarred
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-foreground/30 hover:text-foreground/50"
                )}
            />
        </button>
    );
}
