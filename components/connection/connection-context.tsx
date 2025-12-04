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
    type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

import {
    createNewConnection,
    archiveConnection,
    deleteConnection as deleteConnectionAction,
} from "@/lib/actions/connections";
import type { Connection } from "@/lib/db/schema";
import type { UIMessageLike } from "@/lib/db/message-mapping";
import { logger } from "@/lib/client-logger";

interface ConnectionContextValue {
    /** All available connections (recent) */
    connections: Connection[];
    /** Currently active connection (from DB) */
    activeConnection: Connection | null;
    /** ID of the currently active connection */
    activeConnectionId: string | null;
    /** Number of connections with background streaming */
    runningCount: number;
    /** Whether the context has been initialized with data */
    isLoaded: boolean;
    /** Whether a transition (create/delete) is in progress */
    isPending: boolean;
    /** Initial messages for the active connection */
    initialMessages: UIMessageLike[];
    /** Switch to a different connection (navigates to URL) */
    setActiveConnection: (id: string) => void;
    /** Create a new connection and navigate to it */
    createNewConnection: () => void;
    /** Archive the active connection */
    archiveActiveConnection: () => void;
    /** Delete a connection */
    deleteConnection: (id: string) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

interface ConnectionProviderProps {
    children: ReactNode;
    /** Initial connections from server (recent list) */
    initialConnections?: Connection[];
    /** The currently active connection (from [id] param) */
    activeConnection?: Connection | null;
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
    const [connections, setConnections] = useState<Connection[]>(initialConnections);

    // Derive active connection ID from the prop
    const activeConnectionId = activeConnection?.id ?? null;

    // Count connections with streaming status (running in background)
    const runningCount = useMemo(
        () => connections.filter((c) => c.streamingStatus === "streaming").length,
        [connections]
    );

    const isLoaded = initialConnections.length > 0 || activeConnection !== null;

    const setActiveConnection = useCallback(
        (id: string) => {
            router.push(`/connection/${id}`);
        },
        [router]
    );

    const handleCreateNewConnection = useCallback(() => {
        startTransition(async () => {
            try {
                const connectionId = await createNewConnection();
                logger.debug({ connectionId }, "Created new connection");
                router.push(`/connection/${connectionId}`);
            } catch (error) {
                logger.error({ error }, "Failed to create connection");
            }
        });
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
            } catch (error) {
                logger.error(
                    { error, connectionId: activeConnectionId },
                    "Failed to archive connection"
                );
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
                } catch (error) {
                    logger.error(
                        { error, connectionId: id },
                        "Failed to delete connection"
                    );
                }
            });
        },
        [activeConnectionId, router]
    );

    const value = useMemo<ConnectionContextValue>(
        () => ({
            connections,
            activeConnection,
            activeConnectionId,
            runningCount,
            isLoaded,
            isPending,
            initialMessages,
            setActiveConnection,
            createNewConnection: handleCreateNewConnection,
            archiveActiveConnection,
            deleteConnection: handleDeleteConnection,
        }),
        [
            connections,
            activeConnection,
            activeConnectionId,
            runningCount,
            isLoaded,
            isPending,
            initialMessages,
            setActiveConnection,
            handleCreateNewConnection,
            archiveActiveConnection,
            handleDeleteConnection,
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
