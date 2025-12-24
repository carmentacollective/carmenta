"use client";

/**
 * useMultiClick - Detect rapid multiple clicks on an element
 *
 * Returns a click handler and state for triggering effects
 * after a certain number of rapid clicks.
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface UseMultiClickOptions {
    /** Number of clicks required to trigger */
    threshold?: number;
    /** Time window in ms for clicks to count */
    timeWindow?: number;
    /** Cooldown in ms after triggering before can trigger again */
    cooldown?: number;
}

export function useMultiClick({
    threshold = 5,
    timeWindow = 1000,
    cooldown = 3000,
}: UseMultiClickOptions = {}) {
    const [isTriggered, setIsTriggered] = useState(false);
    const clickTimesRef = useRef<number[]>([]);
    const cooldownRef = useRef(false);
    const triggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (triggerTimeoutRef.current) {
                clearTimeout(triggerTimeoutRef.current);
            }
            if (cooldownTimeoutRef.current) {
                clearTimeout(cooldownTimeoutRef.current);
            }
        };
    }, []);

    const handleClick = useCallback(
        (event?: React.MouseEvent) => {
            // Ignore if in cooldown
            if (cooldownRef.current) return;

            const now = Date.now();
            const clicks = clickTimesRef.current;

            // Add current click
            clicks.push(now);

            // Remove clicks outside time window
            const cutoff = now - timeWindow;
            while (clicks.length > 0 && clicks[0] < cutoff) {
                clicks.shift();
            }

            // Check if threshold reached
            if (clicks.length >= threshold) {
                // Prevent parent handlers (like Link navigation) from firing
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                setIsTriggered(true);
                clickTimesRef.current = [];
                cooldownRef.current = true;

                // Clear previous timeouts if they exist
                if (triggerTimeoutRef.current) {
                    clearTimeout(triggerTimeoutRef.current);
                }
                if (cooldownTimeoutRef.current) {
                    clearTimeout(cooldownTimeoutRef.current);
                }

                // Reset triggered state after animation time
                triggerTimeoutRef.current = setTimeout(() => {
                    setIsTriggered(false);
                    triggerTimeoutRef.current = null;
                }, 1000);

                // Reset cooldown
                cooldownTimeoutRef.current = setTimeout(() => {
                    cooldownRef.current = false;
                    cooldownTimeoutRef.current = null;
                }, cooldown);
            }
        },
        [threshold, timeWindow, cooldown]
    );

    return { isTriggered, handleClick };
}
