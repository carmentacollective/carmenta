"use client";

/**
 * Composer-integrated scroll indicator.
 *
 * Replaces the floating scroll-to-bottom button with an integrated strip
 * at the top of the composer area. Benefits:
 * - No z-index conflicts (part of composer stacking context)
 * - Never covers message content
 * - Larger touch target (full width)
 * - Feels integrated rather than bolted-on
 *
 * @see knowledge/components/chat-scroll-navigation.md
 */

import { memo } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ComposerScrollIndicatorProps {
    /** Whether user is currently at/near the bottom */
    isAtBottom: boolean;
    /** Callback to scroll to bottom */
    onScrollToBottom: () => void;
    /** Optional className for customization */
    className?: string;
}

/**
 * Scroll indicator strip that appears above the composer when scrolled up.
 * Clicking anywhere on the strip scrolls to the latest message.
 */
export const ComposerScrollIndicator = memo(function ComposerScrollIndicator({
    isAtBottom,
    onScrollToBottom,
    className,
}: ComposerScrollIndicatorProps) {
    return (
        <button
            onClick={onScrollToBottom}
            className={cn(
                // Base layout - full width clickable strip
                "flex w-full items-center justify-center gap-2",
                // Height transition: 0 when at bottom, 32px when scrolled up
                "overflow-hidden transition-all duration-150 ease-out",
                isAtBottom ? "h-0 opacity-0" : "h-8 opacity-100",
                // Visual treatment - subtle gradient matching composer blur
                "from-foreground/[0.03] bg-gradient-to-b to-transparent",
                // Text styling
                "text-muted-foreground text-xs font-medium",
                // Hover state
                "hover:from-foreground/[0.06] hover:text-foreground/80",
                // Focus ring for accessibility
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                className
            )}
            aria-label="Return to latest messages"
            // Keep button in DOM but hidden for screen readers when at bottom
            aria-hidden={isAtBottom}
            tabIndex={isAtBottom ? -1 : 0}
        >
            <CaretDown className="size-4" />
            <span>Return to latest</span>
        </button>
    );
});
