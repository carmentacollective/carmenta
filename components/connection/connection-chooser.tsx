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
    Pencil,
    Check,
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

/**
 * Editable title with inline editing support.
 * Click anywhere on title to edit. Enter to save, Escape to cancel.
 */
function EditableTitle({
    title,
    onSave,
}: {
    title: string;
    onSave: (newTitle: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleStartEdit = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            // Initialize with current title when starting edit
            setEditValue(title);
            setIsEditing(true);
        },
        [title]
    );

    const handleSave = useCallback(() => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== title) {
            onSave(trimmed);
        }
        setIsEditing(false);
    }, [editValue, title, onSave]);

    const handleCancel = useCallback(() => {
        setEditValue(title);
        setIsEditing(false);
    }, [title]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
            } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
            }
        },
        [handleSave, handleCancel]
    );

    if (isEditing) {
        return (
            <div className="flex items-center gap-1.5">
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    maxLength={40}
                    className="w-[200px] rounded-md border border-primary/30 bg-background/50 px-2 py-0.5 text-sm text-foreground/90 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                    placeholder="Connection title..."
                />
                <button
                    onMouseDown={(e) => {
                        e.preventDefault(); // Prevents blur from firing first
                        handleSave();
                    }}
                    className="rounded-md p-1 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
                    aria-label="Save title"
                >
                    <Check className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div className="group/title flex items-center gap-1.5">
            {/* Entire title area is clickable to edit - click anywhere to enter edit mode */}
            <button
                onClick={handleStartEdit}
                className="btn-subtle-text flex items-center gap-2 border border-transparent px-1.5 py-0.5 hover:border-foreground/10 hover:bg-foreground/[0.03]"
                aria-label="Click to edit title"
            >
                <AnimatedTitle title={title} />
                {/* Pencil icon - more visible on hover */}
                <Pencil className="h-3 w-3 text-foreground/20 transition-all group-hover/title:text-foreground/50" />
            </button>
        </div>
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
    onSelect: (id: string, slug: string) => void;
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
                // Active connection has stronger visual distinction
                isActive && "bg-primary/8 ring-1 ring-inset ring-primary/20",
                isFresh &&
                    "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
            )}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            {/* Hover background - more visible shift */}
            <div
                className={cn(
                    "absolute inset-0 transition-all duration-200",
                    isActive
                        ? "bg-primary/3 opacity-0 group-hover:opacity-100"
                        : "bg-foreground/[0.04] opacity-0 group-hover:opacity-100"
                )}
            />

            {/* Left accent bar for active connection */}
            {isActive && (
                <div className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-primary/60" />
            )}

            {/* Star button - always visible at 40% opacity, full on hover for a11y */}
            <StarButton
                isStarred={conn.isStarred}
                onToggle={() => onToggleStar(conn.id)}
                showOnHover
                size="sm"
                className={cn(!conn.isStarred && "opacity-40 group-hover:opacity-100")}
            />

            {/* Connection info - clickable */}
            <button
                onClick={() => onSelect(conn.id, conn.slug)}
                className="interactive-focus relative flex flex-1 items-center gap-3 rounded-md text-left transition-all group-hover:translate-x-0.5"
            >
                <span
                    className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium transition-colors",
                        isActive
                            ? "font-semibold text-foreground"
                            : "text-foreground/75 group-hover:text-foreground"
                    )}
                >
                    {conn.title || "New connection"}
                </span>
                {isFresh && (
                    <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        new
                    </span>
                )}
                <span className="shrink-0 text-xs text-foreground/40 transition-colors group-hover:text-foreground/60">
                    {isFresh ? "Just now" : getRelativeTime(conn.lastActivityAt)}
                </span>
            </button>

            {/* Delete button - appears on hover */}
            <button
                onClick={(e) => onDeleteClick(e, conn.id)}
                className="relative z-content rounded-md p-1.5 opacity-0 transition-all hover:bg-red-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-300 group-hover:opacity-100"
                aria-label={`Delete ${conn.title || "connection"}`}
            >
                <Trash2 className="h-3.5 w-3.5 text-foreground/30 transition-colors hover:text-red-500" />
            </button>
        </motion.div>
    );
}

/** Placement determines dropdown position and animation direction */
export type ConnectionChooserPlacement = "header" | "bottom";

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
    placement = "header",
}: {
    isOpen: boolean;
    onClose: () => void;
    connections: PublicConnection[];
    starredConnections: PublicConnection[];
    unstarredConnections: PublicConnection[];
    activeConnection: PublicConnection | null;
    freshConnectionIds: Set<string>;
    onSelect: (id: string, slug: string) => void;
    onDelete: (id: string) => void;
    onToggleStar: (id: string) => void;
    query: string;
    setQuery: (q: string) => void;
    debouncedQuery: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    placement?: ConnectionChooserPlacement;
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
                        className="fixed inset-0 z-backdrop"
                        onClick={handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    />

                    {/* Dropdown panel */}
                    <motion.div
                        className={cn(
                            "fixed inset-x-0 z-modal mx-auto w-[calc(100vw-2rem)] sm:w-[420px]",
                            placement === "header" ? "top-24" : "bottom-36"
                        )}
                        initial={{
                            opacity: 0,
                            y: placement === "header" ? -12 : 12,
                            scale: 0.96,
                        }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                            opacity: 0,
                            y: placement === "header" ? -8 : 8,
                            scale: 0.98,
                        }}
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
                                            <span className="ml-auto text-xs text-foreground/30">
                                                {isSearching
                                                    ? filteredUnstarred.length
                                                    : unstarredConnections.length}
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

export function ConnectionChooser({
    placement = "header",
}: {
    placement?: ConnectionChooserPlacement;
} = {}) {
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
        updateConnectionTitle,
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
        (id: string, slug: string) => {
            setActiveConnection(id, slug);
            closeDropdown();
        },
        [setActiveConnection, closeDropdown]
    );

    const handleSaveTitle = useCallback(
        (newTitle: string) => {
            if (activeConnection) {
                updateConnectionTitle(activeConnection.id, newTitle);
            }
        },
        [activeConnection, updateConnectionTitle]
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
    // Mobile (bottom placement): full width, plus on right
    // Desktop (header placement): use glass-pill styling
    const isMobilePlacement = placement === "bottom";

    return (
        <div className={cn("relative", isMobilePlacement && "w-full")}>
            <motion.div
                layout
                className={cn(
                    "flex items-center",
                    placement === "header"
                        ? "glass-pill"
                        : "w-full rounded-3xl bg-foreground/[0.03] px-3 py-1.5 ring-1 ring-foreground/10 backdrop-blur-sm dark:bg-foreground/[0.05]"
                )}
                transition={{
                    layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                }}
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    {hasTitle ? (
                        // S5: Full layout - different structure for mobile vs desktop
                        <motion.div
                            key="full"
                            className={cn(
                                "flex items-center gap-3",
                                isMobilePlacement ? "w-full" : "px-4 py-2"
                            )}
                            initial={{ opacity: 0, y: isMobilePlacement ? 8 : -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: isMobilePlacement ? 8 : -8 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {/* Search button */}
                            <button
                                onClick={openDropdown}
                                className="btn-subtle-icon text-foreground/40 hover:text-foreground/60"
                                aria-label="Search connections"
                                data-tooltip-id="tip"
                                data-tooltip-content="Find connections"
                            >
                                <Search className="h-4 w-4" />
                            </button>

                            {/* Divider - desktop only */}
                            {!isMobilePlacement && (
                                <div className="h-4 w-px bg-foreground/10" />
                            )}

                            {/* Title area - flex-1 on mobile to push + to right */}
                            <div
                                className={cn(
                                    "flex items-center gap-2",
                                    isMobilePlacement && "min-w-0 flex-1"
                                )}
                            >
                                {isStreaming && <RunningIndicator />}
                                <EditableTitle title={title} onSave={handleSaveTitle} />
                            </div>

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

                            {/* Divider - desktop only */}
                            {!isMobilePlacement && (
                                <div className="h-4 w-px bg-foreground/10" />
                            )}

                            {/* New button - prominent CTA */}
                            <button
                                onClick={createNewConnection}
                                disabled={isPending}
                                className={cn(
                                    "interactive-focus flex items-center justify-center transition-all duration-200",
                                    isMobilePlacement
                                        ? "h-11 w-11 flex-shrink-0 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg active:scale-95"
                                        : "h-8 gap-1.5 rounded-full bg-primary/15 px-3 text-sm font-medium text-primary hover:bg-primary/25 active:scale-95",
                                    "disabled:cursor-not-allowed disabled:opacity-50"
                                )}
                                aria-label="New connection"
                                data-tooltip-id="tip"
                                data-tooltip-content="Start fresh"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                {!isMobilePlacement && (
                                    <span className="hidden sm:inline">New</span>
                                )}
                            </button>
                        </motion.div>
                    ) : (
                        // S2/S3/S4: Minimal trigger - search + recent, plus on right for mobile
                        <motion.div
                            key="minimal"
                            className={cn(
                                "flex items-center gap-3",
                                isMobilePlacement ? "w-full" : "px-4 py-2"
                            )}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <button
                                onClick={openDropdown}
                                className="btn-subtle-icon text-foreground/40 hover:text-foreground/60"
                                aria-label="Search connections"
                                data-tooltip-id="tip"
                                data-tooltip-content="Find connections"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                            <button
                                onClick={openDropdown}
                                className={cn(
                                    "btn-subtle flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground/80",
                                    isMobilePlacement && "flex-1"
                                )}
                            >
                                {isStreaming && <RunningIndicator />}
                                <span>Recent Connections</span>
                            </button>
                            {/* New button on right for mobile - prominent CTA */}
                            {isMobilePlacement && (
                                <button
                                    onClick={createNewConnection}
                                    disabled={isPending}
                                    className="interactive-focus flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="New connection"
                                    data-tooltip-id="tip"
                                    data-tooltip-content="Start fresh"
                                >
                                    {isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </button>
                            )}
                        </motion.div>
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
                placement={placement}
            />
        </div>
    );
}
