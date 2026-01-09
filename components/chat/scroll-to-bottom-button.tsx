"use client";

/**
 * Scroll-to-bottom button for chat interfaces.
 *
 * Shows when user has scrolled up, disappears when at bottom.
 * Used by HoloThread and CarmentaPanel for consistent UX.
 */

import { memo } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ScrollToBottomButtonProps {
    /** Whether user is currently at/near the bottom */
    isAtBottom: boolean;
    /** Callback to scroll to bottom */
    onScrollToBottom: () => void;
    /** Optional className for positioning */
    className?: string;
}

/**
 * Scroll-to-bottom button.
 * Only renders when user has scrolled up from the bottom.
 * Memoized to prevent unnecessary rerenders during scroll events.
 */
export const ScrollToBottomButton = memo(function ScrollToBottomButton({
    isAtBottom,
    onScrollToBottom,
    className,
}: ScrollToBottomButtonProps) {
    if (isAtBottom) return null;

    return (
        <button
            onClick={onScrollToBottom}
            className={cn(
                "btn-glass-interactive z-sticky flex h-10 w-10 items-center justify-center",
                className
            )}
            aria-label="Scroll to bottom"
        >
            <CaretDownIcon className="text-foreground/70 h-5 w-5" />
        </button>
    );
});
