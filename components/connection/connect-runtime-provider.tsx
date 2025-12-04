"use client";

import {
    useMemo,
    useCallback,
    useState,
    useEffect,
    useRef,
    createContext,
    useContext,
} from "react";
import {
    AssistantRuntimeProvider,
    ExportedMessageRepository,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AlertCircle, RefreshCw, X } from "lucide-react";

import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import {
    ConciergeProvider,
    useConcierge,
    parseConciergeHeaders,
} from "@/lib/concierge/context";
import { useConnection } from "./connection-context";
import type { ModelOverrides } from "./model-selector/types";
import type { UIMessageLike } from "@/lib/db/message-mapping";

/**
 * Convert UIMessageLike (our DB format) to ThreadMessageLike (assistant-ui format)
 * Main difference: UIMessageLike uses "parts", ThreadMessageLike uses "content"
 *
 * ThreadMessageLike content supports: text, reasoning, tool-call, file, source, image, data
 * Our UIMessageLike parts use: text, reasoning, tool-*, data-*, file, step-start
 */
type ThreadMessageContent =
    | { type: "text"; text: string }
    | { type: "reasoning"; text: string }
    | {
          type: "tool-call";
          toolCallId: string;
          toolName: string;
          args?: Record<string, unknown>;
          result?: unknown;
      };

function toThreadMessageLike(msg: UIMessageLike): {
    id: string;
    role: "user" | "assistant" | "system";
    content: ThreadMessageContent[];
    createdAt?: Date;
} {
    // Map our parts to assistant-ui content format
    const content: ThreadMessageContent[] = [];

    for (const part of msg.parts) {
        // Text parts
        if (part.type === "text") {
            content.push({ type: "text", text: part.text as string });
            continue;
        }

        // Reasoning parts
        if (part.type === "reasoning") {
            content.push({ type: "reasoning", text: part.text as string });
            continue;
        }

        // Tool parts: "tool-getWeather" → type: "tool-call"
        if (part.type.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "");
            content.push({
                type: "tool-call",
                toolCallId: (part.toolCallId as string) ?? "",
                toolName,
                args: part.input as Record<string, unknown>,
                result: part.output,
            });
            continue;
        }

        // Data parts and step-start - convert to text representation for now
        // (assistant-ui data parts have different structure)
        if (part.type.startsWith("data-") || part.type === "step-start") {
            // Skip these as they're UI-only parts
            continue;
        }

        // Fallback: unknown parts become text placeholders
        content.push({ type: "text", text: `[${part.type}]` });
    }

    // Ensure we have at least one content item
    if (content.length === 0) {
        content.push({ type: "text", text: "" });
    }

    return {
        id: msg.id,
        role: msg.role,
        content,
        createdAt: msg.createdAt,
    };
}

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
    const { activeConnectionId, initialMessages } = useConnection();
    const [error, setError] = useState<Error | null>(null);
    const [overrides, setOverrides] = useState<ModelOverrides>(DEFAULT_OVERRIDES);
    // Track last imported state to handle late-arriving messages
    const lastImportedRef = useRef<{
        connectionId: string | null;
        messageCount: number;
    }>({ connectionId: null, messageCount: 0 });

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

            // Inject connectionId and model overrides into POST request body
            let modifiedInit = init;
            if (method === "POST" && init?.body) {
                try {
                    const body = JSON.parse(init.body as string);

                    // Include connectionId for message persistence
                    if (activeConnectionId) {
                        body.connectionId = activeConnectionId;
                    }

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
                            connectionId: activeConnectionId,
                            modelOverride: overrides.modelId,
                            temperatureOverride: overrides.temperature,
                            reasoningOverride: overrides.reasoning,
                        },
                        "Applied connectionId and model overrides to request"
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
        [setConcierge, overrides, activeConnectionId]
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

    /**
     * Initialize thread with messages when connection changes.
     * This ensures existing messages are displayed when navigating to a connection.
     *
     * We track both connectionId and messageCount to handle:
     * 1. Connection changes (clear and reload)
     * 2. Late-arriving messages (messages that load after the connection ID is set)
     */
    useEffect(() => {
        if (!activeConnectionId) return;

        const currentMessageCount = initialMessages?.length ?? 0;
        const lastImported = lastImportedRef.current;

        // Skip if we've already imported these exact messages for this connection
        const isSameConnection = lastImported.connectionId === activeConnectionId;
        const isSameMessageCount = lastImported.messageCount === currentMessageCount;
        if (isSameConnection && isSameMessageCount) return;

        // Update tracking ref
        lastImportedRef.current = {
            connectionId: activeConnectionId,
            messageCount: currentMessageCount,
        };

        try {
            if (initialMessages && initialMessages.length > 0) {
                logger.debug(
                    {
                        connectionId: activeConnectionId,
                        messageCount: initialMessages.length,
                    },
                    "Initializing thread with existing messages"
                );

                // Convert UIMessageLike to ThreadMessageLike format for assistant-ui
                const threadMessages = initialMessages.map(toThreadMessageLike);
                // fromArray creates parent-child relationships based on message order
                // Type assertion needed because our JSON types are looser than assistant-ui expects

                const repository = ExportedMessageRepository.fromArray(
                    threadMessages as any
                );
                runtime.thread.import(repository);
            } else {
                // New/empty connection - clear any existing messages
                logger.debug(
                    { connectionId: activeConnectionId },
                    "New connection - clearing thread"
                );
                runtime.thread.import(ExportedMessageRepository.fromArray([]));
            }
        } catch (err) {
            logger.error(
                { error: err, connectionId: activeConnectionId },
                "Failed to import messages into thread"
            );
        }
    }, [activeConnectionId, initialMessages, runtime]);

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
