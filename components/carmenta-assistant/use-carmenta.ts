"use client";

/**
 * useCarmenta Hook
 *
 * Unified state management for Carmenta DCOS interactions.
 * Wraps useChat with DCOS-specific configuration.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/client-logger";

interface UseCarmentaOptions {
    /** Page context for DCOS routing */
    pageContext?: string;
    /** Called after agent makes changes */
    onChangesComplete?: () => void;
}

interface UseCarmentaReturn {
    /** Current messages in the conversation */
    messages: ReturnType<typeof useChat>["messages"];
    /** Current input value */
    input: string;
    /** Update input value */
    setInput: (value: string) => void;
    /** Send the current input as a message */
    sendMessage: () => Promise<void>;
    /** Stop the current streaming response */
    stop: () => void;
    /** Whether Carmenta is currently streaming */
    isLoading: boolean;
    /** Chat status */
    status: ReturnType<typeof useChat>["status"];
    /** Clear the conversation */
    clear: () => void;
    /** Error from API call, if any */
    error: Error | null;
    /** Clear the current error */
    clearError: () => void;
}

/**
 * Hook for managing Carmenta DCOS state
 *
 * Uses DCOS endpoint for intelligent orchestration.
 * Triggers onChangesComplete after successful tool-using responses.
 */
export function useCarmenta(options: UseCarmentaOptions = {}): UseCarmentaReturn {
    const { pageContext, onChangesComplete } = options;
    const [input, setInput] = useState("");
    const [error, setError] = useState<Error | null>(null);
    const onChangesCompleteRef = useRef(onChangesComplete);

    // Keep ref updated
    useEffect(() => {
        onChangesCompleteRef.current = onChangesComplete;
    }, [onChangesComplete]);

    // Generate stable chat ID for this session
    const chatId = useMemo(() => generateId(), []);

    // Create transport for DCOS endpoint
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/dcos",
                prepareSendMessagesRequest(request) {
                    return {
                        body: {
                            id: request.id,
                            messages: request.messages,
                            pageContext,
                            channel: "web",
                        },
                    };
                },
            }),
        [pageContext]
    );

    // Chat state connected to DCOS endpoint
    const {
        messages,
        sendMessage: sendChatMessage,
        status,
        setMessages,
        stop,
    } = useChat({
        id: chatId,
        transport,
        onFinish: ({ message, finishReason }) => {
            // Clear any previous error on successful response
            setError(null);

            // Check if the response included tool calls (agent made changes)
            // In AI SDK 5, tool parts have typed names like 'tool-librarian', 'tool-mcpConfig'
            const hasToolCalls = message.parts?.some(
                (part: { type?: string }) =>
                    typeof part === "object" &&
                    "type" in part &&
                    typeof part.type === "string" &&
                    part.type.startsWith("tool-")
            );

            logger.debug(
                {
                    hasToolCalls,
                    partTypes:
                        message.parts?.map((p: { type?: string }) => p.type) ?? [],
                    finishReason,
                    pageContext,
                },
                "Carmenta onFinish"
            );

            // Trigger page refresh if agent made changes
            // Also trigger if finishReason is 'tool-calls' (agent used tools even if not in final message)
            if (
                (hasToolCalls || finishReason === "tool-calls") &&
                onChangesCompleteRef.current
            ) {
                // Small delay to let any DB writes complete
                setTimeout(() => {
                    logger.info(
                        { pageContext },
                        "Triggering page refresh after agent changes"
                    );
                    onChangesCompleteRef.current?.();
                }, 100);
            }
        },
        onError: (err) => {
            logger.error({ error: err, pageContext }, "Carmenta API request failed");
            Sentry.captureException(err, {
                tags: { component: "carmenta", action: "chat" },
                extra: { pageContext },
            });
            setError(err);
        },
    });

    const isLoading = status === "streaming" || status === "submitted";

    // Send the current input
    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const message = input.trim();
        setInput("");

        await sendChatMessage({
            role: "user",
            parts: [{ type: "text", text: message }],
        });
    }, [input, isLoading, sendChatMessage]);

    // Clear conversation
    const clear = useCallback(() => {
        setMessages([]);
        setInput("");
        setError(null);
    }, [setMessages]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        messages,
        input,
        setInput,
        sendMessage,
        stop,
        isLoading,
        status,
        clear,
        error,
        clearError,
    };
}
