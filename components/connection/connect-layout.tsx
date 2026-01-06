"use client";

/**
 * Connect Layout
 *
 * Full-page container for the connection/chat experience.
 * Intentionally excludes SiteHeader and Footer - this is a focused chat interface.
 *
 * Layout structure (unified glass container):
 * ┌─────────────────────────────────────────┐
 * │ ┌─────────────────────────────────────┐ │
 * │ │ Header (sticky inside container)   │ │
 * │ ├─────────────────────────────────────┤ │
 * │ │                                     │ │
 * │ │   Chat messages (scrollable)       │ │
 * │ │   + Breathing watermark behind     │ │
 * │ │                                     │ │
 * │ ├─────────────────────────────────────┤ │
 * │ │ Input dock (sticky inside)         │ │
 * │ └─────────────────────────────────────┘ │
 * │        Holographic background          │
 * └─────────────────────────────────────────┘
 *
 * The glass container creates visual separation from the holographic background.
 * Header, messages, and input ALL live inside this single container.
 */

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
    PlusIcon,
    CircleNotchIcon,
    FolderSimpleDashedIcon,
} from "@phosphor-icons/react";

import { ConnectionProvider, useConnection } from "./connection-context";
import { ConnectRuntimeProvider, useCodeMode } from "./connect-runtime-provider";
import { ConnectionChooser } from "./connection-chooser";
import { OracleMenu } from "@/components/ui/oracle-menu";
import { UserAuthButton } from "@/components/ui";
import { FileExplorer } from "@/components/code-mode";
import { SessionChangesPanel } from "@/components/tools/code/session-changes-panel";
import type {
    PublicConnection,
    PersistedConciergeData,
} from "@/lib/actions/connections";
import type { UIMessageLike } from "@/lib/db/message-mapping";

// ============================================================
// Entrance Animation Variants
// ============================================================

const containerEntranceVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1] as const,
        },
    },
};

const entranceVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: (delay: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            delay,
        },
    }),
};

// OracleMenu imported from @/components/ui - Carmenta's voice in the interface

// ============================================================
// Code Mode Indicator - Shows project name when in code mode
// ============================================================

function CodeModeIndicator() {
    const { isCodeMode, projectPath } = useCodeMode();

    if (!isCodeMode || !projectPath) return null;

    // Extract project name from path
    const projectName = projectPath.split("/").pop() || "Project";

    return (
        <motion.div
            className="flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            title={`Code mode: ${projectPath}`}
        >
            <FolderSimpleDashedIcon className="h-4 w-4" />
            <span className="max-w-[120px] truncate">{projectName}</span>
        </motion.div>
    );
}

// ============================================================
// Inner Layout (needs to be inside ConnectionProvider)
// ============================================================

function ConnectLayoutInner({ children }: { children: ReactNode }) {
    const { activeConnection, connections, createNewConnection, isPending } =
        useConnection();

    // Key changes on real navigation (when activeConnection changes)
    const connectionKey = activeConnection?.id ?? "new";

    // Show connection chooser when we have at least one conversation
    const hasConnections = connections.length > 0;

    return (
        <ConnectRuntimeProvider>
            <div className="flex h-full items-center justify-center p-2 sm:p-4">
                {/* ═══════════════════════════════════════════════════════════════
                    UNIFIED GLASS CONTAINER

                    This is THE container. Everything lives inside:
                    - Header (sticky at top)
                    - Messages (scrollable middle)
                    - Input dock (sticky at bottom)
                    - Breathing watermark (behind messages)

                    The glass effect creates visual separation from the
                    holographic background while maintaining the ethereal feel.
                ═══════════════════════════════════════════════════════════════ */}
                <motion.div
                    className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 shadow-2xl shadow-black/5 dark:border-white/10"
                    variants={containerEntranceVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* ═══════════════════════════════════════════════════════════
                        BREATHING WATERMARK

                        Carmenta's presence - centered behind all content.
                        Fixed position within the container, messages flow over it.
                    ═══════════════════════════════════════════════════════════ */}
                    <div
                        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
                        aria-hidden="true"
                    >
                        <div className="oracle-breathing">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/logos/icon-transparent.png"
                                alt=""
                                className="watermark-size object-contain opacity-[0.08] dark:opacity-[0.06]"
                            />
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════
                        HEADER - Sticky inside the glass container

                        Two rows on mobile, single row on desktop.
                        Uses subtle separator instead of heavy border.
                    ═══════════════════════════════════════════════════════════ */}
                    <header className="landscape-compact-header border-foreground/5 dark:bg-card/60 relative z-10 shrink-0 space-y-3 border-b bg-white/60 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-2xl sm:space-y-0 sm:px-5 sm:pt-4 sm:pb-4">
                        {/* Row 1: Oracle | (desktop: ConnectionChooser) | (mobile: New) | Avatar */}
                        <div className="flex items-center justify-between">
                            {/* Oracle menu - Carmenta's voice */}
                            <motion.div
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0}
                            >
                                <OracleMenu />
                            </motion.div>

                            {/* Desktop: Connection chooser in center */}
                            <motion.div
                                className="hidden flex-1 items-center justify-center gap-2 sm:flex"
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0.05}
                            >
                                {hasConnections && <ConnectionChooser />}
                                <CodeModeIndicator />
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
                                        className="bg-primary/15 text-primary hover:bg-primary/25 flex h-8 items-center gap-1.5 rounded-2xl px-3 text-sm font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="New connection"
                                    >
                                        {isPending ? (
                                            <CircleNotchIcon className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <PlusIcon className="h-4 w-4" />
                                        )}
                                        <span className="text-sm font-medium">
                                            New Connection
                                        </span>
                                    </button>
                                </motion.div>
                            )}

                            {/* Account - User dropdown menu
                                Dropdown uses portal to render at body level, escaping
                                all stacking context constraints from parent elements.
                            */}
                            <motion.div
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0.1}
                            >
                                <UserAuthButton />
                            </motion.div>
                        </div>

                        {/* Row 2 (Mobile only): Connection chooser + code mode */}
                        {hasConnections && (
                            <motion.div
                                className="flex w-full items-center gap-2 sm:hidden"
                                variants={entranceVariants}
                                initial="hidden"
                                animate="visible"
                                custom={0.1}
                            >
                                <div className="flex-1">
                                    <ConnectionChooser hideNewButton />
                                </div>
                                <CodeModeIndicator />
                            </motion.div>
                        )}
                    </header>

                    {/* ═══════════════════════════════════════════════════════════
                        CODE MODE PANELS

                        Collapsible panels for code-related features.
                        Only renders when in code mode with an active project.
                    ═══════════════════════════════════════════════════════════ */}
                    <FileExplorer />
                    <SessionChangesPanel className="mx-4 mb-3" />

                    {/* ═══════════════════════════════════════════════════════════
                        MAIN CONTENT AREA

                        Messages + Input dock. This is where HoloThread renders.
                        Takes remaining height, scrolls internally.
                        z-10 to render above the watermark.
                    ═══════════════════════════════════════════════════════════ */}
                    <main key={connectionKey} className="relative z-10 min-h-0 flex-1">
                        {children}
                    </main>
                </motion.div>
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
    /** Optional project path for code mode (used for new sessions before connection exists) */
    projectPath?: string | null;
}

export function ConnectLayout({
    children,
    initialConnections = [],
    activeConnection = null,
    initialMessages = [],
    initialConcierge = null,
    projectPath = null,
}: ConnectLayoutProps) {
    return (
        <ConnectionProvider
            initialConnections={initialConnections}
            activeConnection={activeConnection}
            initialMessages={initialMessages}
            initialConcierge={initialConcierge}
            projectPath={projectPath}
        >
            <ConnectLayoutInner>{children}</ConnectLayoutInner>
        </ConnectionProvider>
    );
}
