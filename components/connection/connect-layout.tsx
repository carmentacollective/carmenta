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
import { motion } from "framer-motion";

import { ConnectionProvider, useConnection } from "./connection-context";
import { ConnectionChooser } from "./connection-chooser";
import { Oracle } from "@/components/ui/oracle";
import { UserAuthButton } from "@/components/ui";
import type { PublicConnection } from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";

// ============================================================
// Entrance Animation Variants
// ============================================================

const entranceVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: (delay: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            delay,
        },
    }),
};

const mainEntranceVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.6,
            delay: 0.2,
        },
    },
};

// ============================================================
// Oracle - Link to home, state-aware
// ============================================================

function CarmentaOracle() {
    const { isConciergeRunning } = useConnection();

    return (
        <Oracle
            href="/"
            size="sm"
            state={isConciergeRunning ? "working" : "breathing"}
        />
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
                {/* Header row - compact on mobile, spacious on desktop, safe area for notched devices */}
                <header className="flex items-center justify-between px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 md:px-12">
                    {/* Oracle - links to home */}
                    <motion.div
                        variants={entranceVariants}
                        initial="hidden"
                        animate="visible"
                        custom={0}
                    >
                        <CarmentaOracle />
                    </motion.div>

                    {/* Center section - maintains spacing even when chooser is hidden */}
                    <motion.div
                        className="flex flex-1 items-center justify-center"
                        variants={entranceVariants}
                        initial="hidden"
                        animate="visible"
                        custom={0.05}
                    >
                        {showConnectionChooser && <ConnectionChooser />}
                    </motion.div>

                    {/* Account */}
                    <motion.div
                        variants={entranceVariants}
                        initial="hidden"
                        animate="visible"
                        custom={0.1}
                    >
                        <UserAuthButton />
                    </motion.div>
                </header>

                {/* Chat (messages + input) fills the rest */}
                <motion.main
                    key={connectionKey}
                    className="relative z-0 flex-1 overflow-hidden"
                    variants={mainEntranceVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {children}
                </motion.main>
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
