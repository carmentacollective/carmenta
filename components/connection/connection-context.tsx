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
    type PublicConnection,
} from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";

interface ConnectionContextValue {
    connections: PublicConnection[];
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
    setActiveConnection: (slug: string) => void;
    createNewConnection: () => void;
    archiveActiveConnection: () => void;
    deleteConnection: (id: string) => void;
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
}

export function ConnectionProvider({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
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
        (slug: string) => {
            // Clear display title on navigation - server will provide the real one
            setDisplayTitle(null);
            router.push(`/connection/${slug}`);
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

    const value = useMemo<ConnectionContextValue>(
        () => ({
            connections,
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
            setActiveConnection: setActiveConnectionNav,
            createNewConnection: handleCreateNewConnection,
            archiveActiveConnection,
            deleteConnection: handleDeleteConnection,
            clearError,
            addNewConnection,
            setIsStreaming,
        }),
        [
            connections,
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
            setActiveConnectionNav,
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
