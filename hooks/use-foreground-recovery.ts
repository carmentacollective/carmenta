/**
 * Foreground Recovery Hook
 *
 * Recovers from iOS backgrounding by checking server state when app returns to foreground.
 * When a user backgrounds the app mid-stream, iOS kills the connection. This hook:
 * 1. Detects when app returns to foreground (visibility change)
 * 2. Checks if there's an incomplete conversation (last message from user)
 * 3. Polls server to see if background work continued
 * 4. Triggers appropriate recovery (start polling or refresh messages)
 *
 * This solves the "click away and come back" problem for Temporal background jobs.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

import {
    pollBackgroundModeStatus,
    type BackgroundModeStatus,
} from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";

interface UseForegroundRecoveryOptions {
    /** Current connection ID (Sqid string) */
    connectionId: string | null;
    /** Current messages in the conversation */
    messages: UIMessageLike[];
    /** Whether background mode polling is already active */
    isBackgroundMode: boolean;
    /** Whether the AI is currently streaming a response */
    isLoading: boolean;
    /** Start background mode polling */
    startPolling: (connectionId: string) => void;
    /** Called when we discover completed messages from background work */
    onMessagesRecovered: (
        messages: UIMessageLike[],
        title: string | null,
        slug: string
    ) => void;
    /** Called when background work failed while we were away
     * @param partialMessages - Any messages recovered before failure (may be useful for display)
     */
    onBackgroundFailed: (partialMessages: UIMessageLike[] | null) => void;
    /** Called when stream was interrupted and server has no continuation */
    onStreamInterrupted?: () => void;
}

/**
 * Detects if conversation is incomplete (waiting for assistant response).
 * An incomplete conversation has either:
 * 1. Last message from user (before first token)
 * 2. Last message from assistant with empty or incomplete content (mid-stream)
 *
 * Once streaming starts, the last message becomes "assistant", so we check
 * if it has any text content. Empty or very short content suggests interruption.
 */
function isConversationIncomplete(messages: UIMessageLike[]): boolean {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return false;

    // Definitely incomplete if last message is from user
    if (lastMessage.role === "user") return true;

    // If last message is assistant, check if it has meaningful content
    // Empty parts or very short content suggests stream was interrupted
    if (lastMessage.role === "assistant") {
        const textParts = lastMessage.parts.filter((p) => p.type === "text");
        if (textParts.length === 0) return true; // No text yet, definitely incomplete

        const totalTextLength = textParts.reduce((sum, part) => {
            const text = typeof part.text === "string" ? part.text : "";
            return sum + text.length;
        }, 0);

        // Less than 10 characters suggests interrupted stream
        return totalTextLength < 10;
    }

    return false;
}

export function useForegroundRecovery({
    connectionId,
    messages,
    isBackgroundMode,
    isLoading,
    startPolling,
    onMessagesRecovered,
    onBackgroundFailed,
    onStreamInterrupted,
}: UseForegroundRecoveryOptions): void {
    // Track if we've already attempted recovery for this foreground event
    const recoveryAttemptedRef = useRef(false);

    // Store connectionId to detect if it changed during async operations
    const connectionIdRef = useRef(connectionId);

    // Store callbacks and messages in refs to avoid dependency issues
    const messagesRef = useRef(messages);
    const startPollingRef = useRef(startPolling);
    const onMessagesRecoveredRef = useRef(onMessagesRecovered);
    const onBackgroundFailedRef = useRef(onBackgroundFailed);
    const onStreamInterruptedRef = useRef(onStreamInterrupted);

    useEffect(() => {
        connectionIdRef.current = connectionId;
        messagesRef.current = messages;
        startPollingRef.current = startPolling;
        onMessagesRecoveredRef.current = onMessagesRecovered;
        onBackgroundFailedRef.current = onBackgroundFailed;
        onStreamInterruptedRef.current = onStreamInterrupted;
    }, [
        connectionId,
        messages,
        startPolling,
        onMessagesRecovered,
        onBackgroundFailed,
        onStreamInterrupted,
    ]);

    // Handle recovery based on server status - declared before checkAndRecover which uses it
    const handleRecoveryResult = useCallback(
        (connId: string, result: BackgroundModeStatus) => {
            switch (result.status) {
                case "streaming":
                    // Server is still working - start polling to catch completion
                    logger.info(
                        { connectionId: connId },
                        "Server still streaming - starting background polling"
                    );
                    startPollingRef.current(connId);
                    break;

                case "completed":
                    // Server finished while we were away - refresh messages
                    if (result.messages) {
                        logger.info(
                            {
                                connectionId: connId,
                                messageCount: result.messages.length,
                            },
                            "Background work completed - recovering messages"
                        );
                        onMessagesRecoveredRef.current(
                            result.messages,
                            result.title,
                            result.slug
                        );
                    }
                    break;

                case "failed":
                    // Server failed while we were away - pass any partial content for recovery
                    logger.warn(
                        { connectionId: connId, hasPartialMessages: !!result.messages },
                        "Background work failed while app was backgrounded"
                    );
                    onBackgroundFailedRef.current(result.messages);
                    break;

                case "idle":
                    // No work in progress - this is unexpected for incomplete conversation
                    // The stream was interrupted before server could continue in background
                    logger.warn(
                        { connectionId: connId },
                        "Server idle but conversation incomplete - stream was interrupted"
                    );
                    // Notify caller so they can show a retry option
                    onStreamInterruptedRef.current?.();
                    break;
            }
        },
        // Empty deps: only uses refs which are stable across renders
        []
    );

    const checkAndRecover = useCallback(async () => {
        // Skip if no connection
        if (!connectionId) {
            return;
        }

        // Skip if we're already polling or actively streaming
        if (isBackgroundMode || isLoading) {
            logger.debug(
                { connectionId, isBackgroundMode, isLoading },
                "Skipping foreground recovery - already active"
            );
            return;
        }

        // Skip if conversation is complete (last message from assistant)
        if (!isConversationIncomplete(messagesRef.current)) {
            logger.debug(
                { connectionId, lastRole: messagesRef.current.at(-1)?.role },
                "Skipping foreground recovery - conversation complete"
            );
            return;
        }

        logger.info(
            { connectionId },
            "App returned to foreground with incomplete conversation - checking server state"
        );

        try {
            const result = await pollBackgroundModeStatus(connectionId);

            // Check if connectionId changed during async operation
            if (connectionIdRef.current !== connectionId) {
                logger.debug(
                    {
                        polledFor: connectionId,
                        currentConnection: connectionIdRef.current,
                    },
                    "Connection changed during foreground recovery poll - discarding stale result"
                );
                return;
            }

            if (!result) {
                logger.warn(
                    { connectionId },
                    "Failed to poll server state on foreground recovery"
                );
                return;
            }

            handleRecoveryResult(connectionId, result);
        } catch (error) {
            logger.error(
                { error, connectionId },
                "Error during foreground recovery check"
            );
        }
    }, [connectionId, isBackgroundMode, isLoading, handleRecoveryResult]);

    // Listen for visibility changes
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // Prevent duplicate recovery attempts from rapid visibility changes
                if (recoveryAttemptedRef.current) {
                    return;
                }
                recoveryAttemptedRef.current = true;

                // Clear any pending timeout from previous visibility change
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Small delay to let React state settle after tab becomes active
                timeoutId = setTimeout(() => {
                    timeoutId = null;
                    checkAndRecover();
                }, 100);
            } else {
                // Reset flag when going to background so next foreground triggers recovery
                recoveryAttemptedRef.current = false;
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [checkAndRecover]);
}
