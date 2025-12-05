"use client";

/**
 * Connect Runtime Provider
 *
 * Provides chat functionality via Vercel AI SDK 5.0's useChat hook.
 * This is the core state management for the chat interface.
 *
 * Pattern based on Vercel's ai-chatbot reference implementation:
 * - Uses useChat with UIMessage type (parts-based messages)
 * - Uses DefaultChatTransport for custom fetch logic
 * - Exposes sendMessage, status, and messages to children
 */

import {
    useMemo,
    useCallback,
    useState,
    useEffect,
    createContext,
    useContext,
    useRef,
    type ReactNode,
} from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
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
 * Convert our DB UIMessageLike format to AI SDK UIMessage format
 */
function toAIMessage(msg: UIMessageLike): UIMessage {
    return {
        id: msg.id,
        role: msg.role,
        parts: msg.parts.map((part) => {
            if (part.type === "text") {
                return { type: "text" as const, text: String(part.text || "") };
            }
            if (part.type === "reasoning") {
                return {
                    type: "reasoning" as const,
                    text: String(part.text || ""),
                    // providerMetadata is optional - omit if not present
                };
            }
            // Default to text for any unknown types
            return { type: "text" as const, text: String(part.text || "") };
        }),
    };
}

/**
 * Chat context type - provides chat state and actions to children
 */
interface ChatContextType {
    /** Messages in the chat */
    messages: UIMessage[];
    /** Send a message - wraps sendMessage with our format */
    append: (message: { role: "user"; content: string }) => Promise<void>;
    /** Whether the AI is currently generating */
    isLoading: boolean;
    /** Stop the current generation */
    stop: () => void;
    /** Regenerate the last response */
    reload: () => void;
    /** Error from the last request */
    error: Error | null;
    /** Clear error */
    clearError: () => void;
    /** Current input value (managed locally) */
    input: string;
    /** Set input value */
    setInput: (input: string) => void;
    /** Handle input change */
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    /** Handle form submission */
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChatContext must be used within ConnectRuntimeProvider");
    }
    return context;
}

/**
 * Chat error context - for components that only need error state
 */
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
 * Parses an error message and extracts a user-friendly message.
 * Handles JSON error responses, HTML error pages, and plain text.
 */
function parseErrorMessage(message: string | undefined): string {
    if (!message) return "We couldn't complete that request.";

    const trimmed = message.trim();

    // Handle JSON error responses
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed.error === "string") {
                return parsed.error;
            }
        } catch {
            // Not valid JSON
        }
    }

    // Handle HTML error pages (like 404s) - extract just the status code if present
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
        // Try to extract status code from Next.js error page
        const statusMatch = trimmed.match(/<h1[^>]*>(\d{3})<\/h1>/);
        if (statusMatch) {
            const status = statusMatch[1];
            if (status === "404") return "The requested endpoint was not found.";
            if (status === "500") return "The server encountered an error.";
            return `Server returned status ${status}.`;
        }
        return "The server returned an unexpected response.";
    }

    // If the message is very long (likely a stack trace or HTML), truncate it
    if (trimmed.length > 200) {
        return "An unexpected error occurred.";
    }

    return message;
}

/**
 * Error banner displayed when a runtime error occurs.
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

interface ConnectRuntimeProviderProps {
    children: ReactNode;
}

/**
 * Custom fetch wrapper that injects connectionId, model overrides,
 * and extracts concierge headers from responses.
 */
function createFetchWrapper(
    setConcierge: (data: ReturnType<typeof parseConciergeHeaders>) => void,
    overridesRef: React.MutableRefObject<ModelOverrides>,
    connectionIdRef: React.MutableRefObject<string | null>,
    addNewConnection: (connection: {
        id: string;
        slug: string;
        title: string | null;
        modelId: string | null;
    }) => void
) {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";

        logger.debug({ url, method }, "API request starting");

        // Clear stale concierge data
        setConcierge(null);

        // Inject connectionId and model overrides into POST body
        let modifiedInit = init;
        if (method === "POST" && init?.body) {
            try {
                const body = JSON.parse(init.body as string);

                if (connectionIdRef.current) {
                    body.connectionId = connectionIdRef.current;
                }

                if (overridesRef.current.modelId) {
                    body.modelOverride = overridesRef.current.modelId;
                }
                if (overridesRef.current.temperature !== null) {
                    body.temperatureOverride = overridesRef.current.temperature;
                }
                if (overridesRef.current.reasoning) {
                    body.reasoningOverride = overridesRef.current.reasoning;
                }

                modifiedInit = {
                    ...init,
                    body: JSON.stringify(body),
                };

                logger.debug(
                    {
                        connectionId: connectionIdRef.current,
                        modelOverride: overridesRef.current.modelId,
                    },
                    "Applied connectionId and model overrides"
                );
            } catch {
                logger.warn({}, "Failed to parse request body for override injection");
            }
        }

        try {
            const response = await fetch(input, modifiedInit);

            if (!response.ok) {
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
                    { url, method, status: response.status, errorDetails },
                    "API request failed"
                );
                setConcierge(null);
            } else {
                logger.debug(
                    { url, method, status: response.status },
                    "API request successful"
                );

                // Parse concierge headers
                const conciergeData = parseConciergeHeaders(response);
                if (conciergeData) {
                    logger.debug(
                        { modelId: conciergeData.modelId },
                        "Concierge data received"
                    );
                    setConcierge(conciergeData);
                }

                // Handle new connection creation
                const isNewConnection = response.headers.get("X-Connection-Is-New");
                const connectionSlug = response.headers.get("X-Connection-Slug");
                const connectionId = response.headers.get("X-Connection-Id");
                const connectionTitle = response.headers.get("X-Connection-Title");
                if (isNewConnection === "true" && connectionSlug && connectionId) {
                    logger.info(
                        { slug: connectionSlug, id: connectionId },
                        "New connection created"
                    );
                    addNewConnection({
                        id: connectionId,
                        slug: connectionSlug,
                        title: connectionTitle
                            ? decodeURIComponent(connectionTitle)
                            : null,
                        modelId: conciergeData?.modelId ?? null,
                    });
                }
            }

            return response;
        } catch (error) {
            logger.error(
                {
                    url,
                    method,
                    error: error instanceof Error ? error.message : String(error),
                },
                "API request threw exception"
            );
            setConcierge(null);
            throw error;
        }
    };
}

/**
 * Inner provider that has access to concierge context.
 */
function ConnectRuntimeProviderInner({ children }: ConnectRuntimeProviderProps) {
    const { setConcierge } = useConcierge();
    const { activeConnectionId, initialMessages, addNewConnection, setIsStreaming } =
        useConnection();
    const [overrides, setOverrides] = useState<ModelOverrides>(DEFAULT_OVERRIDES);
    const [displayError, setDisplayError] = useState<Error | null>(null);
    const [input, setInput] = useState("");

    // Use refs for values that change but shouldn't recreate the transport
    const overridesRef = useRef(overrides);
    const connectionIdRef = useRef(activeConnectionId);

    useEffect(() => {
        overridesRef.current = overrides;
    }, [overrides]);

    useEffect(() => {
        connectionIdRef.current = activeConnectionId;
    }, [activeConnectionId]);

    // Convert initial messages to AI SDK UIMessage format
    const initialAIMessages = useMemo(() => {
        if (!initialMessages || initialMessages.length === 0) return undefined;
        return initialMessages.map(toAIMessage);
    }, [initialMessages]);

    // Create transport with custom fetch
    // Note: We pass ref objects (not .current) to be read at fetch time, not render time
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/connection",
                /* eslint-disable react-hooks/refs -- refs are read in fetch callback at call time, not render */
                fetch: createFetchWrapper(
                    setConcierge,
                    overridesRef,
                    connectionIdRef,
                    addNewConnection
                ),
                /* eslint-enable react-hooks/refs */
                prepareSendMessagesRequest(request) {
                    // Send the full messages array - API expects this format
                    return {
                        body: {
                            id: request.id,
                            messages: request.messages,
                            ...request.body,
                        },
                    };
                },
            }),
        [setConcierge, addNewConnection]
    );

    // Chat hook with AI SDK 5.0
    const {
        messages,
        setMessages,
        sendMessage,
        regenerate,
        stop,
        status,
        error,
        clearError: sdkClearError,
    } = useChat({
        id: activeConnectionId ?? undefined,
        messages: initialAIMessages,
        transport,
        onError: (err) => {
            logger.error({ error: err.message }, "Chat error");
            setDisplayError(err);
        },
        experimental_throttle: 50,
    });

    // Derive isLoading from status
    const isLoading = status === "streaming" || status === "submitted";

    // Sync streaming state with connection context
    useEffect(() => {
        setIsStreaming(isLoading);
    }, [isLoading, setIsStreaming]);

    // Track previous connection ID to detect navigation between connections
    const prevConnectionIdRef = useRef<string | null>(activeConnectionId);
    // Track previous message IDs to avoid stale closure issues
    const prevMessageIdsRef = useRef<string>("");

    // Update messages when connection changes
    // Only clear messages when navigating FROM an existing connection to /new
    // Don't clear when already on /new (activeConnectionId stays null)
    useEffect(() => {
        if (activeConnectionId && initialAIMessages && initialAIMessages.length > 0) {
            // Navigated to an existing connection - sync messages
            const newIds = initialAIMessages.map((m) => m.id).join(",");
            if (prevMessageIdsRef.current !== newIds) {
                prevMessageIdsRef.current = newIds;
                setMessages(initialAIMessages);
            }
        } else if (
            !activeConnectionId &&
            prevConnectionIdRef.current !== null &&
            prevConnectionIdRef.current !== activeConnectionId
        ) {
            // Navigated FROM an existing connection TO /new - clear messages
            prevMessageIdsRef.current = "";
            setMessages([]);
        }
        // Update previous connection ID ref
        prevConnectionIdRef.current = activeConnectionId;
    }, [activeConnectionId, initialAIMessages, setMessages]);

    // Sync display error with SDK error
    useEffect(() => {
        if (error) {
            setDisplayError(error);
        } else {
            // Clear display error when SDK error clears
            setDisplayError(null);
        }
    }, [error]);

    // Wrap sendMessage to use our simple format
    const append = useCallback(
        async (message: { role: "user"; content: string }) => {
            setDisplayError(null);
            setInput("");
            try {
                await sendMessage({
                    role: message.role,
                    parts: [{ type: "text", text: message.content }],
                });
            } catch (err) {
                logger.error({ error: err }, "Failed to send message");
                setInput(message.content); // Restore input on error
                throw err;
            }
        },
        [sendMessage]
    );

    // Input handling
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setInput(e.target.value);
        },
        []
    );

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!input.trim() || isLoading) return;
            await append({ role: "user", content: input.trim() });
        },
        [input, isLoading, append]
    );

    const clearError = useCallback(() => {
        setDisplayError(null);
        sdkClearError();
    }, [sdkClearError]);

    const handleRetry = useCallback(() => {
        clearError();
        const composer = document.querySelector<HTMLTextAreaElement>(
            '[data-testid="composer-input"], textarea[placeholder]'
        );
        composer?.focus();
    }, [clearError]);

    // Build context value
    const chatContextValue = useMemo<ChatContextType>(
        () => ({
            messages,
            append,
            isLoading,
            stop,
            reload: regenerate,
            error: displayError,
            clearError,
            input,
            setInput,
            handleInputChange,
            handleSubmit,
        }),
        [
            messages,
            append,
            isLoading,
            stop,
            regenerate,
            displayError,
            clearError,
            input,
            handleInputChange,
            handleSubmit,
        ]
    );

    const errorContextValue = useMemo(
        () => ({ error: displayError, clearError }),
        [displayError, clearError]
    );

    const overridesContextValue = useMemo(
        () => ({ overrides, setOverrides }),
        [overrides]
    );

    return (
        <ModelOverridesContext.Provider value={overridesContextValue}>
            <ChatErrorContext.Provider value={errorContextValue}>
                <ChatContext.Provider value={chatContextValue}>
                    {children}
                    {displayError && (
                        <RuntimeErrorBanner
                            error={displayError}
                            onDismiss={clearError}
                            onRetry={handleRetry}
                        />
                    )}
                </ChatContext.Provider>
            </ChatErrorContext.Provider>
        </ModelOverridesContext.Provider>
    );
}

/**
 * Provides chat functionality via Vercel AI SDK's useChat hook.
 *
 * This wraps the app with:
 * - ConciergeProvider for concierge data
 * - ChatContext for message state and actions
 * - Runtime error display with retry capability
 */
export function ConnectRuntimeProvider({ children }: ConnectRuntimeProviderProps) {
    return (
        <ConciergeProvider>
            <ConnectRuntimeProviderInner>{children}</ConnectRuntimeProviderInner>
        </ConciergeProvider>
    );
}
