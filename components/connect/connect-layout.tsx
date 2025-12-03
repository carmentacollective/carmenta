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
 */

import type { ReactNode } from "react";
import { ConnectionProvider } from "./connection-context";
import { ConnectHeader } from "./connect-header";

interface ConnectLayoutProps {
    children: ReactNode;
}

export function ConnectLayout({ children }: ConnectLayoutProps) {
    return (
        <ConnectionProvider>
            <ConnectHeader />
            <main className="flex-1 overflow-hidden">{children}</main>
        </ConnectionProvider>
    );
}
