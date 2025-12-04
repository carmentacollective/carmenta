"use client";

/**
 * Connect Layout
 *
 * Client-side wrapper that provides the ConnectionContext to both
 * the header and the chat interface. This enables:
 * - Header to display current connection and switch connections
 * - Chat to load the correct conversation content
 *
 * The ConnectionProvider wraps both components so they share state.
 * Initial data is passed from the server component for SSR.
 *
 * Key Architecture Decision:
 * - The main content uses a `key` prop based on connection ID
 * - This forces the Chat/Runtime to remount when switching connections
 * - Ensures clean state reset without stale messages or streaming state
 */

import type { ReactNode } from "react";
import { ConnectionProvider } from "./connection-context";
import { ConnectHeader } from "./connect-header";
import type { PublicConnection } from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";

interface ConnectLayoutProps {
    children: ReactNode;
    /** Initial connections from server (recent list) */
    initialConnections?: PublicConnection[];
    /** The currently active connection (from [id] param) */
    activeConnection?: PublicConnection | null;
    /** Initial messages for the active connection */
    initialMessages?: UIMessageLike[];
}

export function ConnectLayout({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
}: ConnectLayoutProps) {
    // Use connection ID as key to force remount when switching connections
    // "new" is used for /connection/new route where no connection exists yet
    const connectionKey = activeConnection?.id ?? "new";

    return (
        <ConnectionProvider
            initialConnections={initialConnections}
            activeConnection={activeConnection}
            initialMessages={initialMessages}
        >
            <ConnectHeader />
            <main key={connectionKey} className="relative z-0 flex-1 overflow-hidden">
                {children}
            </main>
        </ConnectionProvider>
    );
}
