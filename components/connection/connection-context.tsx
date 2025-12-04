"use client";

/**
 * Connection Context
 *
 * Manages the active connection state shared between
 * the header navigation and the chat interface.
 *
 * Architecture decision: Using React Context here because:
 * 1. State is needed by sibling components (header and chat)
 * 2. State changes infrequently (only on connection switch)
 * 3. Keeps the page component clean - just wraps with provider
 *
 * TODO: When we add connection persistence, this context will
 * interface with the database layer to load/save connections.
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { MOCK_CONNECTIONS, type Connection } from "./mock-connections";

interface ConnectionContextValue {
    /** All available connections */
    connections: Connection[];
    /** Currently active connection */
    activeConnection: Connection | undefined;
    /** ID of the currently active connection */
    activeConnectionId: string;
    /** Number of connections currently running */
    runningCount: number;
    /** Switch to a different connection */
    setActiveConnection: (id: string) => void;
    /** Create a new connection (placeholder for now) */
    createNewConnection: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const [connections] = useState<Connection[]>(MOCK_CONNECTIONS);
    const [activeConnectionId, setActiveConnectionId] = useState<string>(
        MOCK_CONNECTIONS[0].id
    );

    const activeConnection = connections.find((c) => c.id === activeConnectionId);
    const runningCount = connections.filter((c) => c.isRunning).length;

    const setActiveConnection = useCallback((id: string) => {
        setActiveConnectionId(id);
        // TODO: Trigger chat content reload when we have persistence
    }, []);

    const createNewConnection = useCallback(() => {
        // TODO: Create new connection in database, add to list, switch to it
        // For now, just log

        console.log("Creating new connection...");
    }, []);

    return (
        <ConnectionContext.Provider
            value={{
                connections,
                activeConnection,
                activeConnectionId,
                runningCount,
                setActiveConnection,
                createNewConnection,
            }}
        >
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
