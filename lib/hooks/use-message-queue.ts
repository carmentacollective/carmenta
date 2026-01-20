/**
 * Message Queue Hook
 *
 * Manages a queue of messages that users can send while AI is streaming.
 * Instead of blocking input during generation, users can queue up their thoughts.
 *
 * Features:
 * - Queue messages while AI is responding
 * - Per-connection queue isolation
 * - Persist queue to localStorage (survives refresh)
 * - Max queue size to prevent runaway queuing
 * - Auto-process queue when streaming completes
 *
 * @see knowledge/components/message-flow.md
 */

"use client";

import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/client-logger";

const QUEUE_KEY_PREFIX = "carmenta:queue:";
const NEW_CONNECTION_KEY = "new";
const MAX_QUEUE_SIZE = 5;
const DEBOUNCE_MS = 300;

export interface QueuedMessage {
    id: string;
    content: string;
    files?: Array<{ url: string; mediaType: string; name: string }>;
    timestamp: Date;
    /** Error message if send failed - allows UI to show retry option */
    error?: string;
}

export interface UseMessageQueueOptions {
    /** Connection ID to scope the queue to */
    connectionId: string | null;
    /** Whether AI is currently streaming */
    isStreaming: boolean;
    /** Function to send a message */
    sendMessage: (message: {
        role: "user";
        content: string;
        files?: Array<{ url: string; mediaType: string; name: string }>;
    }) => Promise<void>;
    /** Callback when queue processing starts */
    onProcessingStart?: () => void;
    /** Callback when queue processing ends */
    onProcessingEnd?: () => void;
    /** Callback to track sent message for stop-restore behavior */
    onMessageSent?: (message: {
        content: string;
        files?: Array<{ url: string; mediaType: string; name: string }>;
    }) => void;
}

export interface UseMessageQueueReturn {
    /** Current queue of messages */
    queue: QueuedMessage[];
    /** Add a message to the queue */
    enqueue: (
        content: string,
        files?: Array<{ url: string; mediaType: string; name: string }>
    ) => void;
    /** Remove a message from the queue */
    remove: (id: string) => void;
    /** Edit a queued message */
    edit: (id: string, content: string) => void;
    /** Retry a failed message (clears error and re-processes) */
    retry: (id: string) => void;
    /** Clear the entire queue */
    clear: () => void;
    /** Whether queue is at max capacity */
    isFull: boolean;
    /** Whether queue is currently being processed */
    isProcessing: boolean;
    /** Index of message currently being processed (for UI display) */
    processingIndex: number | undefined;
    /** Process the queue immediately (called after streaming ends) */
    processQueue: () => Promise<void>;
}

function getQueueKey(connectionId: string): string {
    return `${QUEUE_KEY_PREFIX}${connectionId}`;
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Load queue from localStorage
 */
function loadQueue(key: string): QueuedMessage[] {
    if (typeof window === "undefined") return [];

    try {
        const storageKey = getQueueKey(key);
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Rehydrate Date objects
            return parsed.map((msg: QueuedMessage) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
            }));
        }
    } catch (error) {
        logger.warn({ error, key }, "Failed to load message queue from localStorage");
        Sentry.captureException(error, {
            tags: { hook: "useMessageQueue", action: "loadQueue" },
            level: "warning",
        });
    }
    return [];
}

/**
 * Save queue to localStorage
 */
function saveQueue(key: string, queue: QueuedMessage[]): void {
    if (typeof window === "undefined") return;

    try {
        const storageKey = getQueueKey(key);
        if (queue.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(queue));
        } else {
            localStorage.removeItem(storageKey);
        }
    } catch (error) {
        logger.warn({ error, key }, "Failed to save message queue to localStorage");
        Sentry.captureException(error, {
            tags: { hook: "useMessageQueue", action: "saveQueue" },
            level: "warning",
        });
    }
}

export function useMessageQueue({
    connectionId,
    isStreaming,
    sendMessage,
    onProcessingStart,
    onProcessingEnd,
    onMessageSent,
}: UseMessageQueueOptions): UseMessageQueueReturn {
    const effectiveKey = connectionId ?? NEW_CONNECTION_KEY;

    // Initialize queue from localStorage
    const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueue(effectiveKey));
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingIndex, setProcessingIndex] = useState<number | undefined>(
        undefined
    );

    // Track previous streaming state to detect transitions
    const wasStreamingRef = useRef(isStreaming);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Track which connection we've loaded for (to prevent double-load)
    const loadedConnectionRef = useRef<string | null>(null);

    // Reload queue when connection changes (sync with localStorage)
    useEffect(() => {
        let cancelled = false;

        // Skip if we've already loaded for this connection
        if (loadedConnectionRef.current === effectiveKey) return;

        const loaded = loadQueue(effectiveKey);

        // Use Promise.resolve().then() to avoid "setState in effect" lint error
        Promise.resolve().then(() => {
            if (!cancelled) {
                setQueue(loaded);
            }
        });

        // Mark this connection as loaded
        loadedConnectionRef.current = effectiveKey;

        return () => {
            cancelled = true;
        };
    }, [effectiveKey]);

    // Track previous key to detect connection switches
    const prevKeyForSaveRef = useRef(effectiveKey);

    // Debounced save to localStorage
    useEffect(() => {
        // If connection changed, flush pending save for old connection before switching
        if (prevKeyForSaveRef.current !== effectiveKey && debounceRef.current) {
            clearTimeout(debounceRef.current);
            // Flush the pending save immediately for the old connection
            // Note: This uses the closure's queue which is correct - it's the queue
            // state from when the effect was scheduled, before the connection changed
            const oldKey = prevKeyForSaveRef.current;
            saveQueue(oldKey, queue);
            debounceRef.current = null;
        }
        prevKeyForSaveRef.current = effectiveKey;

        // Clear any existing timer and schedule new save
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            saveQueue(effectiveKey, queue);
        }, DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [effectiveKey, queue]);

    // Add message to queue - uses functional update to avoid race conditions
    const enqueue = useCallback(
        (
            content: string,
            files?: Array<{ url: string; mediaType: string; name: string }>
        ) => {
            setQueue((prev) => {
                if (prev.length >= MAX_QUEUE_SIZE) {
                    logger.warn({}, "Message queue is full, cannot add more messages");
                    return prev;
                }

                const message: QueuedMessage = {
                    id: generateId(),
                    content,
                    files,
                    timestamp: new Date(),
                };

                logger.info(
                    { queueLength: prev.length + 1, connectionId: effectiveKey },
                    "Message queued"
                );
                return [...prev, message];
            });
        },
        [effectiveKey]
    );

    // Remove message from queue
    const remove = useCallback((id: string) => {
        setQueue((prev) => prev.filter((msg) => msg.id !== id));
    }, []);

    // Edit a queued message
    const edit = useCallback((id: string, content: string) => {
        setQueue((prev) =>
            prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
        );
    }, []);

    // Retry a failed message - clears error and moves to front for immediate processing
    const retry = useCallback((id: string) => {
        setQueue((prev) => {
            const index = prev.findIndex((msg) => msg.id === id);
            if (index === -1) return prev;

            // Clear error and move to front
            const message = { ...prev[index], error: undefined };
            const rest = prev.filter((msg) => msg.id !== id);
            return [message, ...rest];
        });
    }, []);

    // Clear entire queue
    const clear = useCallback(() => {
        setQueue([]);
        try {
            const storageKey = getQueueKey(effectiveKey);
            localStorage.removeItem(storageKey);
        } catch (error) {
            logger.warn(
                { error, key: effectiveKey },
                "Failed to clear message queue from localStorage"
            );
            Sentry.captureException(error, {
                tags: { hook: "useMessageQueue", action: "clearQueue" },
                level: "warning",
            });
        }
    }, [effectiveKey]);

    // Process queue - send next message, then re-trigger via effect if more remain
    // Avoids stale closure bug by processing one message per call
    const processQueue = useCallback(async () => {
        if (queue.length === 0 || isProcessing) return;

        // Find first message without error (skip failed messages until user retries)
        const messageIndex = queue.findIndex((msg) => !msg.error);
        if (messageIndex === -1) return; // All messages have errors

        setIsProcessing(true);
        setProcessingIndex(messageIndex); // Track which index is processing
        onProcessingStart?.();

        const message = queue[messageIndex];
        logger.info(
            { queueLength: queue.length, messageId: message.id },
            "Processing queued message"
        );

        try {
            await sendMessage({
                role: "user",
                content: message.content,
                files: message.files,
            });
            // Track sent message for stop-restore behavior
            onMessageSent?.({ content: message.content, files: message.files });
            // Remove successfully sent message
            setQueue((prev) => prev.filter((msg) => msg.id !== message.id));
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Failed to send message";
            logger.error(
                { error, messageId: message.id },
                "Failed to send queued message"
            );
            // Mark message with error so user can see it failed and retry
            setQueue((prev) =>
                prev.map((msg) =>
                    msg.id === message.id ? { ...msg, error: errorMessage } : msg
                )
            );
        }

        setIsProcessing(false);
        setProcessingIndex(undefined); // Clear processing index when done
        onProcessingEnd?.();
        // Effect below will re-trigger if more messages remain
    }, [
        queue,
        isProcessing,
        sendMessage,
        onProcessingStart,
        onProcessingEnd,
        onMessageSent,
    ]);

    // Auto-process queue when streaming ends or when previous message completes
    useEffect(() => {
        const wasStreaming = wasStreamingRef.current;
        wasStreamingRef.current = isStreaming;

        // Don't process while streaming or already processing
        if (isStreaming || isProcessing) return;

        // Streaming just ended and we have queued messages
        if (wasStreaming && !isStreaming && queue.length > 0) {
            // Small delay to let UI settle after streaming ends
            const timer = setTimeout(() => {
                processQueue();
            }, 100);
            return () => clearTimeout(timer);
        }

        // Continue processing remaining messages (triggered when previous completes)
        if (!wasStreaming && queue.length > 0) {
            // Short delay between messages for visual feedback
            const timer = setTimeout(() => {
                processQueue();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isStreaming, queue.length, isProcessing, processQueue]);

    return {
        queue,
        enqueue,
        remove,
        edit,
        retry,
        clear,
        isFull: queue.length >= MAX_QUEUE_SIZE,
        isProcessing,
        processingIndex,
        processQueue,
    };
}
