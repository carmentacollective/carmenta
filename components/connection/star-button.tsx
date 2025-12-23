"use client";

/**
 * StarButton Component
 *
 * A toggle button for starring/unstarring connections.
 * Shows filled star when starred, outline when not.
 * Sparkle animation on starring for delight.
 * Uses consistent icon sizing with other connection actions.
 */

import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

    // Track sparkle animation state
    const [showSparkle, setShowSparkle] = useState(false);
    const sparkleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Trigger sparkle when starring (called from onClick)
    const triggerSparkle = () => {
        if (sparkleTimeoutRef.current) {
            clearTimeout(sparkleTimeoutRef.current);
        }
        setShowSparkle(true);
        sparkleTimeoutRef.current = setTimeout(() => setShowSparkle(false), 600);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (sparkleTimeoutRef.current) {
                clearTimeout(sparkleTimeoutRef.current);
            }
        };
    }, []);

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                // Trigger sparkle only when starring (not unstarring)
                if (!isStarred) {
                    triggerSparkle();
                }
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
            data-tooltip-id="tip"
            data-tooltip-content={label || (isStarred ? "Unpin" : "Keep close")}
            aria-label={label || (isStarred ? "Unstar connection" : "Star connection")}
            aria-pressed={isStarred}
        >
            {/* Sparkle burst on starring */}
            {showSparkle && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {[...Array(6)].map((_, i) => (
                        <span
                            key={i}
                            className="absolute h-1 w-1 rounded-full bg-amber-400"
                            style={{
                                animation: `sparkle-burst 0.6s ease-out forwards`,
                                animationDelay: `${i * 0.05}s`,
                                transform: `rotate(${i * 60}deg)`,
                            }}
                        />
                    ))}
                </span>
            )}
            <Star
                className={cn(
                    iconSize,
                    "transition-all duration-150",
                    isStarred
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-foreground/30 hover:text-foreground/50",
                    // Pop animation on starring
                    showSparkle && "animate-star-pop"
                )}
            />
        </button>
    );
}
