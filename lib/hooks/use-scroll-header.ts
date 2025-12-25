/**
 * Scroll-Aware Header Hook
 *
 * Hides header on scroll down, shows on scroll up.
 * Maximizes content space while keeping navigation accessible.
 *
 * Features:
 * - Hides header when scrolling down
 * - Shows header when scrolling up (even slightly)
 * - Shows header when at top of page
 * - Configurable scroll threshold
 * - Performance optimized with requestAnimationFrame
 * - No permissions required
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseScrollHeaderOptions {
    /** Minimum scroll delta to trigger hide (default: 10) */
    threshold?: number;
    /** Whether the effect is enabled (default: true) */
    enabled?: boolean;
    /** Container element to listen to (default: window) */
    containerRef?: React.RefObject<HTMLElement>;
}

export interface UseScrollHeaderReturn {
    /** Whether header should be visible */
    isVisible: boolean;
    /** Current scroll position */
    scrollY: number;
    /** Whether user is at the top of the page */
    isAtTop: boolean;
}

export function useScrollHeader({
    threshold = 10,
    enabled = true,
    containerRef,
}: UseScrollHeaderOptions = {}): UseScrollHeaderReturn {
    // Initialize with safe defaults (0 scroll position)
    // Actual position will be set by scroll handler
    const [isVisible, setIsVisible] = useState(true);
    const [scrollY, setScrollY] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);

    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    const getScrollY = useCallback(() => {
        if (containerRef?.current) {
            return containerRef.current.scrollTop;
        }
        return window.scrollY;
    }, [containerRef]);

    const handleScroll = useCallback(() => {
        if (!enabled) return;

        if (!ticking.current) {
            requestAnimationFrame(() => {
                const currentScrollY = getScrollY();
                const delta = currentScrollY - lastScrollY.current;

                setScrollY(currentScrollY);
                setIsAtTop(currentScrollY <= 0);

                // Always show when at top
                if (currentScrollY <= 0) {
                    setIsVisible(true);
                }
                // Scrolling down - hide header (with threshold)
                else if (delta > threshold) {
                    setIsVisible(false);
                }
                // Scrolling up - show header (responsive)
                else if (delta < -threshold / 2) {
                    setIsVisible(true);
                }

                lastScrollY.current = currentScrollY;
                ticking.current = false;
            });

            ticking.current = true;
        }
    }, [enabled, threshold, getScrollY]);

    // Attach scroll listener
    useEffect(() => {
        if (!enabled) return;

        const container = containerRef?.current ?? window;

        container.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            container.removeEventListener("scroll", handleScroll);
        };
    }, [enabled, containerRef, handleScroll]);

    return {
        isVisible,
        scrollY,
        isAtTop,
    };
}
