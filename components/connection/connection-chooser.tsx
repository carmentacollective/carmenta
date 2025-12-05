"use client";

/**
 * Connection Chooser
 *
 * Glass pill for switching between connections.
 * Shows search, title, and new button. Dropdown lists recent connections.
 *
 * Features:
 * - Debounced search filter (300ms) for performance
 * - Keyboard navigation (ESC to close)
 * - Animated transitions for smooth UX
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, X, Clock, Loader2, Sparkles, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useConnection } from "./connection-context";

/** Debounce hook for search performance */
function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

/** Formats a date as relative time (e.g., "2h ago", "Yesterday") */
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

/** Animated indicator for running connections */
function RunningIndicator() {
    return (
        <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
        </div>
    );
}

/** Animated title with smooth fade-in */
function AnimatedTitle({ title }: { title: string }) {
    return (
        <motion.span
            key={title}
            className="truncate text-sm text-foreground/70"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            {title}
        </motion.span>
    );
}

export function ConnectionChooser() {
    const {
        connections,
        activeConnection,
        freshConnectionIds,
        isStreaming,
        setActiveConnection,
        createNewConnection,
        deleteConnection,
        isPending,
    } = useConnection();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 300);
    const inputRef = useRef<HTMLInputElement>(null);

    const closeSearch = useCallback(() => {
        setIsSearchOpen(false);
        setQuery("");
    }, []);

    const openSearch = useCallback(() => setIsSearchOpen(true), []);

    const handleSelect = useCallback(
        (slug: string) => {
            setActiveConnection(slug);
            closeSearch();
        },
        [setActiveConnection, closeSearch]
    );

    const handleDelete = useCallback(
        (e: React.MouseEvent, connectionId: string) => {
            e.stopPropagation(); // Prevent selecting the connection
            deleteConnection(connectionId);
        },
        [deleteConnection]
    );

    // Focus input when search opens
    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchOpen]);

    // Handle ESC key to close search
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSearchOpen) {
                closeSearch();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isSearchOpen, closeSearch]);

    // Filter connections based on debounced search query
    const filtered = useMemo(() => {
        if (!debouncedQuery.trim()) {
            return connections.slice(0, 6);
        }
        const lowerQuery = debouncedQuery.toLowerCase();
        return connections.filter(
            (c) =>
                c.title?.toLowerCase().includes(lowerQuery) ||
                c.id.toLowerCase().includes(lowerQuery)
        );
    }, [connections, debouncedQuery]);

    const displayTitle = activeConnection?.title || "";

    return (
        <div className="relative">
            <motion.div
                layout
                className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2",
                    "bg-white/60 ring-1 ring-foreground/15 backdrop-blur-xl",
                    "hover:bg-white/70 hover:ring-foreground/20",
                    "transition-colors duration-200"
                )}
            >
                {/* Search button - only shows after first connection */}
                {connections.length > 0 && (
                    <button
                        onClick={openSearch}
                        className="text-foreground/40 transition-colors hover:text-foreground/60"
                        title="Search connections"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                )}

                {/* Title section - only shows when there's a title */}
                <AnimatePresence mode="popLayout">
                    {displayTitle && (
                        <motion.div
                            key="title-section"
                            className="flex items-center gap-3 overflow-hidden"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "auto", opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{
                                width: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 },
                            }}
                        >
                            {connections.length > 0 && (
                                <div className="h-4 w-px bg-foreground/10" />
                            )}

                            {connections.length > 0 ? (
                                <button
                                    onClick={openSearch}
                                    className="flex items-center gap-2 whitespace-nowrap"
                                >
                                    {isStreaming && <RunningIndicator />}
                                    <AnimatedTitle title={displayTitle} />
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    {isStreaming && <RunningIndicator />}
                                    <AnimatedTitle title={displayTitle} />
                                </div>
                            )}

                            <div className="h-4 w-px bg-foreground/10" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* New connection button */}
                <button
                    onClick={createNewConnection}
                    disabled={isPending}
                    className={cn(
                        "flex items-center gap-1.5 text-sm transition-all",
                        "text-foreground/50 hover:text-foreground/80",
                        "disabled:opacity-50"
                    )}
                    title="New connection"
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                    <span className="hidden font-medium sm:inline">New</span>
                </button>
            </motion.div>

            {/* Search dropdown */}
            <AnimatePresence>
                {isSearchOpen && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-40"
                            onClick={closeSearch}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        />
                        <motion.div
                            className="absolute left-1/2 top-full z-50 mt-2 w-full max-w-[500px] -translate-x-1/2"
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            <div className="overflow-hidden rounded-2xl bg-white/80 shadow-2xl ring-1 ring-foreground/20 backdrop-blur-xl">
                                <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
                                    <Search className="h-5 w-5 text-foreground/40" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search connections..."
                                        className="flex-1 bg-transparent text-base text-foreground/90 outline-none placeholder:text-foreground/40"
                                    />
                                    <button
                                        onClick={closeSearch}
                                        className="rounded-full p-1 transition-colors hover:bg-foreground/5"
                                        title="Close"
                                        aria-label="Close search"
                                    >
                                        <X className="h-4 w-4 text-foreground/40" />
                                    </button>
                                </div>

                                <div className="max-h-80 overflow-y-auto">
                                    <div className="flex items-center gap-2 bg-foreground/5 px-4 py-2">
                                        <Clock className="h-3.5 w-3.5 text-foreground/40" />
                                        <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                            {debouncedQuery ? "Results" : "Recent"}
                                        </span>
                                    </div>
                                    {filtered.length > 0 ? (
                                        <div className="py-2">
                                            {filtered.map((conn, index) => {
                                                const isFresh = freshConnectionIds.has(
                                                    conn.id
                                                );
                                                return (
                                                    <div
                                                        key={conn.id}
                                                        className={cn(
                                                            "group flex items-start gap-3 px-4 py-2.5 transition-all hover:bg-foreground/5",
                                                            conn.id ===
                                                                activeConnection?.id &&
                                                                "bg-primary/5",
                                                            "animate-in fade-in slide-in-from-left-2",
                                                            isFresh &&
                                                                "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
                                                        )}
                                                        style={{
                                                            animationDelay: `${index * 30}ms`,
                                                            animationFillMode:
                                                                "backwards",
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                handleSelect(conn.slug)
                                                            }
                                                            className="flex flex-1 items-start gap-3 text-left"
                                                        >
                                                            <div className="mt-0.5">
                                                                {conn.streamingStatus ===
                                                                "streaming" ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                ) : isFresh ? (
                                                                    <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                                                                ) : (
                                                                    <Sparkles className="h-4 w-4 text-foreground/40" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className={cn(
                                                                            "truncate text-sm font-medium",
                                                                            isFresh
                                                                                ? "text-foreground/90"
                                                                                : "text-foreground/80"
                                                                        )}
                                                                    >
                                                                        {conn.title ||
                                                                            "New connection"}
                                                                    </span>
                                                                    {isFresh && (
                                                                        <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                                                            new
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-foreground/30">
                                                                    {isFresh
                                                                        ? "Just now"
                                                                        : getRelativeTime(
                                                                              conn.lastActivityAt
                                                                          )}
                                                                </span>
                                                            </div>
                                                        </button>
                                                        {/* Delete button - appears on hover */}
                                                        <button
                                                            onClick={(e) =>
                                                                handleDelete(e, conn.id)
                                                            }
                                                            className="mt-0.5 rounded-md p-1 opacity-0 transition-opacity hover:bg-red-100 group-hover:opacity-100"
                                                            title={`Delete ${conn.title || "connection"}`}
                                                            aria-label={`Delete ${conn.title || "connection"}`}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-foreground/50">
                                            {connections.length === 0
                                                ? "We haven't started any connections yet"
                                                : "We couldn't find any matching connections"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
