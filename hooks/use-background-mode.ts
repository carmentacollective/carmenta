/**
 * Background Mode Polling Hook
 *
 * Polls for background task completion when the server triggers background mode.
 * When work completes, updates the messages in the UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { pollBackgroundModeStatus } from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";

const POLL_INTERVAL_MS = 3000;
const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes

interface UseBackgroundModeOptions {
    /** Called when background work completes with the updated messages */
    onComplete: (messages: UIMessageLike[], title: string | null, slug: string) => void;
    /** Called when background work fails */
    onFailed: () => void;
}

interface UseBackgroundModeResult {
    /** Whether currently in background mode */
    isBackgroundMode: boolean;
    /** When background mode started (for elapsed time display) */
    startTime: number | null;
    /** Start polling for a connection */
    startPolling: (connectionId: string) => void;
    /** Stop polling */
    stopPolling: () => void;
}

export function useBackgroundMode({
    onComplete,
    onFailed,
}: UseBackgroundModeOptions): UseBackgroundModeResult {
    const [isBackgroundMode, setIsBackgroundMode] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Use refs for values needed in poll callback to avoid recreating callback
    const connectionIdRef = useRef<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const failureCountRef = useRef(0);
    // Keep ref in sync with state for use in poll callback (refs for internal use, state for render)
    const startTimeRef = useRef<number | null>(null);

    // Store callbacks in refs to avoid dependency issues
    const onCompleteRef = useRef(onComplete);
    const onFailedRef = useRef(onFailed);
    useEffect(() => {
        onCompleteRef.current = onComplete;
        onFailedRef.current = onFailed;
    }, [onComplete, onFailed]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        connectionIdRef.current = null;
        failureCountRef.current = 0;
        startTimeRef.current = null;
        setStartTime(null);
        setIsBackgroundMode(false);
    }, []);

    // Stable poll function that reads from refs
    const poll = useCallback(async () => {
        const connId = connectionIdRef.current;
        if (!connId) return;

        // Check if polling has exceeded max duration
        if (
            startTimeRef.current &&
            Date.now() - startTimeRef.current > MAX_POLL_DURATION_MS
        ) {
            logger.warn(
                { connectionId: connId },
                "Polling exceeded max duration - stopping"
            );
            stopPolling();
            onFailedRef.current();
            return;
        }

        try {
            const result = await pollBackgroundModeStatus(connId);

            // Verify connection hasn't changed during async call (race condition protection)
            if (connectionIdRef.current !== connId) {
                logger.info(
                    {
                        oldConnectionId: connId,
                        newConnectionId: connectionIdRef.current,
                    },
                    "Connection changed during poll - discarding result"
                );
                return;
            }

            if (!result) {
                // Increment failure counter - stop after too many consecutive failures
                failureCountRef.current++;
                logger.error(
                    { connectionId: connId, failureCount: failureCountRef.current },
                    "Failed to poll background status"
                );

                if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
                    logger.warn(
                        { connectionId: connId },
                        "Too many consecutive failures - stopping polling"
                    );
                    stopPolling();
                    onFailedRef.current();
                }
                return;
            }

            // Reset failure counter on successful poll
            failureCountRef.current = 0;

            if (result.status === "completed" && result.messages) {
                logger.info(
                    { connectionId: connId, messageCount: result.messages.length },
                    "Background work completed"
                );
                stopPolling();
                onCompleteRef.current(result.messages, result.title, result.slug);
            } else if (result.status === "failed") {
                logger.warn({ connectionId: connId }, "Background work failed");
                stopPolling();
                onFailedRef.current();
            } else if (result.status === "idle") {
                // Idle means work hasn't started yet - treat as failure
                logger.warn({ connectionId: connId }, "Background work never started");
                stopPolling();
                onFailedRef.current();
            }
            // If still streaming, continue polling
        } catch (error) {
            failureCountRef.current++;
            logger.error(
                { error, connectionId: connId, failureCount: failureCountRef.current },
                "Error polling background status"
            );

            if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
                stopPolling();
                onFailedRef.current();
            }
        }
    }, [stopPolling]); // Only depends on stopPolling which is stable

    const startPolling = useCallback(
        (connId: string) => {
            // Stop any existing polling
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            logger.info({ connectionId: connId }, "Starting background mode polling");

            // Set connection ID synchronously via ref
            connectionIdRef.current = connId;
            failureCountRef.current = 0;
            const now = Date.now();
            startTimeRef.current = now;
            setStartTime(now);
            setIsBackgroundMode(true);

            // Start polling immediately
            poll();

            // Then poll at interval
            intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
        },
        [poll]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        isBackgroundMode,
        startTime,
        startPolling,
        stopPolling,
    };
}
