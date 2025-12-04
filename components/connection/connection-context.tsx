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
    type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

import {
    createNewConnection,
    archiveConnection,
    deleteConnection as deleteConnectionAction,
    getConnectionMetadata,
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
    refreshConnectionMetadata: () => Promise<boolean | undefined>;
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

    // Error state - surfaces operation failures to the UI
    const [error, setError] = useState<Error | null>(null);

    const clearError = useCallback(() => setError(null), []);

    // Derive active connection ID from the prop
    const activeConnectionId = activeConnection?.id ?? null;

    // Count connections with streaming status (running in background)
    const runningCount = useMemo(
        () => connections.filter((c) => c.streamingStatus === "streaming").length,
        [connections]
    );

    const isLoaded = initialConnections.length > 0 || activeConnection !== null;

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

    const handleCreateNewConnection = useCallback(() => {
        startTransition(async () => {
            try {
                const { slug } = await createNewConnection();
                logger.debug({ slug }, "Created new connection");
                router.push(`/connection/${slug}`);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error({ error }, "Failed to create connection");
                setError(error);
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
     */
    const refreshConnectionMetadata = useCallback(async () => {
        if (!activeConnectionId) return;

        try {
            const metadata = await getConnectionMetadata(activeConnectionId);
            if (!metadata) return;

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
     * Poll for title updates on new connections.
     * When a connection has no title, poll every 3 seconds until we get one.
     * This handles the case where title is generated after streaming completes.
     */
    useEffect(() => {
        // Only poll if we have an active connection without a title
        if (!activeConnectionId || activeConnection?.title) {
            return;
        }

        // Start polling after a short delay (give time for first message)
        const pollInterval = setInterval(async () => {
            const updated = await refreshConnectionMetadata();
            if (updated) {
                clearInterval(pollInterval);
            }
        }, 3000);

        // Stop polling after 30 seconds max
        const timeout = setTimeout(() => {
            clearInterval(pollInterval);
        }, 30000);

        return () => {
            clearInterval(pollInterval);
            clearTimeout(timeout);
        };
    }, [activeConnectionId, activeConnection?.title, refreshConnectionMetadata]);

    const value = useMemo<ConnectionContextValue>(
        () => ({
            connections,
            activeConnection,
            activeConnectionId,
            runningCount,
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
        }),
        [
            connections,
            activeConnection,
            activeConnectionId,
            runningCount,
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
