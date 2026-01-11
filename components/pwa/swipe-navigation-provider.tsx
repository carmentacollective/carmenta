/**
 * Swipe Navigation Provider
 *
 * Client wrapper that wires useSwipeNavigation hook to SwipeBackIndicator.
 * Add to root layout for global swipe-from-edge back navigation.
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useSwipeNavigation } from "@/lib/hooks/use-swipe-navigation";
import { SwipeBackIndicator } from "./swipe-back-indicator";

export function SwipeNavigationProvider() {
    const { swipeDistance, isSwiping, progress } = useSwipeNavigation();

    return (
        <SwipeBackIndicator
            progress={progress}
            isSwiping={isSwiping}
            swipeDistance={swipeDistance}
        />
    );
}
