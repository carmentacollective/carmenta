"use client";

/**
 * Connect Layout
 *
 * Full-page container for the connection experience.
 * ONE div contains everything at the same width:
 * - Header row (Oracle | Connection Chooser | Account)
 * - Chat messages
 * - Chat input dock
 *
 * The container is transparent - just for layout/max-width containment.
 */

import { type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { ConnectionProvider, useConnection } from "./connection-context";
import { ConnectionChooser } from "./connection-chooser";
import { OptionalUserButton } from "./optional-user-button";
import type { PublicConnection } from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";

// ============================================================
// Oracle - Link to home
// ============================================================

function CarmentaOracle() {
    return (
        <Link href="/" className="group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-white/70 backdrop-blur-xl transition-all duration-200 group-hover:scale-105 group-hover:ring-primary/30 sm:h-12 sm:w-12">
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={28}
                    height={28}
                    className="sm:hidden"
                    style={{ width: 28, height: 28 }}
                />
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={32}
                    height={32}
                    className="hidden sm:block"
                    style={{ width: 32, height: 32 }}
                />
            </div>
        </Link>
    );
}

// ============================================================
// Inner Layout (needs to be inside ConnectionProvider)
// ============================================================

function ConnectLayoutInner({ children }: { children: ReactNode }) {
    const { activeConnection, connections } = useConnection();

    // Simple: key only changes on real navigation (when activeConnection changes)
    const connectionKey = activeConnection?.id ?? "new";

    // Hide connection chooser until we have at least one conversation
    const showConnectionChooser = connections.length > 0;

    return (
        <div className="flex h-full items-center justify-center p-0 sm:p-4">
            {/* ONE container for everything - header, chat, input - all same width */}
            <div className="relative flex h-full w-full max-w-4xl flex-col">
                {/* Header row - compact on mobile, spacious on desktop */}
                <header className="flex items-center justify-between px-2 py-2 sm:px-4 sm:py-3 md:px-12">
                    {/* Oracle - links to home */}
                    <CarmentaOracle />

                    {/* Center section - maintains spacing even when chooser is hidden */}
                    <div className="flex flex-1 items-center justify-center">
                        {showConnectionChooser && <ConnectionChooser />}
                    </div>

                    {/* Account */}
                    <OptionalUserButton />
                </header>

                {/* Chat (messages + input) fills the rest */}
                <main
                    key={connectionKey}
                    className="relative z-0 flex-1 overflow-hidden"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}

// ============================================================
// Main Export
// ============================================================

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
    return (
        <ConnectionProvider
            initialConnections={initialConnections}
            activeConnection={activeConnection}
            initialMessages={initialMessages}
        >
            <ConnectLayoutInner>{children}</ConnectLayoutInner>
        </ConnectionProvider>
    );
}
