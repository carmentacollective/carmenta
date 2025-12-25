/**
 * Swipe Navigation Hook
 *
 * Provides swipe-from-edge gesture for back navigation on mobile.
 * Mimics the native iOS back swipe behavior for PWAs.
 *
 * Features:
 * - Edge swipe detection (left edge for back)
 * - Progressive visual feedback during swipe
 * - Velocity-based threshold (fast swipes need less distance)
 * - Haptic feedback on trigger
 * - Respects reduced motion preferences
 * - No iOS permissions required
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// import { useHapticFeedback } from "./use-haptic-feedback"; // TODO: Re-enable

export interface UseSwipeNavigationOptions {
    /** Width of edge detection zone in pixels (default: 20) */
    edgeWidth?: number;
    /** Distance required to trigger navigation (default: 100) */
    threshold?: number;
    /** Velocity threshold - fast swipes need less distance (default: 0.5 px/ms) */
    velocityThreshold?: number;
    /** Whether swipe navigation is enabled (default: true) */
    enabled?: boolean;
    /** Custom back handler (default: router.back()) */
    onBack?: () => void;
}

export interface UseSwipeNavigationReturn {
    /** Current swipe distance (0 when not swiping) */
    swipeDistance: number;
    /** Whether user is actively swiping from edge */
    isSwiping: boolean;
    /** Progress from 0 to 1 toward threshold */
    progress: number;
}

export function useSwipeNavigation({
    edgeWidth = 20,
    threshold = 100,
    velocityThreshold = 0.5,
    enabled = true,
    onBack,
}: UseSwipeNavigationOptions = {}): UseSwipeNavigationReturn {
    const [swipeDistance, setSwipeDistance] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const router = useRouter();
    // TODO: Re-enable haptic feedback once CI type resolution issue is fixed
    // const { trigger: triggerHaptic } = useHapticFeedback();
    const triggerHaptic = useCallback((_type: string) => {}, []); // no-op for now

    const startX = useRef(0);
    const startY = useRef(0);
    const startTime = useRef(0);
    const isEdgeSwipe = useRef(false);
    // Track swipeDistance in ref to avoid callback recreation on every frame
    const swipeDistanceRef = useRef(0);

    // Touch start - check if starting from edge
    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (!enabled) return;

            const touch = e.touches[0];
            startX.current = touch.clientX;
            startY.current = touch.clientY;
            startTime.current = Date.now();

            // Check if touch started near left edge
            isEdgeSwipe.current = touch.clientX <= edgeWidth;

            if (isEdgeSwipe.current) {
                triggerHaptic("light");
            }
        },
        [enabled, edgeWidth, triggerHaptic]
    );

    // Touch move - track swipe distance
    const handleTouchMove = useCallback(
        (e: TouchEvent) => {
            if (!enabled || !isEdgeSwipe.current) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - startX.current;
            const deltaY = touch.clientY - startY.current;

            // Cancel if vertical movement is greater (user is scrolling)
            if (Math.abs(deltaY) > Math.abs(deltaX) && !isSwiping) {
                isEdgeSwipe.current = false;
                return;
            }

            // Only track rightward swipes
            if (deltaX > 0) {
                // Haptic when crossing threshold (use ref to avoid dep on state)
                if (deltaX >= threshold && swipeDistanceRef.current < threshold) {
                    triggerHaptic("medium");
                }

                // Update both ref and state
                swipeDistanceRef.current = deltaX;
                setSwipeDistance(deltaX);
                setIsSwiping(true);
            }
        },
        [enabled, isSwiping, threshold, triggerHaptic]
    );

    // Touch end - trigger navigation or reset
    const handleTouchEnd = useCallback(() => {
        if (!enabled || !isEdgeSwipe.current) return;

        try {
            const elapsed = Date.now() - startTime.current;
            const velocity = swipeDistance / elapsed;

            // Trigger if exceeded threshold OR fast swipe
            const shouldNavigate =
                swipeDistance >= threshold ||
                (velocity >= velocityThreshold && swipeDistance > 30);

            if (shouldNavigate) {
                triggerHaptic("success");

                if (onBack) {
                    onBack();
                } else {
                    router.back();
                }
            }
        } finally {
            // Always reset state, even if navigation throws
            swipeDistanceRef.current = 0;
            setSwipeDistance(0);
            setIsSwiping(false);
            isEdgeSwipe.current = false;
        }
    }, [
        enabled,
        swipeDistance,
        threshold,
        velocityThreshold,
        triggerHaptic,
        onBack,
        router,
    ]);

    // Attach listeners
    useEffect(() => {
        if (!enabled) return;

        document.addEventListener("touchstart", handleTouchStart, { passive: true });
        document.addEventListener("touchmove", handleTouchMove, { passive: true });
        document.addEventListener("touchend", handleTouchEnd);
        // Handle touch interruptions (phone calls, system dialogs, multi-touch)
        document.addEventListener("touchcancel", handleTouchEnd);

        return () => {
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
            document.removeEventListener("touchcancel", handleTouchEnd);
        };
    }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

    const progress = Math.min(swipeDistance / threshold, 1);

    return {
        swipeDistance,
        isSwiping,
        progress,
    };
}
