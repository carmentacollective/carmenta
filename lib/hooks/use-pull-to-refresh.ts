/**
 * Pull-to-Refresh Hook
 *
 * Provides native-feeling pull-to-refresh gesture support for PWAs.
 * Detects overscroll at the top and triggers refresh after threshold.
 *
 * Features:
 * - Works with touch devices (iOS Safari, Android Chrome)
 * - Progressive feedback during pull (stretch indicator)
 * - Haptic feedback on trigger
 * - Respects reduced motion preferences
 * - No iOS permissions required
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHapticFeedback } from "./use-haptic-feedback";

export interface UsePullToRefreshOptions {
    /** Callback when refresh is triggered */
    onRefresh: () => void | Promise<void>;
    /** Distance in pixels to trigger refresh (default: 80) */
    threshold?: number;
    /** Maximum pull distance in pixels (default: 150) */
    maxPull?: number;
    /** Whether pull-to-refresh is enabled (default: true) */
    enabled?: boolean;
    /** Element to attach touch handlers to (default: document) */
    containerRef?: React.RefObject<HTMLElement>;
}

export interface UsePullToRefreshReturn {
    /** Current pull distance (0 to maxPull) */
    pullDistance: number;
    /** Whether refresh is in progress */
    isRefreshing: boolean;
    /** Whether user is actively pulling */
    isPulling: boolean;
    /** Progress from 0 to 1 toward threshold */
    progress: number;
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    maxPull = 150,
    enabled = true,
    containerRef,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const startY = useRef(0);
    const currentY = useRef(0);
    const { triggerHaptic } = useHapticFeedback();

    // Check if at top of scroll container
    const isAtTop = useCallback(() => {
        const container = containerRef?.current;
        if (container) {
            return container.scrollTop <= 0;
        }
        return window.scrollY <= 0;
    }, [containerRef]);

    // Touch start - record position
    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (!enabled || isRefreshing) return;

            startY.current = e.touches[0].clientY;
            currentY.current = startY.current;
        },
        [enabled, isRefreshing]
    );

    // Touch move - calculate pull distance
    const handleTouchMove = useCallback(
        (e: TouchEvent) => {
            if (!enabled || isRefreshing) return;
            if (!isAtTop()) return;

            currentY.current = e.touches[0].clientY;
            const delta = currentY.current - startY.current;

            // Only activate when pulling down
            if (delta > 0) {
                // Apply resistance curve for natural feel
                const resistance = Math.min(delta / 2.5, maxPull);
                setPullDistance(resistance);
                setIsPulling(true);

                // Haptic feedback when crossing threshold
                if (resistance >= threshold && pullDistance < threshold) {
                    triggerHaptic("medium");
                }

                // Prevent default scrolling when pulling
                if (resistance > 10) {
                    e.preventDefault();
                }
            }
        },
        [
            enabled,
            isRefreshing,
            isAtTop,
            maxPull,
            threshold,
            pullDistance,
            triggerHaptic,
        ]
    );

    // Touch end - trigger refresh or reset
    const handleTouchEnd = useCallback(async () => {
        if (!enabled || isRefreshing) return;

        if (pullDistance >= threshold) {
            setIsRefreshing(true);
            triggerHaptic("success");

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }

        // Reset
        setPullDistance(0);
        setIsPulling(false);
        startY.current = 0;
        currentY.current = 0;
    }, [enabled, isRefreshing, pullDistance, threshold, triggerHaptic, onRefresh]);

    // Attach listeners
    useEffect(() => {
        if (!enabled) return;

        const container = containerRef?.current ?? document;
        const options: AddEventListenerOptions = { passive: false };

        container.addEventListener(
            "touchstart",
            handleTouchStart as EventListener,
            options
        );
        container.addEventListener(
            "touchmove",
            handleTouchMove as EventListener,
            options
        );
        container.addEventListener("touchend", handleTouchEnd as EventListener);

        return () => {
            container.removeEventListener(
                "touchstart",
                handleTouchStart as EventListener
            );
            container.removeEventListener(
                "touchmove",
                handleTouchMove as EventListener
            );
            container.removeEventListener("touchend", handleTouchEnd as EventListener);
        };
    }, [enabled, containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

    const progress = Math.min(pullDistance / threshold, 1);

    return {
        pullDistance,
        isRefreshing,
        isPulling,
        progress,
    };
}
