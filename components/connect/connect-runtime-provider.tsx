"use client";

import { useMemo, useCallback, useState, createContext, useContext } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AlertCircle, RefreshCw, X } from "lucide-react";

import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";

interface ConnectRuntimeProviderProps {
    children: React.ReactNode;
}

interface ChatErrorContextType {
    error: Error | null;
    clearError: () => void;
}

const ChatErrorContext = createContext<ChatErrorContextType>({
    error: null,
    clearError: () => {},
});

export function useChatError() {
    return useContext(ChatErrorContext);
}

/**
 * Error banner displayed when a runtime error occurs.
 * Provides a way to dismiss the error and retry.
 */
function RuntimeErrorBanner({
    error,
    onDismiss,
    onRetry,
}: {
    error: Error;
    onDismiss: () => void;
    onRetry: () => void;
}) {
    return (
        <div
            className={cn(
                "fixed bottom-24 left-1/2 z-50 -translate-x-1/2",
                "flex max-w-md items-center gap-3 rounded-xl px-4 py-3",
                "bg-red-50/95 shadow-lg backdrop-blur-sm",
                "border border-red-200/50",
                "duration-300 animate-in fade-in slide-in-from-bottom-4"
            )}
            role="alert"
        >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Something went wrong</p>
                <p className="text-xs text-red-600/80">
                    {error.message || "We couldn't complete that request."}
                </p>
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={onRetry}
                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100"
                    aria-label="Retry"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
                <button
                    onClick={onDismiss}
                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
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
 * - Runtime error display with retry capability
 *
 * Uses AssistantChatTransport to automatically forward system messages
 * and frontend tools to the backend.
 */
export function ConnectRuntimeProvider({ children }: ConnectRuntimeProviderProps) {
    const [error, setError] = useState<Error | null>(null);

    // Memoize transport to prevent recreation on every render
    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/connect",
                fetch: fetchWithLogging,
            }),
        []
    );

    const handleError = useCallback((err: Error) => {
        logger.error(
            {
                error: err.message,
                stack: err.stack,
                name: err.name,
            },
            "❌ Chat runtime error"
        );
        setError(err);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const handleRetry = useCallback(() => {
        setError(null);
        // The user can simply resend their message after dismissing
        // Focus the composer input for convenience
        const composer = document.querySelector<HTMLTextAreaElement>(
            '[data-testid="composer-input"], textarea[placeholder]'
        );
        composer?.focus();
    }, []);

    const runtime = useChatRuntime({
        transport,
        onError: handleError,
    });

    const errorContextValue = useMemo(
        () => ({ error, clearError }),
        [error, clearError]
    );

    return (
        <ChatErrorContext.Provider value={errorContextValue}>
            <AssistantRuntimeProvider runtime={runtime}>
                {children}
                {error && (
                    <RuntimeErrorBanner
                        error={error}
                        onDismiss={clearError}
                        onRetry={handleRetry}
                    />
                )}
            </AssistantRuntimeProvider>
        </ChatErrorContext.Provider>
    );
}
