"use client";

/**
 * Connect Layout
 *
 * Full-page container for the connection/chat experience.
 * Intentionally excludes SiteHeader and Footer - this is a focused chat interface.
 *
 * Layout structure:
 * - Header row: Oracle | Connection Chooser | Account
 * - Chat messages area
 * - Chat input dock
 *
 * The container is transparent - just for layout/max-width containment.
 * This specialized layout maximizes vertical space for conversation and provides
 * context-specific navigation (connections, recent chats) rather than global site nav.
 */

import { type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Home } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/use-mobile";

import { ConnectionProvider, useConnection } from "./connection-context";
import { ConnectRuntimeProvider } from "./connect-runtime-provider";
import { ConnectionChooser } from "./connection-chooser";
import { OracleWhisper } from "@/components/ui/oracle-whisper";
import { UserAuthButton } from "@/components/ui";
import type {
    PublicConnection,
    PersistedConciergeData,
} from "@/lib/actions/connections";
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
// Oracle with Whisper - Carmenta speaks to the user
// ============================================================

function CarmentaOracleWithWhisper() {
    return <OracleWhisper />;
}

// ============================================================
// Breadcrumb - Contextual navigation when viewing a connection
// ============================================================

function ConnectionBreadcrumb({ title }: { title: string }) {
    return (
        <motion.nav
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 text-xs text-foreground/40"
            aria-label="Breadcrumb"
        >
            <Link
                href="/connection"
                className="flex items-center gap-1 transition-colors hover:text-foreground/60"
            >
                <Home className="h-3 w-3" />
                <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="max-w-[150px] truncate text-foreground/60 sm:max-w-[200px]">
                {title}
            </span>
        </motion.nav>
    );
}

// ============================================================
// Inner Layout (needs to be inside ConnectionProvider)
// ============================================================

function ConnectLayoutInner({ children }: { children: ReactNode }) {
    const { activeConnection, connections, displayTitle } = useConnection();
    const isMobile = useIsMobile();

    // Simple: key only changes on real navigation (when activeConnection changes)
    const connectionKey = activeConnection?.id ?? "new";

    // Hide connection chooser until we have at least one conversation
    // On mobile, it's shown near the composer instead of in header
    // Guard against undefined during SSR/hydration to prevent layout flash
    const showConnectionChooser = connections.length > 0 && isMobile !== true;

    // Show breadcrumb when viewing a specific connection with a title
    const showBreadcrumb = activeConnection && displayTitle && !isMobile;

    return (
        <ConnectRuntimeProvider>
            <div className="flex h-full items-center justify-center p-0 sm:p-4">
                {/* ONE container for everything - header, chat, input - all same width */}
                <div className="relative flex h-full w-full max-w-4xl flex-col">
                    {/* Header row - compact on mobile, spacious on desktop, safe area for notched devices */}
                    {/* Mobile: tighter vertical padding to maximize chat space */}
                    <header className="flex items-center justify-between pb-1 pl-3 pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 md:px-12">
                        {/* Oracle with whisper - Carmenta speaks, plus breadcrumb when viewing connection */}
                        <motion.div
                            variants={entranceVariants}
                            initial="hidden"
                            animate="visible"
                            custom={0}
                            className="flex flex-col gap-1"
                        >
                            <CarmentaOracleWithWhisper />
                            <AnimatePresence>
                                {showBreadcrumb && (
                                    <ConnectionBreadcrumb title={displayTitle} />
                                )}
                            </AnimatePresence>
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
                        className="relative z-base flex-1 overflow-hidden"
                        variants={mainEntranceVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {children}
                    </motion.main>
                </div>
            </div>
        </ConnectRuntimeProvider>
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
    /** Initial concierge data for hydrating the display on page load */
    initialConcierge?: PersistedConciergeData | null;
}

export function ConnectLayout({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
    initialConcierge = null,
}: ConnectLayoutProps) {
    return (
        <ConnectionProvider
            initialConnections={initialConnections}
            activeConnection={activeConnection}
            initialMessages={initialMessages}
            initialConcierge={initialConcierge}
        >
            <ConnectLayoutInner>{children}</ConnectLayoutInner>
        </ConnectionProvider>
    );
}
