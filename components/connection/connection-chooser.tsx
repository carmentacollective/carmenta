"use client";

/**
 * Connection Chooser
 *
 * Contextual navigation that grows with user's history.
 *
 * States:
 * - S1: Fresh user (no connections) → renders nothing
 * - S2/S3/S4: Untitled connection → minimal "Recent Connections..." trigger
 * - S5: Titled connection → full [Search | Title | New] pill
 *
 * The component gracefully expands when a title arrives,
 * creating a moment of delight as the conversation gets named.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, X, Clock, Trash2, Loader2, ChevronDown } from "lucide-react";
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

/** Animated indicator for streaming/running connections */
function RunningIndicator() {
    return (
        <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
    );
}

/** Shared dropdown for both minimal and full states */
function ConnectionDropdown({
    isOpen,
    onClose,
    connections,
    activeConnection,
    freshConnectionIds,
    onSelect,
    onDelete,
    query,
    setQuery,
    debouncedQuery,
    inputRef,
}: {
    isOpen: boolean;
    onClose: () => void;
    connections: ReturnType<typeof useConnection>["connections"];
    activeConnection: ReturnType<typeof useConnection>["activeConnection"];
    freshConnectionIds: Set<string>;
    onSelect: (slug: string) => void;
    onDelete: (id: string) => void;
    query: string;
    setQuery: (q: string) => void;
    debouncedQuery: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
}) {
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const handleDeleteClick = useCallback(
        (e: React.MouseEvent, connectionId: string) => {
            e.stopPropagation();
            setPendingDeleteId(connectionId);
        },
        []
    );

    const confirmDelete = useCallback(
        (e: React.MouseEvent, connectionId: string) => {
            e.stopPropagation();
            onDelete(connectionId);
            setPendingDeleteId(null);
        },
        [onDelete]
    );

    const cancelDelete = useCallback(() => {
        setPendingDeleteId(null);
    }, []);

    // Wrap onClose to also clear pending delete state
    const handleClose = useCallback(() => {
        setPendingDeleteId(null);
        onClose();
    }, [onClose]);

    // Handle ESC to cancel delete or close
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (pendingDeleteId) {
                    cancelDelete();
                } else {
                    handleClose();
                }
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, handleClose, pendingDeleteId, cancelDelete]);

    // Filter connections based on search
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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-40"
                        onClick={handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    />

                    {/* Dropdown panel */}
                    <motion.div
                        className="fixed inset-x-0 top-24 z-50 mx-auto w-[calc(100vw-2rem)] sm:w-[420px]"
                        initial={{ opacity: 0, y: -12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="overflow-hidden rounded-2xl bg-white/90 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-xl">
                            {/* Search header */}
                            <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
                                <Search className="h-5 w-5 text-foreground/40" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search..."
                                    className="flex-1 bg-transparent text-base text-foreground/90 outline-none placeholder:text-foreground/40"
                                />
                                <button
                                    onClick={handleClose}
                                    className="rounded-full p-1 transition-colors hover:bg-foreground/5"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4 text-foreground/40" />
                                </button>
                            </div>

                            {/* Connection list */}
                            <div className="max-h-[50vh] overflow-y-auto">
                                <div className="flex items-center gap-2 bg-foreground/[0.03] px-4 py-2">
                                    <Clock className="h-3.5 w-3.5 text-foreground/40" />
                                    <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                        {debouncedQuery ? "Results" : "Recent"}
                                    </span>
                                </div>

                                {filtered.length > 0 ? (
                                    <div className="py-1">
                                        {filtered.map((conn, index) => {
                                            const isFresh = freshConnectionIds.has(
                                                conn.id
                                            );
                                            const isPendingDelete =
                                                pendingDeleteId === conn.id;
                                            const isActive =
                                                conn.id === activeConnection?.id;

                                            // Delete confirmation state
                                            if (isPendingDelete) {
                                                return (
                                                    <motion.div
                                                        key={conn.id}
                                                        className="flex items-center justify-between bg-red-50 px-4 py-3"
                                                        initial={{
                                                            backgroundColor:
                                                                "transparent",
                                                        }}
                                                        animate={{
                                                            backgroundColor:
                                                                "rgb(254 242 242)",
                                                        }}
                                                        transition={{ duration: 0.15 }}
                                                    >
                                                        <span className="text-sm text-red-700">
                                                            Delete &ldquo;
                                                            {conn.title ||
                                                                "this connection"}
                                                            &rdquo;?
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    cancelDelete();
                                                                }}
                                                                className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/60 transition-colors hover:bg-white/60"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={(e) =>
                                                                    confirmDelete(
                                                                        e,
                                                                        conn.id
                                                                    )
                                                                }
                                                                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                );
                                            }

                                            return (
                                                <motion.div
                                                    key={conn.id}
                                                    className={cn(
                                                        "group flex items-center gap-3 px-4 py-2.5 transition-colors",
                                                        isActive && "bg-primary/5",
                                                        isFresh &&
                                                            "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
                                                    )}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{
                                                        duration: 0.2,
                                                        delay: index * 0.03,
                                                        ease: "easeOut",
                                                    }}
                                                >
                                                    <button
                                                        onClick={() =>
                                                            onSelect(conn.slug)
                                                        }
                                                        className="flex flex-1 items-center gap-3 text-left transition-colors hover:text-foreground"
                                                    >
                                                        <span
                                                            className={cn(
                                                                "min-w-0 flex-1 truncate text-sm font-medium",
                                                                isActive
                                                                    ? "text-foreground"
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
                                                        <span className="shrink-0 text-xs text-foreground/40">
                                                            {isFresh
                                                                ? "Just now"
                                                                : getRelativeTime(
                                                                      conn.lastActivityAt
                                                                  )}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={(e) =>
                                                            handleDeleteClick(
                                                                e,
                                                                conn.id
                                                            )
                                                        }
                                                        className="rounded-md p-1.5 opacity-0 transition-all hover:bg-red-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-300 group-hover:opacity-100"
                                                        title={`Delete ${conn.title || "connection"}`}
                                                        aria-label={`Delete ${conn.title || "connection"}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-foreground/30 transition-colors hover:text-red-500" />
                                                    </button>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-sm text-foreground/50">
                                        {connections.length === 0
                                            ? "We haven't started any connections yet"
                                            : "No matching connections found"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
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

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 300);
    const inputRef = useRef<HTMLInputElement>(null);

    const openDropdown = useCallback(() => setIsDropdownOpen(true), []);
    const closeDropdown = useCallback(() => {
        setIsDropdownOpen(false);
        setQuery("");
    }, []);

    const handleSelect = useCallback(
        (slug: string) => {
            setActiveConnection(slug);
            closeDropdown();
        },
        [setActiveConnection, closeDropdown]
    );

    // Focus input when dropdown opens
    useEffect(() => {
        if (isDropdownOpen && inputRef.current) {
            // Small delay to ensure animation has started
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [isDropdownOpen]);

    // Derive state
    const hasConnections = connections.length > 0;
    const hasTitle = Boolean(activeConnection?.title);
    const title = activeConnection?.title ?? "";

    // S1: Fresh user - no connections at all
    if (!hasConnections) {
        return null;
    }

    // S2/S3/S4: Has connections but current one is untitled
    // Show minimal "Recent Connections..." trigger
    if (!hasTitle) {
        return (
            <div className="relative">
                <motion.button
                    onClick={openDropdown}
                    className={cn(
                        "flex items-center gap-2 rounded-xl px-4 py-2",
                        "bg-white/60 ring-1 ring-foreground/15 backdrop-blur-xl",
                        "text-sm text-foreground/60",
                        "hover:bg-white/70 hover:text-foreground/80 hover:ring-foreground/20",
                        "transition-all duration-200"
                    )}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                >
                    {isStreaming && <RunningIndicator />}
                    <span>Recent Connections</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </motion.button>

                <ConnectionDropdown
                    isOpen={isDropdownOpen}
                    onClose={closeDropdown}
                    connections={connections}
                    activeConnection={activeConnection}
                    freshConnectionIds={freshConnectionIds}
                    onSelect={handleSelect}
                    onDelete={deleteConnection}
                    query={query}
                    setQuery={setQuery}
                    debouncedQuery={debouncedQuery}
                    inputRef={inputRef}
                />
            </div>
        );
    }

    // S5: Has a titled connection - show full layout
    return (
        <div className="relative">
            <motion.div
                layout
                className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2",
                    "bg-white/60 ring-1 ring-foreground/15 backdrop-blur-xl",
                    "transition-colors duration-200"
                )}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* Search button */}
                <button
                    onClick={openDropdown}
                    className="text-foreground/40 transition-colors hover:text-foreground/60"
                    title="Search connections"
                >
                    <Search className="h-4 w-4" />
                </button>

                {/* Divider */}
                <div className="h-4 w-px bg-foreground/10" />

                {/* Title - clickable to open dropdown */}
                <button
                    onClick={openDropdown}
                    className="flex items-center gap-2 transition-colors hover:text-foreground/80"
                >
                    {isStreaming && <RunningIndicator />}
                    <motion.span
                        key={title}
                        className="text-sm text-foreground/70"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        {title}
                    </motion.span>
                </button>

                {/* Divider */}
                <div className="h-4 w-px bg-foreground/10" />

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

            <ConnectionDropdown
                isOpen={isDropdownOpen}
                onClose={closeDropdown}
                connections={connections}
                activeConnection={activeConnection}
                freshConnectionIds={freshConnectionIds}
                onSelect={handleSelect}
                onDelete={deleteConnection}
                query={query}
                setQuery={setQuery}
                debouncedQuery={debouncedQuery}
                inputRef={inputRef}
            />
        </div>
    );
}
