"use client";

import { useState, useEffect, useRef } from "react";
import { type ToolStatus } from "@/lib/tools/tool-config";

export interface ToolTiming {
    startedAt?: number;
    completedAt?: number;
    durationMs?: number;
}

/**
 * Track timing across tool status transitions.
 *
 * Captures start time when status becomes "running" and calculates duration
 * when status becomes "completed" or "error". Returns undefined values until
 * the corresponding transition occurs.
 *
 * Usage:
 * ```tsx
 * const timing = useToolTiming(status);
 * // timing.startedAt - timestamp when tool started running
 * // timing.completedAt - timestamp when tool completed/errored
 * // timing.durationMs - calculated duration in milliseconds
 * ```
 */
export function useToolTiming(status: ToolStatus): ToolTiming {
    const [timing, setTiming] = useState<ToolTiming>({});
    const prevStatusRef = useRef<ToolStatus | null>(null);

    useEffect(() => {
        const prevStatus = prevStatusRef.current;

        // Transition to running: capture start time
        if (status === "running" && prevStatus !== "running") {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing timing state with external status prop
            setTiming({ startedAt: Date.now() });
        }

        // Transition to completed or error: calculate duration
        if (
            (status === "completed" || status === "error") &&
            prevStatus !== "completed" &&
            prevStatus !== "error"
        ) {
            setTiming((prev) => {
                const now = Date.now();
                const durationMs = prev.startedAt ? now - prev.startedAt : undefined;
                return { ...prev, completedAt: now, durationMs };
            });
        }

        prevStatusRef.current = status;
    }, [status]);

    return timing;
}
