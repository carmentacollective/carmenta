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
 */

import type { ReactNode } from "react";
import { ConnectionProvider } from "./connection-context";
import { ConnectHeader } from "./connect-header";
import type { Connection } from "@/lib/db/schema";
import type { UIMessageLike } from "@/lib/db/message-mapping";

interface ConnectLayoutProps {
    children: ReactNode;
    /** Initial connections from server (recent list) */
    initialConnections?: Connection[];
    /** The currently active connection (from [id] param) */
    activeConnection?: Connection | null;
    /** Initial messages for the active connection */
    initialMessages?: UIMessageLike[];
}

export function ConnectLayout({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
}: ConnectLayoutProps) {
    return (
        <ConnectionProvider
            initialConnections={initialConnections}
            activeConnection={activeConnection}
            initialMessages={initialMessages}
        >
            <ConnectHeader />
            <main className="relative z-0 flex-1 overflow-hidden">{children}</main>
        </ConnectionProvider>
    );
}
