"use client";

/**
 * Connection Context
 *
 * Manages the active connection state shared between
 * the header navigation and the chat interface.
 *
 * SIMPLE Architecture:
 * - Server prop is the source of truth for activeConnection
 * - displayTitle is just for showing the title in the header (doesn't affect anything else)
 * - Real navigation for switching connections
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useTransition,
    useMemo,
    type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
    archiveConnection,
    deleteConnection as deleteConnectionAction,
    toggleStarConnection as toggleStarAction,
    updateConnection as updateConnectionAction,
    type PublicConnection,
    type PersistedConciergeData,
} from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";

interface ConnectionContextValue {
    connections: PublicConnection[];
    /** Starred connections, sorted by lastActivityAt */
    starredConnections: PublicConnection[];
    /** Non-starred connections, sorted by lastActivityAt */
    unstarredConnections: PublicConnection[];
    activeConnection: PublicConnection | null;
    activeConnectionId: string | null;
    /** Title to display (from server OR from just-created connection) */
    displayTitle: string | null;
    freshConnectionIds: Set<string>;
    runningCount: number;
    isStreaming: boolean;
    isLoaded: boolean;
    isPending: boolean;
    error: Error | null;
    initialMessages: UIMessageLike[];
    /** Persisted concierge data for hydrating UI on page load */
    initialConcierge: PersistedConciergeData | null;
    setActiveConnection: (id: string, slug: string) => void;
    createNewConnection: () => void;
    archiveActiveConnection: () => void;
    deleteConnection: (id: string) => void;
    toggleStarConnection: (id: string) => void;
    updateConnectionTitle: (id: string, title: string) => void;
    clearError: () => void;
    addNewConnection: (
        connection: Partial<PublicConnection> & { id: string; slug: string }
    ) => void;
    setIsStreaming: (streaming: boolean) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

interface ConnectionProviderProps {
    children: ReactNode;
    initialConnections?: PublicConnection[];
    activeConnection?: PublicConnection | null;
    initialMessages?: UIMessageLike[];
    /** Persisted concierge data for hydrating UI on page load */
    initialConcierge?: PersistedConciergeData | null;
}

export function ConnectionProvider({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
    initialConcierge = null,
}: ConnectionProviderProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [connections, setConnections] =
        useState<PublicConnection[]>(initialConnections);

    const [freshConnectionIds, setFreshConnectionIds] = useState<Set<string>>(
        new Set()
    );

    // Simple: just a title string for display purposes
    // Set when a new connection is created mid-stream
    // Cleared when we have a real activeConnection from server
    const [displayTitle, setDisplayTitle] = useState<string | null>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const clearError = useCallback(() => setError(null), []);

    // Simple: server prop is truth. That's it.
    const activeConnectionId = activeConnection?.id ?? null;

    const runningCount = useMemo(
        () => connections.filter((c) => c.streamingStatus === "streaming").length,
        [connections]
    );

    const isLoaded = initialConnections.length > 0 || activeConnection !== null;

    const setActiveConnectionNav = useCallback(
        (id: string, slug: string) => {
            // Clear display title on navigation - server will provide the real one
            setDisplayTitle(null);
            router.push(`/connection/${slug}/${id}`);
        },
        [router]
    );

    const handleCreateNewConnection = useCallback(() => {
        setDisplayTitle(null);
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
                    "Failed to archive"
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
                    setConnections((prev) => prev.filter((c) => c.id !== id));
                    if (id === activeConnectionId) {
                        router.push("/connection/new");
                    }
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error({ error, connectionId: id }, "Failed to delete");
                    setError(error);
                }
            });
        },
        [activeConnectionId, router]
    );

    const addNewConnection = useCallback(
        (
            partialConnection: Partial<PublicConnection> & { id: string; slug: string }
        ) => {
            const now = new Date();
            const newConnection: PublicConnection = {
                id: partialConnection.id,
                userId: "",
                slug: partialConnection.slug,
                title: partialConnection.title ?? null,
                modelId: partialConnection.modelId ?? null,
                status: "active",
                streamingStatus: "streaming",
                isStarred: false,
                starredAt: null,
                createdAt: now,
                updatedAt: now,
                lastActivityAt: now,
            };

            setConnections((prev) => {
                if (prev.some((c) => c.id === newConnection.id)) {
                    return prev;
                }
                return [newConnection, ...prev];
            });

            // Just set the title for display - nothing else
            if (newConnection.title) {
                setDisplayTitle(newConnection.title);
            }

            setFreshConnectionIds((prev) => new Set(prev).add(newConnection.id));

            setTimeout(() => {
                setFreshConnectionIds((prev) => {
                    const next = new Set(prev);
                    next.delete(newConnection.id);
                    return next;
                });
            }, 3000);

            logger.debug(
                { connectionId: newConnection.id, title: newConnection.title },
                "Added new connection"
            );
        },
        []
    );

    const handleToggleStarConnection = useCallback((id: string) => {
        // Capture values from the functional update for use in API call
        let originalIsStarred: boolean | undefined;
        let originalStarredAt: Date | null | undefined;
        let newIsStarred: boolean | undefined;

        // Pure optimistic update - captures original values via closure
        setConnections((prev) => {
            const connection = prev.find((c) => c.id === id);
            if (!connection) return prev;

            originalIsStarred = connection.isStarred;
            originalStarredAt = connection.starredAt;
            newIsStarred = !originalIsStarred;

            return prev.map((c) =>
                c.id === id
                    ? {
                          ...c,
                          isStarred: newIsStarred!,
                          starredAt: newIsStarred ? new Date() : null,
                      }
                    : c
            );
        });

        // Server action OUTSIDE setState updater (prevents double API calls in StrictMode)
        startTransition(async () => {
            // Guard: if connection wasn't found, skip API call
            if (newIsStarred === undefined) return;

            try {
                await toggleStarAction(id, newIsStarred);
                logger.debug(
                    { connectionId: id, isStarred: newIsStarred },
                    "Toggled star"
                );
            } catch (err) {
                // Revert to original state on error
                setConnections((current) =>
                    current.map((c) =>
                        c.id === id
                            ? {
                                  ...c,
                                  isStarred: originalIsStarred!,
                                  starredAt: originalStarredAt!,
                              }
                            : c
                    )
                );
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error({ error, connectionId: id }, "Failed to toggle star");
                setError(error);
            }
        });
    }, []); // Empty deps - uses functional updates and closures

    const handleUpdateConnectionTitle = useCallback(
        (id: string, title: string) => {
            // Capture original value for revert
            let originalTitle: string | null | undefined;

            // Optimistic update
            setConnections((prev) => {
                const connection = prev.find((c) => c.id === id);
                if (!connection) return prev;

                originalTitle = connection.title;

                return prev.map((c) => (c.id === id ? { ...c, title } : c));
            });

            // Also update displayTitle if this is the active connection
            if (id === activeConnectionId) {
                setDisplayTitle(title);
            }

            // Server action
            startTransition(async () => {
                if (originalTitle === undefined) return;

                try {
                    await updateConnectionAction(id, { title, titleEdited: true });
                    logger.debug(
                        { connectionId: id, title },
                        "Updated connection title (manual edit, evolution disabled)"
                    );
                } catch (err) {
                    // Revert on error
                    setConnections((current) =>
                        current.map((c) =>
                            c.id === id ? { ...c, title: originalTitle! } : c
                        )
                    );
                    if (id === activeConnectionId) {
                        setDisplayTitle(originalTitle);
                    }
                    const error = err instanceof Error ? err : new Error(String(err));
                    logger.error({ error, connectionId: id }, "Failed to update title");
                    setError(error);
                }
            });
        },
        [activeConnectionId]
    );

    // Computed: starred connections sorted by lastActivityAt
    const starredConnections = useMemo(
        () =>
            connections
                .filter((c) => c.isStarred)
                .sort(
                    (a, b) =>
                        new Date(b.lastActivityAt).getTime() -
                        new Date(a.lastActivityAt).getTime()
                ),
        [connections]
    );

    // Computed: unstarred connections sorted by lastActivityAt
    const unstarredConnections = useMemo(
        () =>
            connections
                .filter((c) => !c.isStarred)
                .sort(
                    (a, b) =>
                        new Date(b.lastActivityAt).getTime() -
                        new Date(a.lastActivityAt).getTime()
                ),
        [connections]
    );

    const value = useMemo<ConnectionContextValue>(
        () => ({
            connections,
            starredConnections,
            unstarredConnections,
            activeConnection,
            activeConnectionId,
            displayTitle: activeConnection?.title ?? displayTitle,
            freshConnectionIds,
            runningCount,
            isStreaming,

            isLoaded,
            isPending,
            error,
            initialMessages,
            initialConcierge,
            setActiveConnection: setActiveConnectionNav,
            createNewConnection: handleCreateNewConnection,
            archiveActiveConnection,
            deleteConnection: handleDeleteConnection,
            toggleStarConnection: handleToggleStarConnection,
            updateConnectionTitle: handleUpdateConnectionTitle,
            clearError,
            addNewConnection,
            setIsStreaming,
        }),
        [
            connections,
            starredConnections,
            unstarredConnections,
            activeConnection,
            activeConnectionId,
            displayTitle,
            freshConnectionIds,
            runningCount,
            isStreaming,

            isLoaded,
            isPending,
            error,
            initialMessages,
            initialConcierge,
            setActiveConnectionNav,
            handleCreateNewConnection,
            archiveActiveConnection,
            handleDeleteConnection,
            handleToggleStarConnection,
            handleUpdateConnectionTitle,
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
