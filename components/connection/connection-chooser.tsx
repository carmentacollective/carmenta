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
import {
    Plus,
    Search,
    X,
    Clock,
    Trash2,
    Loader2,
    ChevronDown,
    ChevronRight,
    Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useConnection } from "./connection-context";
import { StarButton } from "./star-button";
import type { PublicConnection } from "@/lib/actions/connections";

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

/**
 * Animated title with Slide Cascade effect.
 *
 * Each word slides up from below with staggered timing when the title changes.
 * Using key={title} forces Framer Motion to replay the animation on title change.
 * Creates a moment of delight: "Carmenta understood what we're doing."
 */
function AnimatedTitle({ title }: { title: string }) {
    const words = title.split(" ");

    return (
        <motion.span
            key={title}
            className="flex flex-wrap gap-1 text-sm text-foreground/70"
        >
            {words.map((word, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.4,
                        delay: i * 0.08,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                >
                    {word}
                </motion.span>
            ))}
        </motion.span>
    );
}

/** A single connection row in the dropdown */
function ConnectionRow({
    conn,
    isActive,
    isFresh,
    isConfirming,
    index,
    onSelect,
    onDelete,
    onToggleStar,
    onDeleteClick,
    onCancelDelete,
}: {
    conn: PublicConnection;
    isActive: boolean;
    isFresh: boolean;
    isConfirming: boolean;
    index: number;
    onSelect: (slug: string) => void;
    onDelete: (id: string) => void;
    onToggleStar: (id: string) => void;
    onDeleteClick: (e: React.MouseEvent, id: string) => void;
    onCancelDelete: () => void;
}) {
    // Delete confirmation row
    if (isConfirming) {
        return (
            <motion.div
                key={conn.id}
                layout
                className="flex min-h-[52px] items-center justify-between bg-red-500/10 px-4"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
            >
                <span className="text-sm text-red-600 dark:text-red-400">
                    Delete &ldquo;{conn.title || "this connection"}&rdquo;?
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancelDelete();
                        }}
                        className="rounded-lg px-3 py-1 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(conn.id);
                        }}
                        className="rounded-lg bg-red-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-600"
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
            layout
            className={cn(
                "group relative flex min-h-[52px] items-center gap-2 overflow-hidden px-4 transition-all",
                isActive && "bg-primary/5",
                isFresh &&
                    "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
            )}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            {/* Hover background indicator */}
            <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

            {/* Star button */}
            <StarButton
                isStarred={conn.isStarred}
                onToggle={() => onToggleStar(conn.id)}
                showOnHover
                size="sm"
            />

            {/* Connection info - clickable */}
            <button
                onClick={() => onSelect(conn.slug)}
                className="relative flex flex-1 items-center gap-3 text-left transition-all group-hover:translate-x-0.5"
            >
                <span
                    className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium transition-colors",
                        isActive
                            ? "text-foreground"
                            : "text-foreground/80 group-hover:text-foreground"
                    )}
                >
                    {conn.title || "New connection"}
                </span>
                {isFresh && (
                    <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        new
                    </span>
                )}
                <span className="shrink-0 text-xs text-foreground/40">
                    {isFresh ? "Just now" : getRelativeTime(conn.lastActivityAt)}
                </span>
            </button>

            {/* Delete button */}
            <button
                onClick={(e) => onDeleteClick(e, conn.id)}
                className="relative z-10 rounded-md p-1.5 opacity-0 transition-all hover:bg-red-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-300 group-hover:opacity-100"
                title={`Delete ${conn.title || "connection"}`}
                aria-label={`Delete ${conn.title || "connection"}`}
            >
                <Trash2 className="h-3.5 w-3.5 text-foreground/30 transition-colors hover:text-red-500" />
            </button>
        </motion.div>
    );
}

/** Shared dropdown for both minimal and full states */
function ConnectionDropdown({
    isOpen,
    onClose,
    connections,
    starredConnections,
    unstarredConnections,
    activeConnection,
    freshConnectionIds,
    onSelect,
    onDelete,
    onToggleStar,
    query,
    setQuery,
    debouncedQuery,
    inputRef,
}: {
    isOpen: boolean;
    onClose: () => void;
    connections: PublicConnection[];
    starredConnections: PublicConnection[];
    unstarredConnections: PublicConnection[];
    activeConnection: PublicConnection | null;
    freshConnectionIds: Set<string>;
    onSelect: (slug: string) => void;
    onDelete: (id: string) => void;
    onToggleStar: (id: string) => void;
    query: string;
    setQuery: (q: string) => void;
    debouncedQuery: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
}) {
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [starredCollapsed, setStarredCollapsed] = useState(() => {
        if (typeof window === "undefined") return false;
        const stored = localStorage.getItem("carmenta:starred-collapsed");
        return stored === "true";
    });

    // Persist collapse state
    const toggleStarredCollapsed = useCallback(() => {
        setStarredCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("carmenta:starred-collapsed", String(next));
            return next;
        });
    }, []);

    const handleDeleteClick = useCallback(
        (e: React.MouseEvent, connectionId: string) => {
            e.stopPropagation();
            setConfirmingDeleteId(connectionId);
        },
        []
    );

    const confirmDelete = useCallback(
        (e: React.MouseEvent, connectionId: string) => {
            e.stopPropagation();
            onDelete(connectionId);
            setConfirmingDeleteId(null);
        },
        [onDelete]
    );

    const cancelDelete = useCallback(() => {
        setConfirmingDeleteId(null);
    }, []);

    // Wrap onClose to also clear confirmation state
    const handleClose = useCallback(() => {
        setConfirmingDeleteId(null);
        onClose();
    }, [onClose]);

    // Handle ESC to cancel delete or close
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (confirmingDeleteId) {
                    cancelDelete();
                } else {
                    handleClose();
                }
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, handleClose, confirmingDeleteId, cancelDelete]);

    // Filter connections based on search - returns unified results when searching
    const { filteredStarred, filteredUnstarred, isSearching } = useMemo(() => {
        const isSearching = Boolean(debouncedQuery.trim());

        if (!isSearching) {
            // No search: show starred and recent (limited)
            return {
                filteredStarred: starredConnections,
                filteredUnstarred: unstarredConnections.slice(0, 6),
                isSearching: false,
            };
        }

        // Search: filter all connections and show in unified list
        const lowerQuery = debouncedQuery.toLowerCase();
        const matchesQuery = (c: PublicConnection) =>
            c.title?.toLowerCase().includes(lowerQuery) ||
            c.id.toLowerCase().includes(lowerQuery);

        return {
            filteredStarred: starredConnections.filter(matchesQuery),
            filteredUnstarred: unstarredConnections.filter(matchesQuery),
            isSearching: true,
        };
    }, [starredConnections, unstarredConnections, debouncedQuery]);

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
                        <div className="glass-container overflow-hidden rounded-2xl shadow-2xl">
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
                                    className="btn-glass-interactive h-8 w-8"
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4 text-foreground/60" />
                                </button>
                            </div>

                            {/* Connection list */}
                            <div className="max-h-[50vh] overflow-y-auto">
                                {/* Empty state */}
                                {filteredStarred.length === 0 &&
                                    filteredUnstarred.length === 0 && (
                                        <div className="py-8 text-center text-sm text-foreground/50">
                                            {connections.length === 0
                                                ? "We haven't started any connections yet"
                                                : "No matching connections found"}
                                        </div>
                                    )}

                                {/* Starred section - collapsible */}
                                {filteredStarred.length > 0 && (
                                    <div>
                                        <button
                                            onClick={toggleStarredCollapsed}
                                            className="flex w-full items-center gap-2 bg-amber-50/50 px-4 py-2 transition-colors hover:bg-amber-50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
                                        >
                                            <motion.div
                                                animate={{
                                                    rotate: starredCollapsed ? 0 : 90,
                                                }}
                                                transition={{ duration: 0.15 }}
                                            >
                                                <ChevronRight className="h-3.5 w-3.5 text-amber-500/70" />
                                            </motion.div>
                                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                            <span className="text-xs font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">
                                                Starred
                                            </span>
                                            <span className="ml-auto text-xs text-amber-500/50">
                                                {filteredStarred.length}
                                            </span>
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {!starredCollapsed && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{
                                                        height: "auto",
                                                        opacity: 1,
                                                    }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{
                                                        duration: 0.2,
                                                        ease: [0.16, 1, 0.3, 1],
                                                    }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="py-1">
                                                        <AnimatePresence mode="popLayout">
                                                            {filteredStarred.map(
                                                                (conn, index) => (
                                                                    <ConnectionRow
                                                                        key={conn.id}
                                                                        conn={conn}
                                                                        isActive={
                                                                            conn.id ===
                                                                            activeConnection?.id
                                                                        }
                                                                        isFresh={freshConnectionIds.has(
                                                                            conn.id
                                                                        )}
                                                                        isConfirming={
                                                                            confirmingDeleteId ===
                                                                            conn.id
                                                                        }
                                                                        index={index}
                                                                        onSelect={
                                                                            onSelect
                                                                        }
                                                                        onDelete={
                                                                            onDelete
                                                                        }
                                                                        onToggleStar={
                                                                            onToggleStar
                                                                        }
                                                                        onDeleteClick={
                                                                            handleDeleteClick
                                                                        }
                                                                        onCancelDelete={
                                                                            cancelDelete
                                                                        }
                                                                    />
                                                                )
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Recent section */}
                                {filteredUnstarred.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 bg-foreground/[0.03] px-4 py-2">
                                            <Clock className="h-3.5 w-3.5 text-foreground/40" />
                                            <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                                {isSearching ? "Results" : "Recent"}
                                            </span>
                                        </div>

                                        <div className="py-1">
                                            <AnimatePresence mode="popLayout">
                                                {filteredUnstarred.map(
                                                    (conn, index) => (
                                                        <ConnectionRow
                                                            key={conn.id}
                                                            conn={conn}
                                                            isActive={
                                                                conn.id ===
                                                                activeConnection?.id
                                                            }
                                                            isFresh={freshConnectionIds.has(
                                                                conn.id
                                                            )}
                                                            isConfirming={
                                                                confirmingDeleteId ===
                                                                conn.id
                                                            }
                                                            index={index}
                                                            onSelect={onSelect}
                                                            onDelete={onDelete}
                                                            onToggleStar={onToggleStar}
                                                            onDeleteClick={
                                                                handleDeleteClick
                                                            }
                                                            onCancelDelete={
                                                                cancelDelete
                                                            }
                                                        />
                                                    )
                                                )}
                                            </AnimatePresence>
                                        </div>
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
        starredConnections,
        unstarredConnections,
        activeConnection,
        displayTitle,
        freshConnectionIds,
        isStreaming,
        setActiveConnection,
        createNewConnection,
        deleteConnection,
        toggleStarConnection,
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
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [isDropdownOpen]);

    // Keyboard shortcut: Cmd+Shift+S to toggle star on active connection
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
                e.preventDefault();
                if (activeConnection) {
                    toggleStarConnection(activeConnection.id);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeConnection, toggleStarConnection]);

    const hasConnections = connections.length > 0;
    const hasTitle = Boolean(displayTitle);
    const title = displayTitle ?? "";

    // S1: Fresh user - render nothing
    if (!hasConnections) {
        return null;
    }

    // Unified container - smooth transitions between states
    return (
        <div className="relative">
            <motion.div
                layout
                className="glass-pill flex items-center"
                transition={{
                    layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                }}
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    {hasTitle ? (
                        // S5: Full layout [Search | Title | New]
                        <motion.div
                            key="full"
                            className="flex items-center gap-3 px-4 py-2"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {/* Search button */}
                            <button
                                onClick={openDropdown}
                                className="btn-subtle-icon text-foreground/40 hover:text-foreground/60"
                                aria-label="Search connections"
                            >
                                <Search className="h-4 w-4" />
                            </button>

                            {/* Divider */}
                            <div className="h-4 w-px bg-foreground/10" />

                            {/* Title */}
                            <button
                                onClick={openDropdown}
                                className="btn-subtle-text flex items-center gap-2"
                            >
                                {isStreaming && <RunningIndicator />}
                                <AnimatedTitle title={title} />
                            </button>

                            {/* Star button for active connection */}
                            {activeConnection && (
                                <StarButton
                                    isStarred={activeConnection.isStarred}
                                    onToggle={() =>
                                        toggleStarConnection(activeConnection.id)
                                    }
                                    size="sm"
                                    label={
                                        activeConnection.isStarred
                                            ? "Unstar this connection"
                                            : "Star this connection"
                                    }
                                />
                            )}

                            {/* Divider */}
                            <div className="h-4 w-px bg-foreground/10" />

                            {/* New button */}
                            <button
                                onClick={createNewConnection}
                                disabled={isPending}
                                className={cn(
                                    "btn-subtle-text flex items-center gap-1.5 text-sm",
                                    "text-foreground/50 hover:text-foreground/80",
                                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                                )}
                                aria-label="New connection"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                <span className="hidden font-medium sm:inline">
                                    New
                                </span>
                            </button>
                        </motion.div>
                    ) : (
                        // S2/S3/S4: Minimal trigger
                        <motion.button
                            key="minimal"
                            onClick={openDropdown}
                            className="btn-subtle flex items-center gap-2 px-4 py-2 text-sm text-foreground/60 hover:text-foreground/80"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {isStreaming && <RunningIndicator />}
                            <span>Recent Connections</span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </motion.button>
                    )}
                </AnimatePresence>
            </motion.div>

            <ConnectionDropdown
                isOpen={isDropdownOpen}
                onClose={closeDropdown}
                connections={connections}
                starredConnections={starredConnections}
                unstarredConnections={unstarredConnections}
                activeConnection={activeConnection}
                freshConnectionIds={freshConnectionIds}
                onSelect={handleSelect}
                onDelete={deleteConnection}
                onToggleStar={toggleStarConnection}
                query={query}
                setQuery={setQuery}
                debouncedQuery={debouncedQuery}
                inputRef={inputRef}
            />
        </div>
    );
}
