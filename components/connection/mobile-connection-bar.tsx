"use client";

/**
 * Mobile Connection Bar
 *
 * Layered bottom navigation for mobile devices.
 * Design: Option 4 from Iteration 2 - Title strip with inline New button.
 *
 * Layout: [Title ▼] [+]
 * - Title strip expands to show recent connections + search
 * - + button creates new connection (always visible)
 * - Keeps navigation in thumb zone
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Clock, MessageSquare, ChevronDown, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { useConnection } from "./connection-context";
import type { PublicConnection } from "@/lib/actions/connections";

/** Formats a date as relative time */
function getRelativeTime(date: Date | null): string {
    if (!date) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** A single connection row in the dropdown */
function ConnectionRow({
    conn,
    isActive,
    onSelect,
}: {
    conn: PublicConnection;
    isActive: boolean;
    onSelect: (slug: string) => void;
}) {
    const title = conn.title || "Untitled";

    return (
        <button
            onClick={() => onSelect(conn.slug)}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-foreground/70 hover:bg-foreground/5"
            )}
        >
            {conn.isStarred ? (
                <Star className="h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" />
            ) : (
                <Clock className="h-4 w-4 flex-shrink-0 text-foreground/40" />
            )}
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{title}</div>
                <div className="text-xs text-foreground/40">
                    {getRelativeTime(conn.lastActivityAt)}
                </div>
            </div>
            {isActive && (
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            )}
        </button>
    );
}

export function MobileConnectionBar() {
    const router = useRouter();
    const { activeConnection, connections, createNewConnection } = useConnection();
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Get current title for display
    const currentTitle = activeConnection?.title || "New connection";

    // Filter connections by search
    const filteredConnections = connections.filter((conn) => {
        if (!searchQuery.trim()) return true;
        const title = conn.title || "Untitled";
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Separate starred and recent
    const starredConnections = filteredConnections.filter((c) => c.isStarred);
    const recentConnections = filteredConnections.filter((c) => !c.isStarred);

    const handleSelect = useCallback(
        (slug: string) => {
            setIsExpanded(false);
            setSearchQuery("");
            router.push(`/connection/${slug}`);
        },
        [router]
    );

    const handleNewConnection = useCallback(() => {
        setIsExpanded(false);
        setSearchQuery("");
        createNewConnection();
    }, [createNewConnection]);

    // Don't render if no connections yet (fresh user)
    if (connections.length === 0 && !activeConnection?.title) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Title strip row: [Title ▼] [+] */}
            <div className="flex items-center gap-2">
                {/* Title strip - expandable */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 transition-colors",
                        isExpanded
                            ? "bg-foreground/10"
                            : "bg-foreground/5 active:bg-foreground/10"
                    )}
                >
                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-foreground/40" />
                    <span className="flex-1 truncate text-left text-sm font-medium text-foreground/80">
                        {currentTitle}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 flex-shrink-0 text-foreground/40 transition-transform duration-200",
                            isExpanded && "rotate-180"
                        )}
                    />
                </button>

                {/* New connection button - always visible */}
                <button
                    onClick={handleNewConnection}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary transition-colors active:bg-primary/30"
                    aria-label="New connection"
                >
                    <Plus className="h-5 w-5" />
                </button>
            </div>

            {/* Expandable connection list */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-xl bg-foreground/5 p-2">
                            {/* Search input */}
                            <div className="mb-2 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2">
                                <Search className="h-4 w-4 text-foreground/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search connections..."
                                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
                                    autoFocus
                                />
                            </div>

                            {/* Starred connections */}
                            {starredConnections.length > 0 && (
                                <div className="mb-2">
                                    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground/40">
                                        Starred
                                    </div>
                                    {starredConnections.map((conn) => (
                                        <ConnectionRow
                                            key={conn.id}
                                            conn={conn}
                                            isActive={conn.id === activeConnection?.id}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Recent connections */}
                            {recentConnections.length > 0 && (
                                <div>
                                    {starredConnections.length > 0 && (
                                        <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground/40">
                                            Recent
                                        </div>
                                    )}
                                    {recentConnections.slice(0, 5).map((conn) => (
                                        <ConnectionRow
                                            key={conn.id}
                                            conn={conn}
                                            isActive={conn.id === activeConnection?.id}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Empty state */}
                            {filteredConnections.length === 0 && searchQuery && (
                                <div className="py-4 text-center text-sm text-foreground/40">
                                    No connections found
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
