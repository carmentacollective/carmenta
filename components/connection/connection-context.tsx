"use client";

/**
 * Connection Context
 *
 * Manages the active connection state shared between
 * the header navigation and the chat interface.
 *
 * Architecture:
 * - Receives initial data from server component (SSR)
 * - Uses server actions for mutations (create, archive, delete)
 * - Maintains local state for fast UI updates
 * - Supports both URL-based routing (/connection/[id]) and context-based switching
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useTransition,
    useMemo,
    useEffect,
    useRef,
    type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

import {
    archiveConnection,
    deleteConnection as deleteConnectionAction,
    getConnectionMetadata,
    type PublicConnection,
} from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";

interface ConnectionContextValue {
    /** All available connections (recent) */
    connections: PublicConnection[];
    /** Currently active connection (from DB) */
    activeConnection: PublicConnection | null;
    /** ID of the currently active connection */
    activeConnectionId: string | null;
    /** IDs of recently created connections (for animation) */
    freshConnectionIds: Set<string>;
    /** Number of connections with background streaming */
    runningCount: number;
    /** Whether the AI is currently generating a response */
    isStreaming: boolean;
    /** Whether the context has been initialized with data */
    isLoaded: boolean;
    /** Whether a transition (create/delete) is in progress */
    isPending: boolean;
    /** Current error from a failed operation, if any */
    error: Error | null;
    /** Initial messages for the active connection */
    initialMessages: UIMessageLike[];
    /** Switch to a different connection (navigates to slug URL) */
    setActiveConnection: (slug: string) => void;
    /** Create a new connection and navigate to it */
    createNewConnection: () => void;
    /** Archive the active connection */
    archiveActiveConnection: () => void;
    /** Delete a connection */
    deleteConnection: (id: string) => void;
    /** Clear the current error */
    clearError: () => void;
    /** Refresh connection metadata (call after streaming to sync URL/title) */
    refreshConnectionMetadata: () => Promise<boolean>;
    /** Add a newly created connection to the list (called from runtime provider) */
    addNewConnection: (
        connection: Partial<PublicConnection> & { id: string; slug: string }
    ) => void;
    /** Update streaming state (called from runtime provider) */
    setIsStreaming: (streaming: boolean) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

interface ConnectionProviderProps {
    children: ReactNode;
    /** Initial connections from server (recent list) */
    initialConnections?: PublicConnection[];
    /** The currently active connection (from [id] param) */
    activeConnection?: PublicConnection | null;
    /** Initial messages for the active connection */
    initialMessages?: UIMessageLike[];
}

export function ConnectionProvider({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
}: ConnectionProviderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    // Local state for connections list (optimistic updates)
    const [connections, setConnections] =
        useState<PublicConnection[]>(initialConnections);

    // Override connection - only set when a new connection is created via addNewConnection.
    // We use the prop by default and only override when explicitly set.
    // This avoids the timing issue where state sync via useEffect happens after render.
    const [overrideConnection, setOverrideConnection] =
        useState<PublicConnection | null>(null);

    // Clear override when activeConnection prop changes (navigation happened).
    // This prevents stale override from showing when user clicks "New" after
    // creating a connection. This is intentional props→state sync.
    const prevPropIdRef = useRef(activeConnection?.id);
    useEffect(() => {
        if (activeConnection?.id !== prevPropIdRef.current) {
            prevPropIdRef.current = activeConnection?.id;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOverrideConnection(null);
        }
    }, [activeConnection?.id]);

    // Effective active connection: use override only if it matches a "new connection" scenario
    // (i.e., when we're on /connection/new and the override has data the prop doesn't).
    // If the prop has data (navigation happened), always prefer the prop.
    // This gives us immediate updates from props (navigation) while supporting
    // local updates from addNewConnection.
    const effectiveActiveConnection = useMemo(() => {
        // If prop has a valid connection, use it (covers navigation case)
        if (activeConnection) {
            return activeConnection;
        }
        // No prop connection, use override if set (covers new connection case)
        return overrideConnection;
    }, [activeConnection, overrideConnection]);

    // Track recently created connections for animation (cleared after 3s)
    const [freshConnectionIds, setFreshConnectionIds] = useState<Set<string>>(
        new Set()
    );

    // Streaming state - tracks whether AI is generating a response
    // Updated by the runtime provider, read by the header for the pulsing indicator
    const [isStreaming, setIsStreaming] = useState(false);

    // Error state - surfaces operation failures to the UI
    const [error, setError] = useState<Error | null>(null);

    const clearError = useCallback(() => setError(null), []);

    // Derive active connection ID from effective connection
    const activeConnectionId = effectiveActiveConnection?.id ?? null;

    // Count connections with streaming status (running in background)
    const runningCount = useMemo(
        () => connections.filter((c) => c.streamingStatus === "streaming").length,
        [connections]
    );

    const isLoaded =
        initialConnections.length > 0 || effectiveActiveConnection !== null;

    /**
     * Navigate to a connection using its slug.
     * The slug is the SEO-friendly URL: /connection/title-slug-id
     */
    const setActiveConnection = useCallback(
        (slug: string) => {
            router.push(`/connection/${slug}`);
        },
        [router]
    );

    /**
     * Navigate to the new connection page.
     * The actual connection is created lazily when the user sends their first message.
     * This follows the pattern from ai-chatbot and LibreChat.
     */
    const handleCreateNewConnection = useCallback(() => {
        router.push("/connection/new");
    }, [router]);

    const archiveActiveConnection = useCallback(() => {
        if (!activeConnectionId) return;

        startTransition(async () => {
            try {
                await archiveConnection(activeConnectionId);
                logger.debug(
                    { connectionId: activeConnectionId },
                    "Archived connection"
                );
                router.push("/connection");
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(
                    { error, connectionId: activeConnectionId },
                    "Failed to archive connection"
                );
                setError(error);
            }
        });
    }, [activeConnectionId, router]);

    const handleDeleteConnection = useCallback(
        (id: string) => {
            startTransition(async () => {
                try {
                    await deleteConnectionAction(id);
                    logger.debug({ connectionId: id }, "Deleted connection");
                    // Optimistically remove from list
                    setConnections((prev) => prev.filter((c) => c.id !== id));
                    // Navigate away if deleted the active one
                    if (id === activeConnectionId) {
                        router.push("/connection");
                    }
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error(
                        { error, connectionId: id },
                        "Failed to delete connection"
                    );
                    setError(error);
                }
            });
        },
        [activeConnectionId, router]
    );

    /**
     * Refresh connection metadata from the server.
     * Call this after streaming completes to sync URL and page title
     * if the connection title was generated.
     *
     * @returns true if title was updated, false otherwise
     */
    const refreshConnectionMetadata = useCallback(async (): Promise<boolean> => {
        if (!activeConnectionId) return false;

        try {
            const metadata = await getConnectionMetadata(activeConnectionId);
            if (!metadata) return false;

            // Check if slug changed (title was generated)
            const currentSlug = pathname.split("/").pop();
            if (metadata.slug !== currentSlug) {
                logger.debug(
                    { oldSlug: currentSlug, newSlug: metadata.slug },
                    "Slug changed, updating URL"
                );

                // Update URL without navigation (replace in history)
                router.replace(`/connection/${metadata.slug}`);

                // Update document title
                if (metadata.title) {
                    document.title = `${metadata.title} | Carmenta`;
                }

                // Update the connections list with new metadata
                setConnections((prev) =>
                    prev.map((c) =>
                        c.id === activeConnectionId
                            ? { ...c, title: metadata.title, slug: metadata.slug }
                            : c
                    )
                );

                return true; // Title was updated
            }
            return false;
        } catch (err) {
            // Non-critical - log but don't error
            logger.warn({ error: err }, "Failed to refresh connection metadata");
            return false;
        }
    }, [activeConnectionId, pathname, router]);

    /**
     * Title is now generated by concierge at connection creation time.
     * No polling needed - URL updates via replaceState when new connection is created.
     *
     * This effect can be used for edge cases like page refresh on old URLs
     * where the slug might be stale.
     */
    // Track if we've already refreshed metadata for this connection
    const refreshedRef = useRef<string | null>(null);

    useEffect(() => {
        // Skip if no connection or already has title
        if (!activeConnectionId || activeConnection?.title) {
            return;
        }

        // Skip if we've already refreshed for this connection
        if (refreshedRef.current === activeConnectionId) {
            return;
        }

        // Mark as refreshed to prevent duplicate calls
        refreshedRef.current = activeConnectionId;

        // Schedule the refresh for next tick to avoid synchronous setState
        const timeoutId = setTimeout(() => {
            refreshConnectionMetadata();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [activeConnectionId, activeConnection?.title, refreshConnectionMetadata]);

    /**
     * Add a newly created connection to the list and set it as active.
     * Called from runtime provider when a new connection is created via API.
     * Triggers a delightful animation in the connection chooser and updates the header title.
     */
    const addNewConnection = useCallback(
        (
            partialConnection: Partial<PublicConnection> & { id: string; slug: string }
        ) => {
            const now = new Date();
            const newConnection: PublicConnection = {
                id: partialConnection.id,
                userId: "", // Will be filled in by actual data
                slug: partialConnection.slug,
                title: partialConnection.title ?? null,
                modelId: partialConnection.modelId ?? null,
                status: "active",
                streamingStatus: "idle", // Runtime tracks actual streaming state
                createdAt: now,
                updatedAt: now,
                lastActivityAt: now,
            };

            // Set as active connection override - this updates the header title
            setOverrideConnection(newConnection);

            // Add to front of list (most recent)
            setConnections((prev) => {
                // Don't add if already exists
                if (prev.some((c) => c.id === newConnection.id)) {
                    return prev;
                }
                return [newConnection, ...prev];
            });

            // Mark as fresh for animation
            setFreshConnectionIds((prev) => new Set(prev).add(newConnection.id));

            // Clear "fresh" status after animation completes (3 seconds)
            setTimeout(() => {
                setFreshConnectionIds((prev) => {
                    const next = new Set(prev);
                    next.delete(newConnection.id);
                    return next;
                });
            }, 3000);

            logger.debug(
                { connectionId: newConnection.id, title: newConnection.title },
                "Added new connection to list and set as active"
            );
        },
        []
    );

    const value = useMemo<ConnectionContextValue>(
        () => ({
            connections,
            activeConnection: effectiveActiveConnection,
            activeConnectionId,
            freshConnectionIds,
            runningCount,
            isStreaming,
            isLoaded,
            isPending,
            error,
            initialMessages,
            setActiveConnection,
            createNewConnection: handleCreateNewConnection,
            archiveActiveConnection,
            deleteConnection: handleDeleteConnection,
            clearError,
            refreshConnectionMetadata,
            addNewConnection,
            setIsStreaming,
        }),
        [
            connections,
            effectiveActiveConnection,
            activeConnectionId,
            freshConnectionIds,
            runningCount,
            isStreaming,
            isLoaded,
            isPending,
            error,
            initialMessages,
            setActiveConnection,
            handleCreateNewConnection,
            archiveActiveConnection,
            handleDeleteConnection,
            clearError,
            refreshConnectionMetadata,
            addNewConnection,
        ]
    );

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error("useConnection must be used within a ConnectionProvider");
    }
    return context;
}
