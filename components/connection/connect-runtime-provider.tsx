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
import { DefaultChatTransport, generateId } from "ai";
import { AlertCircle, RefreshCw, X } from "lucide-react";

import { logger } from "@/lib/client-logger";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/hooks/use-haptic-feedback";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import {
    ConciergeProvider,
    useConcierge,
    parseConciergeHeaders,
} from "@/lib/concierge/context";
import { useConnection } from "./connection-context";
import type { ModelOverrides } from "./model-selector/types";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { TransientProvider, useTransient } from "@/lib/streaming";

/**
 * Convert our DB UIMessageLike format to AI SDK UIMessage format
 *
 * Handles all part types stored in the database:
 * - text: Plain text content
 * - reasoning: Model's thinking with optional providerMetadata
 * - file: Attached files (images, documents)
 * - step-start: Step boundary markers
 * - tool-*: Tool calls with state, input, output
 * - data-*: Generative UI data (comparisons, research results)
 *
 * Note: Uses loose typing because the AI SDK's UIMessagePart type doesn't
 * accommodate all the part types we store (tool-*, data-*). The runtime
 * behavior is correct; TypeScript just can't express the full union.
 *
 * Exported for testing.
 */
export function toAIMessage(msg: UIMessageLike): UIMessage {
    // Map parts with loose typing - the AI SDK accepts these at runtime
    // Filter out null/undefined parts that can occur during stream resume
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedParts: any[] = msg.parts
        .filter((part) => part != null && typeof part === "object" && "type" in part)
        .map((part) => {
            const partType = part.type as string;

            if (partType === "text") {
                return { type: "text", text: String(part.text || "") };
            }

            if (partType === "reasoning") {
                const reasoningPart: Record<string, unknown> = {
                    type: "reasoning",
                    text: String(part.text || ""),
                };
                // Include providerMetadata if present (for reasoning tokens, cache info)
                if (part.providerMetadata) {
                    reasoningPart.providerMetadata = part.providerMetadata;
                }
                return reasoningPart;
            }

            if (partType === "file") {
                return {
                    type: "file",
                    url: String(part.url || ""),
                    mediaType: String(part.mediaType || part.mimeType || ""),
                    name: String(part.name || "file"),
                };
            }

            if (partType === "step-start") {
                return { type: "step-start" };
            }

            // Tool parts: type is "tool-{toolName}" (e.g., "tool-webSearch")
            if (partType.startsWith("tool-")) {
                const toolPart: Record<string, unknown> = {
                    type: partType,
                    toolCallId: String(part.toolCallId || ""),
                    state: (part.state as string) || "input-available",
                    input: part.input,
                };
                if (part.output !== undefined) {
                    toolPart.output = part.output;
                }
                if (part.errorText) {
                    toolPart.errorText = part.errorText;
                }
                return toolPart;
            }

            // Data parts: type is "data-{dataType}" (e.g., "data-comparison")
            if (partType.startsWith("data-")) {
                return {
                    type: partType,
                    id: String(part.id || ""),
                    data: part.data || {},
                };
            }

            // Fallback for truly unknown types - preserve as-is
            return { type: "text", text: String(part.text || "") };
        });

    return {
        id: msg.id,
        role: msg.role,
        parts: mappedParts,
    };
}

/**
 * Chat context type - provides chat state and actions to children
 */
interface ChatContextType {
    /** Messages in the chat */
    messages: UIMessage[];
    /** Send a message - wraps sendMessage with our format */
    append: (message: {
        role: "user";
        content: string;
        files?: Array<{ url: string; mediaType: string; name: string }>;
    }) => Promise<void>;
    /** Whether the AI is currently generating */
    isLoading: boolean;
    /** Stop the current generation */
    stop: () => void;
    /** Regenerate the last response */
    reload: () => void;
    /**
     * Regenerate response from a specific assistant message.
     * Uses AI SDK 5.0's regenerate({ messageId }) to re-run from that point,
     * discarding subsequent messages and generating a new response.
     */
    regenerateFrom: (messageId: string) => Promise<void>;
    /**
     * Regenerate response from a specific assistant message with a specific model.
     * Temporarily overrides the model selection for this regeneration only.
     */
    regenerateFromWithModel: (messageId: string, modelId: string) => Promise<void>;
    /**
     * Edit a user message and regenerate from that point.
     * Updates the message content, removes all subsequent messages,
     * and triggers a new generation.
     */
    editMessageAndRegenerate: (messageId: string, newContent: string) => Promise<void>;
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
 * Context for settings modal - allows any component to open the model selector.
 * Used by feature tips to open settings when user clicks "Adjust settings" CTA.
 */
export interface SettingsModalContextType {
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
}

export const SettingsModalContext = createContext<SettingsModalContextType | null>(
    null
);

export function useSettingsModal() {
    const context = useContext(SettingsModalContext);
    if (!context) {
        throw new Error("useSettingsModal must be used within ConnectRuntimeProvider");
    }
    return context;
}

/**
 * Context for code mode - allows components to know when in code mode
 * and access the project path.
 */
export interface CodeModeContextType {
    /** Whether the current connection is in code mode */
    isCodeMode: boolean;
    /** Project path when in code mode, null otherwise */
    projectPath: string | null;
}

const CodeModeContext = createContext<CodeModeContextType>({
    isCodeMode: false,
    projectPath: null,
});

export function useCodeMode() {
    return useContext(CodeModeContext);
}

/**
 * Parses an error message and extracts a user-friendly message.
 * Handles JSON error responses, HTML error pages, provider errors, and plain text.
 *
 * All messages follow Carmenta voice: warm, direct, confident, helpful.
 * No technical jargon. Be honest about what's transient vs what's broken.
 * Don't say "try again" when retrying won't help.
 */
function parseErrorMessage(message: string | undefined): string {
    if (!message) return "We couldn't complete that request.";

    const trimmed = message.trim();
    const lowerMessage = trimmed.toLowerCase();

    // Provider/model errors - translate technical messages to helpful ones
    if (
        lowerMessage.includes("provider returned error") ||
        lowerMessage.includes("ai_apicallerror")
    ) {
        // Check for specific patterns in the full message
        // Thinking block issues - transient, retry is honest
        if (lowerMessage.includes("thinking") && lowerMessage.includes("block")) {
            return "We hit a conversation glitch. Try sending your message again.";
        }
        // Rate limits - transient, retry works after waiting
        if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
            return "The model is busy right now. Give it a moment and try again.";
        }
        // Overloaded - transient, offer alternative
        if (lowerMessage.includes("overloaded") || lowerMessage.includes("503")) {
            return "High demand right now. Try a different model or wait a moment.";
        }
        // Timeout - transient, offer alternative approach
        if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
            return "The response took too long. Try a simpler question or a faster model.";
        }
        // Generic provider error - might be transient, offer options
        return "We couldn't reach the model. Try again or switch models.";
    }

    // Connection/network errors - user can fix
    if (
        lowerMessage.includes("fetch failed") ||
        lowerMessage.includes("network error") ||
        lowerMessage.includes("econnrefused")
    ) {
        return "Connection dropped. Check your network and try again.";
    }

    // Handle JSON error responses
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed.error === "string") {
                // Recursively parse the inner error message
                return parseErrorMessage(parsed.error);
            }
        } catch {
            // Not valid JSON
        }
    }

    // Handle HTML error pages - extract status code if present
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
        const statusMatch = trimmed.match(/<h1[^>]*>(\d{3})<\/h1>/);
        if (statusMatch) {
            const status = statusMatch[1];
            // 404 - might be stale state, refresh helps
            if (status === "404") return "We lost the thread. Refresh to continue.";
            // 500 - our bug, don't lie about retry working
            if (status === "500")
                return "Something broke on our end. The robots have been notified. 🤖";
            // Other status - our bug
            return "Something unexpected happened. The bots are on it. 🤖";
        }
        // Unknown HTML response - likely our bug
        return "Something unexpected happened. The bots are on it. 🤖";
    }

    // Very long messages (likely a stack trace) - our bug
    if (trimmed.length > 200) {
        return "Something went sideways. The robots have been alerted. 🤖";
    }

    // Final pass: check for any remaining technical patterns
    if (lowerMessage.includes("error")) {
        // Make generic "error" messages more helpful
        if (trimmed.length < 50 && !lowerMessage.includes("please")) {
            return `${trimmed}. Try again or switch models.`;
        }
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

    // Trigger haptic on mount (error appeared)
    useEffect(() => {
        triggerHaptic();
    }, []);

    return (
        <div
            className={cn(
                "fixed bottom-24 left-1/2 z-toast -translate-x-1/2",
                "flex max-w-md items-center gap-3 rounded-xl px-4 py-3",
                "bg-red-50/95 shadow-lg backdrop-blur-sm",
                "border border-red-200/50",
                "duration-300 animate-in fade-in slide-in-from-bottom-4"
            )}
            role="alert"
        >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{displayMessage}</p>
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
 *
 * For code mode (when projectPathRef has a value), routes to /api/code
 * and includes projectPath in the request body.
 */
function createFetchWrapper(
    setConcierge: (data: ReturnType<typeof parseConciergeHeaders>) => void,
    overridesRef: React.MutableRefObject<ModelOverrides>,
    connectionIdRef: React.MutableRefObject<string | null>,
    projectPathRef: React.MutableRefObject<string | null>,
    addNewConnection: (connection: {
        id: string;
        slug: string;
        title: string | null;
        modelId: string | null;
    }) => void,
    onNewConnectionCreated: (
        title: string | null,
        slug: string | null,
        id: string | null
    ) => void
) {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        let url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";

        // Code mode routing: when projectPath is set, use /api/code
        const isCodeMode = !!projectPathRef.current;
        if (isCodeMode && url.includes("/api/connection")) {
            url = url.replace("/api/connection", "/api/code");
        }

        logger.debug({ url, method, isCodeMode }, "API request starting");

        // Clear stale concierge data (not used in code mode)
        if (!isCodeMode) {
            setConcierge(null);
        }

        // Inject connectionId, model overrides, and projectPath into POST body
        let modifiedInit = init;
        if (method === "POST" && init?.body) {
            try {
                const body = JSON.parse(init.body as string);

                if (connectionIdRef.current) {
                    body.connectionId = connectionIdRef.current;
                }

                // Code mode: include projectPath
                if (projectPathRef.current) {
                    body.projectPath = projectPathRef.current;
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
                        projectPath: projectPathRef.current,
                        modelOverride: overridesRef.current.modelId,
                    },
                    "Applied request overrides"
                );
            } catch {
                logger.warn({}, "Failed to parse request body for override injection");
            }
        }

        // Update the input URL for the actual fetch
        input = url;

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
                    const decodedTitle = connectionTitle
                        ? decodeURIComponent(connectionTitle)
                        : null;
                    addNewConnection({
                        id: connectionId,
                        slug: connectionSlug,
                        title: decodedTitle,
                        modelId: conciergeData?.modelId ?? null,
                    });
                    onNewConnectionCreated(decodedTitle, connectionSlug, connectionId);

                    // Update the ref so subsequent requests (regenerate, follow-up messages)
                    // use this connection instead of creating new ones
                    connectionIdRef.current = connectionId;
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
    const {
        activeConnection,
        activeConnectionId,
        initialMessages,
        addNewConnection,
        setIsStreaming,
    } = useConnection();
    const { handleDataPart, clearAll: clearTransientMessages } = useTransient();
    const [overrides, setOverrides] = useState<ModelOverrides>(DEFAULT_OVERRIDES);
    const [displayError, setDisplayError] = useState<Error | null>(null);
    const [input, setInput] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Code mode: when projectPath is set, route to /api/code
    const isCodeMode = !!activeConnection?.projectPath;
    const projectPath = activeConnection?.projectPath ?? null;

    // Generate a stable chat ID for new connections.
    // This matches Vercel's ai-chatbot pattern where the ID is known BEFORE sending.
    // For existing connections, we use the server-provided ID.
    const [pendingChatId] = useState(() => generateId());

    // The effective chat ID: use existing connection ID if available,
    // otherwise use the pending ID for new connections
    const effectiveChatId = activeConnectionId ?? pendingChatId;

    // Use refs for values that change but shouldn't recreate the transport
    const overridesRef = useRef(overrides);
    const connectionIdRef = useRef(activeConnectionId);
    const projectPathRef = useRef(projectPath);

    useEffect(() => {
        overridesRef.current = overrides;
    }, [overrides]);

    useEffect(() => {
        connectionIdRef.current = activeConnectionId;
    }, [activeConnectionId]);

    useEffect(() => {
        projectPathRef.current = projectPath;
    }, [projectPath]);

    // Update document title and URL when a new connection is created
    // Uses replaceState so the URL updates without triggering navigation
    const handleNewConnectionCreated = useCallback(
        (title: string | null, slug: string | null, id: string | null) => {
            if (title) {
                document.title = `${title} | Carmenta`;
            }
            if (slug && id) {
                window.history.replaceState(
                    { ...window.history.state },
                    "",
                    `/connection/${slug}/${id}`
                );
            }
        },
        []
    );

    // Convert initial messages to AI SDK UIMessage format
    const initialAIMessages = useMemo(() => {
        if (!initialMessages || initialMessages.length === 0) return undefined;
        return initialMessages.map(toAIMessage);
    }, [initialMessages]);

    // Create transport with custom fetch
    // Note: We pass ref objects (not .current) to be read at fetch time, not render time
    // The fetch wrapper handles routing to /api/code when projectPath is set
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/connection",
                /* eslint-disable react-hooks/refs -- refs are read in fetch callback at call time, not render */
                fetch: createFetchWrapper(
                    setConcierge,
                    overridesRef,
                    connectionIdRef,
                    projectPathRef,
                    addNewConnection,
                    handleNewConnectionCreated
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
        [setConcierge, addNewConnection, handleNewConnectionCreated]
    );

    // Chat hook with AI SDK 5.0
    // Key insight: We use effectiveChatId (which is stable from the start)
    // so that messages are tracked correctly even before the server creates
    // the connection. This matches Vercel's ai-chatbot pattern.
    //
    // Resume: Enabled for existing connections so we can recover interrupted streams.
    // When resume is true, the hook checks GET /api/connection/{id}/stream on mount.
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
        id: effectiveChatId,
        messages: initialAIMessages,
        transport,
        // Enable stream resumption for existing connections (not new ones)
        resume: !!activeConnectionId,
        onError: (err) => {
            logger.error({ error: err.message }, "Chat error");
            setDisplayError(err);
            clearTransientMessages();
        },
        // Handle transient data parts (status updates) as they stream
        onData: (dataPart) => {
            handleDataPart(dataPart);
        },
        // Clear transient messages when streaming completes
        onFinish: () => {
            clearTransientMessages();
        },
        experimental_throttle: 50,
    });

    // Derive loading states from status
    const isLoading = status === "streaming" || status === "submitted";

    // Keep screen awake during AI streaming (prevents screen dim during long responses)
    useWakeLock({ enabled: isLoading });

    // Sync states with connection context
    useEffect(() => {
        setIsStreaming(isLoading);
    }, [isLoading, setIsStreaming]);

    // Track previous connection ID to detect navigation between connections
    const prevConnectionIdRef = useRef<string | null>(activeConnectionId);

    // Update messages when navigating to a different connection
    // Key: We DON'T clear messages when activeConnectionId is null (new connection)
    // because the chat hook is already tracking messages by effectiveChatId
    useEffect(() => {
        const prevId = prevConnectionIdRef.current;
        const currentId = activeConnectionId;

        // Only act when connection ID actually changes
        if (prevId !== currentId) {
            prevConnectionIdRef.current = currentId;

            if (currentId && initialAIMessages && initialAIMessages.length > 0) {
                // Navigated to existing connection - load its messages
                setMessages(initialAIMessages);
            } else if (prevId && !currentId) {
                // Navigated from existing connection to new - clear messages
                // (but only if we had a previous connection)
                setMessages([]);
            }
            // If prevId was null (new) and currentId is now set (connection created),
            // don't clear - the messages are already in state from streaming
        }
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
        async (message: {
            role: "user";
            content: string;
            files?: Array<{ url: string; mediaType: string; name: string }>;
        }) => {
            setDisplayError(null);
            setInput("");
            try {
                // Build parts array with text and files
                const parts: Array<
                    | { type: "text"; text: string }
                    | {
                          type: "file";
                          url: string;
                          mediaType: string;
                          name: string;
                      }
                > = [];

                // Add text part
                if (message.content) {
                    parts.push({ type: "text", text: message.content });
                }

                // Add file parts
                if (message.files?.length) {
                    for (const file of message.files) {
                        parts.push({
                            type: "file",
                            url: file.url,
                            mediaType: file.mediaType,
                            name: file.name,
                        });
                    }
                }

                await sendMessage({
                    role: message.role,
                    parts,
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

    /**
     * Regenerate from a specific assistant message.
     * Wraps the AI SDK's regenerate({ messageId }) which handles:
     * - Finding the message
     * - Removing subsequent messages
     * - Re-running generation from that point
     */
    const regenerateFrom = useCallback(
        async (messageId: string) => {
            setDisplayError(null);
            setConcierge(null);
            try {
                await regenerate({ messageId });
            } catch (err) {
                logger.error({ error: err, messageId }, "Failed to regenerate");
                throw err;
            }
        },
        [regenerate, setConcierge]
    );

    /**
     * Regenerate from a specific assistant message with a specific model.
     * Sets the model override before regenerating, which persists for future messages
     * (user explicitly chose this model, so we honor that choice going forward).
     */
    const regenerateFromWithModel = useCallback(
        async (messageId: string, modelId: string) => {
            // Update both state and ref to avoid race condition
            // The ref needs to be updated immediately so regenerateFrom reads the new value
            setOverrides((prev) => {
                const newOverrides = { ...prev, modelId };
                overridesRef.current = newOverrides; // Sync ref immediately
                return newOverrides;
            });
            // Now regenerate (the override ref will have the new value)
            await regenerateFrom(messageId);
        },
        [regenerateFrom, setOverrides]
    );

    /**
     * Edit a user message and regenerate from that point.
     * 1. Updates the message content in the messages array
     * 2. Removes all messages after the edited one
     * 3. Triggers a new generation with the edited content
     */
    const editMessageAndRegenerate = useCallback(
        async (messageId: string, newContent: string) => {
            setDisplayError(null);
            setConcierge(null);

            // Find the message and its index
            const messageIndex = messages.findIndex((m) => m.id === messageId);
            if (messageIndex === -1) {
                logger.error({ messageId }, "Message not found for edit");
                return;
            }

            const originalMessage = messages[messageIndex];

            // Preserve non-text parts (file attachments) from the original message
            const nonTextParts = originalMessage.parts.filter(
                (part) => part.type !== "text"
            );

            // Create updated messages array:
            // - Keep messages before the edited one
            // - Update the edited message's content while preserving file attachments
            // - Remove all messages after (they'll be regenerated)
            const updatedMessages = messages.slice(0, messageIndex + 1).map((m) => {
                if (m.id === messageId) {
                    // Update text content while preserving file attachments
                    return {
                        ...m,
                        parts: [
                            { type: "text" as const, text: newContent },
                            ...nonTextParts,
                        ],
                    };
                }
                return m;
            });

            // Set the truncated and updated messages
            setMessages(updatedMessages);

            // Trigger regeneration from the edited message
            // Use regenerate() instead of sendMessage() to avoid duplicating the user message
            try {
                await regenerate();
            } catch (err) {
                logger.error(
                    { error: err, messageId },
                    "Failed to regenerate after edit"
                );
                throw err;
            }
        },
        [messages, setMessages, regenerate, setConcierge]
    );

    // Build context value
    const chatContextValue = useMemo<ChatContextType>(
        () => ({
            messages,
            append,
            isLoading,
            stop,
            reload: regenerate,
            regenerateFrom,
            regenerateFromWithModel,
            editMessageAndRegenerate,
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
            regenerateFrom,
            regenerateFromWithModel,
            editMessageAndRegenerate,
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

    const settingsModalContextValue = useMemo(
        () => ({ settingsOpen, setSettingsOpen }),
        [settingsOpen]
    );

    const codeModeContextValue = useMemo<CodeModeContextType>(
        () => ({ isCodeMode, projectPath }),
        [isCodeMode, projectPath]
    );

    return (
        <CodeModeContext.Provider value={codeModeContextValue}>
            <SettingsModalContext.Provider value={settingsModalContextValue}>
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
            </SettingsModalContext.Provider>
        </CodeModeContext.Provider>
    );
}

/**
 * Inner wrapper that reads initialConcierge from ConnectionContext
 * and passes it to ConciergeProvider.
 */
function ConciergeWrapper({ children }: { children: ReactNode }) {
    const { initialConcierge } = useConnection();

    // Convert PersistedConciergeData to ConciergeResult format
    // The persisted format matches ConciergeResult's core fields
    //
    // SAFETY: When initialConcierge is truthy, all fields are guaranteed to be present.
    // extractConciergeData() in lib/actions/connections.ts only returns non-null when
    // ALL fields exist in the database row.
    const initial = initialConcierge
        ? {
              modelId: initialConcierge.modelId,
              temperature: initialConcierge.temperature,
              explanation: initialConcierge.explanation,
              reasoning: initialConcierge.reasoning,
          }
        : null;

    return <ConciergeProvider initial={initial}>{children}</ConciergeProvider>;
}

/**
 * Provides chat functionality via Vercel AI SDK's useChat hook.
 *
 * This wraps the app with:
 * - ConciergeProvider for concierge data (hydrated from persisted state)
 * - TransientProvider for ephemeral status messages during streaming
 * - ChatContext for message state and actions
 * - Runtime error display with retry capability
 */
export function ConnectRuntimeProvider({ children }: ConnectRuntimeProviderProps) {
    return (
        <ConciergeWrapper>
            <TransientProvider>
                <ConnectRuntimeProviderInner>{children}</ConnectRuntimeProviderInner>
            </TransientProvider>
        </ConciergeWrapper>
    );
}
