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
import { motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";

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
// Inner Layout (needs to be inside ConnectionProvider)
// ============================================================

function ConnectLayoutInner({ children }: { children: ReactNode }) {
    const { activeConnection, connections, createNewConnection, isPending } =
        useConnection();

    // Simple: key only changes on real navigation (when activeConnection changes)
    const connectionKey = activeConnection?.id ?? "new";

    // Show connection chooser when we have at least one conversation
    // Guard against undefined during SSR/hydration to prevent layout flash
    const hasConnections = connections.length > 0;

    return (
        <ConnectRuntimeProvider>
            <div className="flex h-full items-center justify-center p-0 sm:p-4">
                {/* ONE container for everything - header, chat, input - all same width */}
                <div className="relative flex h-full w-full max-w-4xl flex-col">
                    {/* Header - Two rows on mobile, single row on desktop */}
                    {/* Mobile: Row 1 = Oracle | New | Avatar, Row 2 = Connection chooser */}
                    {/* Desktop: Single row = Oracle | Connection chooser | Avatar */}
                    {/* Uses glass effect matching the input dock (rgba(255,255,255,0.7) + blur) */}
                    {/*
                        Header spacing uses 8px grid:
                        - Mobile: mx-3 (12px) + px-3 (12px) = 24px edge inset
                        - sm+: mx-4 (16px) + px-4 (16px) = 32px edge inset
                        Glass effect consistent at all sizes for visual continuity
                    */}
                    <header className="mx-3 mb-3 mt-[max(0.5rem,env(safe-area-inset-top))] space-y-3 rounded-3xl bg-white/70 px-4 py-3 backdrop-blur-xl dark:bg-card/70 sm:mx-4 sm:mb-4 sm:space-y-0 sm:px-5 sm:py-4">
                        {/* Row 1: Oracle | (desktop: ConnectionChooser) | (mobile: New) | Avatar */}
                        <div className="flex items-center justify-between">
                            {/* Oracle with whisper - Carmenta speaks */}
                            <motion.div
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0}
                            >
                                <CarmentaOracleWithWhisper />
                            </motion.div>

                            {/* Desktop: Connection chooser in center */}
                            <motion.div
                                className="hidden flex-1 justify-center sm:flex"
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0.05}
                            >
                                {hasConnections && <ConnectionChooser />}
                            </motion.div>

                            {/* Mobile: New button between Oracle and Avatar */}
                            {hasConnections && (
                                <motion.div
                                    className="sm:hidden"
                                    variants={entranceVariants}
                                    initial="hidden"
                                    animate="visible"
                                    custom={0.05}
                                >
                                    <button
                                        onClick={createNewConnection}
                                        disabled={isPending}
                                        className="flex h-8 items-center gap-1.5 rounded-full bg-primary/15 px-3 text-sm font-medium text-primary transition-all hover:bg-primary/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="New connection"
                                    >
                                        {isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                        <span className="text-sm font-medium">
                                            New Connection
                                        </span>
                                    </button>
                                </motion.div>
                            )}

                            {/* Account - User dropdown menu

                                ⚠️ CRITICAL Z-INDEX WARNING ⚠️

                                This motion.div creates a stacking context because Framer Motion
                                applies CSS transforms during animation. Without an explicit z-index,
                                this stacking context defaults to z-auto (effectively 0).

                                The <main> element below has z-base (0). Since main comes AFTER
                                header in DOM order, main wins when z-indices are equal - blocking
                                ALL clicks on the UserAuthButton dropdown menu.

                                z-dropdown (30) ensures the dropdown renders above main content.
                                DO NOT REMOVE THIS Z-INDEX or the dropdown will be unclickable.

                                Bug was caused by: Framer Motion transform + DOM order + equal z-index
                                See: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
                            */}
                            <motion.div
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0.1}
                                className="z-dropdown"
                            >
                                <UserAuthButton />
                            </motion.div>
                        </div>

                        {/* Row 2 (Mobile only): Connection chooser - same component, CSS-hidden on desktop */}
                        {hasConnections && (
                            <motion.div
                                className="w-full sm:hidden"
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0.1}
                            >
                                <ConnectionChooser hideNewButton />
                            </motion.div>
                        )}
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
