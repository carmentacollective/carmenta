"use client";

import { useMemo, useCallback } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

import { logger } from "@/lib/client-logger";

interface ConnectRuntimeProviderProps {
    children: React.ReactNode;
}

/**
 * Custom fetch wrapper with detailed error logging.
 */
async function fetchWithLogging(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method || "GET";

    logger.debug({ url, method }, "🌐 API request starting");

    try {
        const response = await fetch(input, init);

        if (!response.ok) {
            // Try to get error details from response body
            let errorDetails: unknown = null;
            try {
                errorDetails = await response.clone().json();
            } catch {
                // Response wasn't JSON
                try {
                    errorDetails = await response.clone().text();
                } catch {
                    errorDetails = "Could not read response body";
                }
            }

            logger.error(
                {
                    url,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    errorDetails,
                },
                "❌ API request failed"
            );
        } else {
            logger.debug(
                { url, method, status: response.status },
                "✅ API request successful"
            );
        }

        return response;
    } catch (error) {
        logger.error(
            {
                url,
                method,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            },
            "❌ API request threw exception"
        );
        throw error;
    }
}

/**
 * Provides the assistant-ui runtime configured for our /api/connect endpoint.
 *
 * This wraps the app with AssistantRuntimeProvider which enables:
 * - Message state management
 * - Tool UI rendering
 * - Streaming response handling
 *
 * Uses AssistantChatTransport to automatically forward system messages
 * and frontend tools to the backend.
 */
export function ConnectRuntimeProvider({ children }: ConnectRuntimeProviderProps) {
    // Memoize transport to prevent recreation on every render
    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/connect",
                fetch: fetchWithLogging,
            }),
        []
    );

    const runtime = useChatRuntime({
        transport,
        onError: useCallback((error: Error) => {
            logger.error(
                {
                    error: error.message,
                    stack: error.stack,
                    name: error.name,
                },
                "❌ Chat runtime error"
            );
        }, []),
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
