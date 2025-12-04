"use client";

import { useMemo, useCallback, useState, createContext, useContext } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AlertCircle, RefreshCw, X } from "lucide-react";

import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import {
    ConciergeProvider,
    useConcierge,
    parseConciergeHeaders,
} from "@/lib/concierge/context";
import type { ModelOverrides } from "./model-selector/types";

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
 * Context for model overrides - allows Composer to pass overrides to fetch wrapper.
 */
interface ModelOverridesContextType {
    overrides: ModelOverrides;
    setOverrides: (overrides: ModelOverrides) => void;
}

const ModelOverridesContext = createContext<ModelOverridesContextType | null>(null);

export function useModelOverrides() {
    const context = useContext(ModelOverridesContext);
    if (!context) {
        throw new Error("useModelOverrides must be used within ConnectRuntimeProvider");
    }
    return context;
}

/**
 * Parses an error message that might be raw JSON and extracts the user-friendly message.
 * The API returns JSON like {"error": "friendly message", "errorType": "Error"}
 * but the AI SDK may pass this as the raw error message.
 */
function parseErrorMessage(message: string | undefined): string {
    if (!message) return "We couldn't complete that request.";

    // Check if it looks like JSON
    const trimmed = message.trim();
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            // If it has an 'error' field, use that (our API format)
            if (typeof parsed.error === "string") {
                return parsed.error;
            }
        } catch {
            // Not valid JSON, return as-is
        }
    }

    return message;
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
    // Parse the error message in case it's raw JSON from the API
    const displayMessage = parseErrorMessage(error.message);

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
                <p className="text-xs text-red-600/80">{displayMessage}</p>
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
 * Default overrides - all null means "let Carmenta choose".
 */
const DEFAULT_OVERRIDES: ModelOverrides = {
    modelId: null,
    temperature: null,
    reasoning: null,
};

/**
 * Inner provider that has access to concierge context and error handling.
 */
function ConnectRuntimeProviderInner({ children }: ConnectRuntimeProviderProps) {
    const { setConcierge } = useConcierge();
    const [error, setError] = useState<Error | null>(null);
    const [overrides, setOverrides] = useState<ModelOverrides>(DEFAULT_OVERRIDES);

    /**
     * Custom fetch wrapper that captures concierge headers, injects overrides, and logs errors.
     * Note: We include `overrides` in deps so the callback updates when overrides change.
     */
    const fetchWithConcierge = useCallback(
        async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === "string" ? input : input.toString();
            const method = init?.method || "GET";

            logger.debug({ url, method }, "API request starting");

            // Clear stale concierge data when new request starts
            // This prevents showing previous message's model selection during loading
            setConcierge(null);

            // Inject model overrides into POST request body
            let modifiedInit = init;
            if (method === "POST" && init?.body) {
                try {
                    const body = JSON.parse(init.body as string);

                    // Only add overrides that are non-null
                    if (overrides.modelId) {
                        body.modelOverride = overrides.modelId;
                    }
                    if (overrides.temperature !== null) {
                        body.temperatureOverride = overrides.temperature;
                    }
                    if (overrides.reasoning) {
                        body.reasoningOverride = overrides.reasoning;
                    }

                    modifiedInit = {
                        ...init,
                        body: JSON.stringify(body),
                    };

                    logger.debug(
                        {
                            modelOverride: overrides.modelId,
                            temperatureOverride: overrides.temperature,
                            reasoningOverride: overrides.reasoning,
                        },
                        "Applied model overrides to request"
                    );
                } catch {
                    // If body parsing fails, proceed without modification
                    logger.warn(
                        {},
                        "Failed to parse request body for override injection"
                    );
                }
            }

            try {
                const response = await fetch(input, modifiedInit);

                if (!response.ok) {
                    // Try to get error details from response body
                    let errorDetails: unknown = null;
                    try {
                        errorDetails = await response.clone().json();
                    } catch {
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
                        "API request failed"
                    );

                    // Clear concierge on error
                    setConcierge(null);
                } else {
                    logger.debug(
                        { url, method, status: response.status },
                        "API request successful"
                    );

                    // Parse and set concierge data from headers
                    const conciergeData = parseConciergeHeaders(response);
                    if (conciergeData) {
                        logger.debug(
                            {
                                modelId: conciergeData.modelId,
                                temperature: conciergeData.temperature,
                            },
                            "Concierge data received"
                        );
                        setConcierge(conciergeData);
                    }
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
                    "API request threw exception"
                );
                setConcierge(null);
                throw error;
            }
        },
        [setConcierge, overrides]
    );

    // Memoize transport to prevent recreation on every render
    const transport = useMemo(
        () =>
            new AssistantChatTransport({
                api: "/api/connection",
                fetch: fetchWithConcierge,
            }),
        [fetchWithConcierge]
    );

    const handleError = useCallback((err: Error) => {
        logger.error(
            {
                error: err.message,
                stack: err.stack,
                name: err.name,
            },
            "Chat runtime error"
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

    const overridesContextValue = useMemo(
        () => ({ overrides, setOverrides }),
        [overrides]
    );

    return (
        <ModelOverridesContext.Provider value={overridesContextValue}>
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
        </ModelOverridesContext.Provider>
    );
}

/**
 * Provides the assistant-ui runtime configured for our /api/connection endpoint.
 *
 * This wraps the app with:
 * - ConciergeProvider for concierge data
 * - AssistantRuntimeProvider for message state, tool UI, and streaming
 * - Runtime error display with retry capability
 *
 * Captures concierge headers from responses and makes them available
 * to child components via useConcierge().
 */
export function ConnectRuntimeProvider({ children }: ConnectRuntimeProviderProps) {
    return (
        <ConciergeProvider>
            <ConnectRuntimeProviderInner>{children}</ConnectRuntimeProviderInner>
        </ConciergeProvider>
    );
}
