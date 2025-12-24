"use client";

/**
 * useMultiClick - Detect rapid multiple clicks on an element
 *
 * Returns a click handler and state for triggering effects
 * after a certain number of rapid clicks.
 */

import { useState, useRef, useCallback } from "react";

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

    const handleClick = useCallback(() => {
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
            setIsTriggered(true);
            clickTimesRef.current = [];
            cooldownRef.current = true;

            // Reset triggered state after animation time
            setTimeout(() => setIsTriggered(false), 1000);

            // Reset cooldown
            setTimeout(() => {
                cooldownRef.current = false;
            }, cooldown);
        }
    }, [threshold, timeWindow, cooldown]);

    return { isTriggered, handleClick };
}
