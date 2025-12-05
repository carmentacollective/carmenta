"use client";

/**
 * Connection Context
 *
 * Manages the active connection state shared between
 * the header navigation and the chat interface.
 *
 * Simplified Architecture:
 * - Uses URL as source of truth (via pathname)
 * - Server prop provides connection when available (after navigation)
 * - For new connections, reads from client-side list until server catches up
 * - No complex state synchronization - pathname tells us everything we need
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useTransition,
    useMemo,
    useEffect,
    type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

import {
    archiveConnection,
    deleteConnection as deleteConnectionAction,
    type PublicConnection,
} from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";
import { extractIdFromSlug } from "@/lib/sqids";

interface ConnectionContextValue {
    /** All available connections (recent) */
    connections: PublicConnection[];
    /** Currently active connection */
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
    /** The currently active connection (from server) */
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

    // Track recently created connections for animation (cleared after 3s)
    const [freshConnectionIds, setFreshConnectionIds] = useState<Set<string>>(
        new Set()
    );

    // Streaming state - tracks whether AI is generating a response
    // Updated by the runtime provider, read by the header for the pulsing indicator
    const [isStreaming, setIsStreaming] = useState(false);

    // Error state - surfaces operation failures to the UI
    const [error, setError] = useState<Error | null>(null);

    // Track ID of just-created connection (bridges timing gap before server prop arrives)
    // This is needed because usePathname() doesn't update after replaceState()
    const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);

    const clearError = useCallback(() => setError(null), []);

    // Clear pending connection when server prop arrives (navigation complete)
    // This is intentional prop→state sync for the timing gap after replaceState()
    useEffect(() => {
        if (activeConnection) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPendingConnectionId(null);
        }
    }, [activeConnection]);

    /**
     * Derive the active connection.
     * Priority: server prop > pending (just created) > URL parsing
     */
    const effectiveActiveConnection = useMemo(() => {
        // Server prop takes precedence (normal navigation)
        if (activeConnection) {
            return activeConnection;
        }

        // Just created a connection? Find it in our list by ID
        // This handles the timing gap where usePathname() is stale after replaceState()
        if (pendingConnectionId) {
            const pending = connections.find((c) => c.id === pendingConnectionId);
            if (pending) return pending;
        }

        // Fall back to URL parsing for edge cases (e.g., direct navigation, refresh)
        const pathSegments = pathname.split("/");
        const slug = pathSegments[pathSegments.length - 1];

        if (!slug || slug === "new" || slug === "connection") {
            return null;
        }

        try {
            const connectionId = extractIdFromSlug(slug);
            return connections.find((c) => c.id === connectionId) ?? null;
        } catch {
            return null;
        }
    }, [activeConnection, pendingConnectionId, pathname, connections]);

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
        setPendingConnectionId(null); // Clear any pending connection
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
     * Add a newly created connection to the list.
     * Called from runtime provider when a new connection is created via API.
     * Triggers a delightful animation in the connection chooser.
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

            // Track as pending so effectiveActiveConnection finds it
            // (usePathname is stale after replaceState)
            setPendingConnectionId(newConnection.id);

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
                "Added new connection to list"
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
