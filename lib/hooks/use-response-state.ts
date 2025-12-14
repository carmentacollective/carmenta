"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ConciergeResult } from "@/lib/concierge/types";

/**
 * Response pipeline states - explicit state machine for the chat response flow.
 *
 * State flow:
 * idle → selecting → celebrating → streaming → complete → idle
 *
 * - idle: No active response
 * - selecting: Concierge is choosing the model (shows "Finding our approach...")
 * - celebrating: Model selected, brief celebration animation (400ms)
 * - streaming: LLM is streaming content
 * - complete: Response finished, brief settle state before returning to idle
 */
export type ResponseState =
    | "idle"
    | "selecting"
    | "celebrating"
    | "streaming"
    | "complete";

/**
 * Timing constants for state transitions.
 * These ensure states are visible long enough to be perceived.
 */
const TIMING = {
    /** Minimum time to show "selecting" state (prevents flash) */
    MIN_SELECTING_MS: 400,
    /** Duration of the celebration animation */
    CELEBRATING_MS: 500,
    /** Duration of the complete state before returning to idle */
    COMPLETE_MS: 600,
} as const;

interface UseResponseStateOptions {
    /** True when the chat is in loading state (from useChat) */
    isLoading: boolean;
    /** True when concierge is running (status === "submitted") */
    isConciergeRunning: boolean;
    /** Concierge result data (null until selection completes) */
    concierge: ConciergeResult | null;
}

interface UseResponseStateResult {
    /** Current state in the response pipeline */
    state: ResponseState;
    /** True if we should show the concierge display */
    showConcierge: boolean;
    /** True if we should show the LLM zone (after selection) */
    showLlmZone: boolean;
    /** Avatar state for CarmentaAvatar component */
    avatarState: "idle" | "thinking" | "celebrating" | "speaking" | "breathing";
}

/**
 * Hook that manages the response state machine with proper timing.
 *
 * This ensures:
 * 1. The "selecting" state is visible for at least MIN_SELECTING_MS
 * 2. A "celebrating" animation plays when selection completes
 * 3. States transition smoothly without jarring jumps
 * 4. Fast responses don't cause state flashing
 */
export function useResponseState({
    isLoading,
    isConciergeRunning,
    concierge,
}: UseResponseStateOptions): UseResponseStateResult {
    const [state, setState] = useState<ResponseState>("idle");

    // Track when we entered the selecting state for minimum display time
    const selectingStartTimeRef = useRef<number | null>(null);

    // Track timers for cleanup
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Clear any pending timer
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Deferred setState to avoid synchronous updates in effects
    const deferredSetState = useCallback((newState: ResponseState) => {
        // Use setTimeout(0) to defer setState to next tick, avoiding render cascades
        setTimeout(() => setState(newState), 0);
    }, []);

    // Handle state transitions
    useEffect(() => {
        const now = Date.now();

        // Entering loading state - start selecting
        if (isLoading && isConciergeRunning && !concierge && state === "idle") {
            clearTimer();
            selectingStartTimeRef.current = now;
            deferredSetState("selecting");
            return;
        }

        // Concierge data arrived - transition to celebrating (with minimum display time)
        if (concierge && (state === "selecting" || (isLoading && state === "idle"))) {
            clearTimer();

            const selectingStart = selectingStartTimeRef.current ?? now;
            const elapsed = now - selectingStart;
            const remaining = Math.max(0, TIMING.MIN_SELECTING_MS - elapsed);

            if (remaining > 0) {
                // Wait for minimum selecting time, then celebrate
                timerRef.current = setTimeout(() => {
                    setState("celebrating");
                    // After celebration, move to streaming
                    timerRef.current = setTimeout(() => {
                        setState("streaming");
                    }, TIMING.CELEBRATING_MS);
                }, remaining);
            } else {
                // Already past minimum time, celebrate now
                deferredSetState("celebrating");
                timerRef.current = setTimeout(() => {
                    setState("streaming");
                }, TIMING.CELEBRATING_MS);
            }
            return;
        }

        // Already streaming and still loading - stay in streaming
        if (isLoading && state === "streaming") {
            // No change needed
            return;
        }

        // Response complete - transition to complete state
        if (!isLoading && (state === "streaming" || state === "celebrating")) {
            clearTimer();
            deferredSetState("complete");
            timerRef.current = setTimeout(() => {
                setState("idle");
                selectingStartTimeRef.current = null;
            }, TIMING.COMPLETE_MS);
            return;
        }

        // Edge case: isLoading but we're in idle and have concierge (fast response)
        if (isLoading && state === "idle" && concierge) {
            clearTimer();
            deferredSetState("streaming");
            return;
        }
    }, [isLoading, isConciergeRunning, concierge, state, clearTimer, deferredSetState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimer();
        };
    }, [clearTimer]);

    // Derive display properties from state
    const showConcierge = state !== "idle";
    const showLlmZone =
        state === "celebrating" || state === "streaming" || state === "complete";

    // Map state to avatar animation state
    const avatarState = (() => {
        switch (state) {
            case "selecting":
                return "thinking";
            case "celebrating":
                return "celebrating";
            case "streaming":
                return "speaking";
            case "complete":
                return "breathing";
            default:
                return "idle";
        }
    })();

    return {
        state,
        showConcierge,
        showLlmZone,
        avatarState,
    };
}
