"use client";

/**
 * Connection Chooser
 *
 * Split layout: Search bar (shows title or placeholder) + separate New button.
 *
 * States:
 * - S1: Fresh user (no connections) → renders nothing
 * - State A: New/untitled connection → "Search conversations..." placeholder
 * - State B: Titled connection → Title with typewriter animation on arrival
 *
 * The typewriter effect creates a moment of delight when Carmenta
 * understands what we're working on and names the conversation.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    Plus,
    MagnifyingGlass,
    X,
    Clock,
    Trash,
    CircleNotch,
    CaretRight,
    Star,
    Pencil,
    Check,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
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
            <span className="bg-primary/60 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
        </span>
    );
}

/**
 * Marquee-on-overflow wrapper.
 *
 * Shows truncated text with ellipsis normally. On hover, if the text
 * overflows its container, smoothly scrolls left to reveal the full text.
 * This is the standard pattern used by Spotify, iTunes, and media players.
 *
 * The animation speed is constant (60px/s) regardless of text length,
 * so it always feels natural. Includes a brief pause before scrolling.
 */
function MarqueeOnOverflow({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [overflowAmount, setOverflowAmount] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    // Measure overflow on mount, children change, or when text/container resizes
    // Observing text element catches typewriter animation completing
    useEffect(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        const measure = () => {
            const overflow = text.scrollWidth - container.clientWidth;
            setOverflowAmount(Math.max(0, overflow));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        observer.observe(text); // Catch text width changes from typewriter animation
        return () => observer.disconnect();
    }, [children]);

    const hasOverflow = overflowAmount > 0;
    // Constant scroll speed: 60px per second for natural feel
    const scrollDuration = hasOverflow ? overflowAmount / 60 : 0;

    return (
        <div
            ref={containerRef}
            className={cn("overflow-hidden", className)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <span
                ref={textRef}
                className="inline-block whitespace-nowrap"
                style={{
                    transform:
                        isHovering && hasOverflow
                            ? `translateX(-${overflowAmount}px)`
                            : "translateX(0)",
                    transition:
                        isHovering && hasOverflow
                            ? `transform ${scrollDuration}s linear 0.3s`
                            : "transform 0.3s ease-out",
                }}
            >
                {children}
            </span>
        </div>
    );
}

/**
 * Typewriter title animation.
 *
 * When a new title arrives, it types out character by character with a
 * blinking cursor. Creates a moment of delight: "Carmenta understood
 * what we're doing."
 *
 * Fixed 500ms total duration regardless of title length. Short titles
 * type more deliberately, long titles move faster - consistent experience.
 *
 * Animates on mount (when transitioning from no-title state) and when
 * title changes. This ensures the effect plays when Carmenta first names
 * a conversation.
 */
function TypewriterTitle({ title }: { title: string }) {
    // Start with empty prevTitle so animation triggers on mount
    const [prevTitle, setPrevTitle] = useState("");
    const [displayedChars, setDisplayedChars] = useState(0);
    const [isAnimating, setIsAnimating] = useState(title.length > 0);

    // Detect title change during render (this is allowed in React)
    const isNewTitle = prevTitle !== title && title.length > 0;
    if (prevTitle !== title) {
        setPrevTitle(title);
        // Reset animation state for new title
        if (isNewTitle) {
            setDisplayedChars(0);
            setIsAnimating(true);
        } else {
            setDisplayedChars(title.length);
            setIsAnimating(false);
        }
    }

    // Run animation interval
    useEffect(() => {
        if (!isAnimating || displayedChars >= title.length) return;

        // Fixed 500ms total - scales interval based on title length
        const totalDuration = 500;
        const intervalMs = Math.max(10, totalDuration / title.length);

        const interval = setInterval(() => {
            setDisplayedChars((c) => {
                if (c >= title.length - 1) {
                    setIsAnimating(false);
                    return title.length;
                }
                return c + 1;
            });
        }, intervalMs);

        return () => clearInterval(interval);
    }, [isAnimating, displayedChars, title.length]);

    return (
        <span className="text-foreground/70 text-sm">
            {title.slice(0, displayedChars)}
            {isAnimating && <span className="text-primary animate-pulse">|</span>}
        </span>
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
                    className="border-primary/30 bg-background/50 text-foreground/90 focus:border-primary/60 focus:ring-primary/30 w-[200px] rounded-md border px-2 py-0.5 text-sm outline-none focus:ring-1"
                    placeholder="Connection title..."
                />
                <button
                    onMouseDown={(e) => {
                        e.preventDefault(); // Prevents blur from firing first
                        handleSave();
                    }}
                    className="text-primary/60 hover:bg-primary/10 hover:text-primary flex h-9 w-9 items-center justify-center rounded-md transition-colors"
                    aria-label="Save title"
                >
                    <Check className="h-5 w-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="group/title flex min-w-0 items-center gap-1.5">
            {/* Entire title area is clickable to edit - click anywhere to enter edit mode */}
            <button
                onClick={handleStartEdit}
                className="btn-subtle-text hover:border-foreground/10 hover:bg-foreground/[0.03] flex min-h-[44px] min-w-0 flex-1 items-center gap-2 border border-transparent px-3 py-2"
                aria-label="Click to edit title"
                data-tooltip-id="tip"
                data-tooltip-content="Click to rename"
            >
                {/* Marquee scrolls on hover when title overflows */}
                <MarqueeOnOverflow className="min-w-0 flex-1">
                    <TypewriterTitle title={title} />
                </MarqueeOnOverflow>
                {/* Pencil icon - more visible on hover */}
                <Pencil className="text-foreground/20 group-hover/title:text-foreground/50 h-4 w-4 shrink-0 transition-all" />
            </button>
        </div>
    );
}

/** A single connection row in the dropdown */
function ConnectionRow({
    conn,
    isActive,
    isFresh,
    isFocused,
    isNavigating,
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
    isFocused: boolean;
    isNavigating: boolean;
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
                        className="text-foreground/60 hover:bg-foreground/5 rounded-lg px-3 py-1 text-sm font-medium transition-colors"
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
                isActive && "bg-primary/8 ring-primary/20 ring-1 ring-inset",
                // Keyboard focus highlight
                isFocused && !isActive && "bg-foreground/[0.06]",
                isFresh &&
                    "from-primary/10 via-primary/5 bg-gradient-to-r to-transparent"
            )}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            {/* Hover background - more visible shift */}
            <div
                className={cn(
                    "pointer-events-none absolute inset-0 transition-all duration-200",
                    isActive
                        ? "bg-primary/3 opacity-0 group-hover:opacity-100"
                        : "bg-foreground/[0.04] opacity-0 group-hover:opacity-100",
                    // Hide hover effect when keyboard focused (already has background)
                    isFocused && "opacity-0 group-hover:opacity-0"
                )}
            />

            {/* Left accent bar for active connection */}
            {isActive && (
                <div className="bg-primary/60 absolute top-2 bottom-2 left-0 w-0.5 rounded-full" />
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
                disabled={isNavigating}
                className="interactive-focus relative flex flex-1 items-center gap-3 rounded-md text-left transition-all group-hover:translate-x-0.5 disabled:opacity-70"
            >
                <span
                    className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium transition-colors",
                        isActive
                            ? "text-foreground font-semibold"
                            : "text-foreground/75 group-hover:text-foreground"
                    )}
                >
                    {conn.title || "New connection"}
                </span>
                {isFresh && !isNavigating && (
                    <span className="bg-primary/20 text-primary shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                        new
                    </span>
                )}
                {isNavigating ? (
                    <CircleNotch className="text-primary h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                    <span className="text-foreground/40 group-hover:text-foreground/60 shrink-0 text-xs transition-colors">
                        {isFresh ? "Just now" : getRelativeTime(conn.lastActivityAt)}
                    </span>
                )}
            </button>

            {/* Delete button - always visible, red on hover */}
            <button
                onClick={(e) => onDeleteClick(e, conn.id)}
                className="z-content relative rounded-md p-1.5 transition-all hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-300"
                aria-label={`Delete ${conn.title || "connection"}`}
            >
                <Trash className="text-foreground/30 h-3.5 w-3.5 transition-colors hover:text-red-500" />
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
    isMobile,
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
    isMobile: boolean;
}) {
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [navigatingToId, setNavigatingToId] = useState<string | null>(null);
    const [showAllRecent, setShowAllRecent] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Track previous values to reset state during render (React-recommended pattern)
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    const [prevQuery, setPrevQuery] = useState(debouncedQuery);
    if (prevIsOpen !== isOpen || prevQuery !== debouncedQuery) {
        setPrevIsOpen(isOpen);
        setPrevQuery(debouncedQuery);
        setFocusedIndex(-1);
        setNavigatingToId(null); // Clear stale loading state when dropdown reopens
    }

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

    const cancelDelete = useCallback(() => {
        setConfirmingDeleteId(null);
    }, []);

    // Wrap onClose to also clear confirmation state
    const handleClose = useCallback(() => {
        setConfirmingDeleteId(null);
        setNavigatingToId(null);
        onClose();
    }, [onClose]);

    // Wrap onSelect to show loading state during navigation
    const handleSelectConnection = useCallback(
        (id: string, slug: string) => {
            setNavigatingToId(id);
            onSelect(id, slug);
        },
        [onSelect]
    );

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
    const { filteredStarred, filteredUnstarred, isSearching, hasMoreRecent } =
        useMemo(() => {
            const isSearching = Boolean(debouncedQuery.trim());
            const recentLimit = 6;
            const hasMoreRecent = unstarredConnections.length > recentLimit;

            if (!isSearching) {
                // No search: show starred and recent (limited unless "show all" is active)
                return {
                    filteredStarred: starredConnections,
                    filteredUnstarred: showAllRecent
                        ? unstarredConnections
                        : unstarredConnections.slice(0, recentLimit),
                    isSearching: false,
                    hasMoreRecent,
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
                hasMoreRecent: false,
            };
        }, [starredConnections, unstarredConnections, debouncedQuery, showAllRecent]);

    // Flat list of visible connections for keyboard navigation
    const visibleConnections = useMemo(() => {
        const starred = starredCollapsed ? [] : filteredStarred;
        return [...starred, ...filteredUnstarred];
    }, [filteredStarred, filteredUnstarred, starredCollapsed]);

    // Keyboard navigation: arrow keys + Enter
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((i) => (i < visibleConnections.length - 1 ? i + 1 : 0));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((i) => (i > 0 ? i - 1 : visibleConnections.length - 1));
            } else if (e.key === "Enter" && focusedIndex >= 0) {
                e.preventDefault();
                const conn = visibleConnections[focusedIndex];
                if (conn) {
                    handleSelectConnection(conn.id, conn.slug);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, focusedIndex, visibleConnections, handleSelectConnection]);

    // Use portal to escape stacking context from Framer Motion transforms
    // Check runs on every render but createPortal only called client-side
    const canUsePortal = typeof document !== "undefined";

    const dropdownContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="z-backdrop fixed inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    />

                    {/* Dropdown panel - full-screen on mobile, centered modal on desktop */}
                    <motion.div
                        className="z-modal fixed inset-0 sm:inset-x-0 sm:top-24 sm:bottom-auto sm:mx-auto sm:h-auto sm:w-[420px]"
                        initial={
                            isMobile
                                ? { opacity: 0, y: "100%" }
                                : { opacity: 0, y: -12, scale: 0.96 }
                        }
                        animate={
                            isMobile
                                ? { opacity: 1, y: 0 }
                                : { opacity: 1, y: 0, scale: 1 }
                        }
                        exit={
                            isMobile
                                ? { opacity: 0, y: "100%" }
                                : { opacity: 0, y: -8, scale: 0.98 }
                        }
                        transition={{
                            duration: isMobile ? 0.3 : 0.2,
                            ease: [0.16, 1, 0.3, 1],
                        }}
                    >
                        <div className="glass-container-mobile flex h-full flex-col overflow-hidden rounded-none shadow-2xl sm:rounded-2xl">
                            {/* Search header */}
                            <div className="border-foreground/10 flex items-center gap-3 border-b px-4 py-3">
                                <MagnifyingGlass className="text-foreground/40 h-5 w-5" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search..."
                                    className="text-foreground/90 placeholder:text-foreground/40 flex-1 bg-transparent text-base outline-none"
                                />
                                <button
                                    onClick={handleClose}
                                    className="btn-glass-interactive h-8 w-8"
                                    aria-label="Close"
                                >
                                    <X className="text-foreground/60 h-4 w-4" />
                                </button>
                            </div>

                            {/* Connection list */}
                            <div className="flex-1 overflow-y-auto sm:max-h-[50vh]">
                                {/* Empty state */}
                                {filteredStarred.length === 0 &&
                                    filteredUnstarred.length === 0 && (
                                        <div className="py-8 text-center">
                                            <div className="text-foreground/50 text-sm">
                                                {connections.length === 0
                                                    ? "We haven't started any connections yet"
                                                    : "No matching connections found"}
                                            </div>
                                            {connections.length > 0 && (
                                                <div className="text-foreground/30 mt-2 text-xs">
                                                    Every connection builds our shared
                                                    understanding
                                                </div>
                                            )}
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
                                                <CaretRight className="h-3.5 w-3.5 text-amber-500/70" />
                                            </motion.div>
                                            <Star
                                                weight="fill"
                                                className="h-3.5 w-3.5 text-amber-400"
                                            />
                                            <span className="text-xs font-medium tracking-wider text-amber-600/70 uppercase dark:text-amber-400/70">
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
                                                                        isFocused={
                                                                            focusedIndex ===
                                                                            index
                                                                        }
                                                                        isNavigating={
                                                                            navigatingToId ===
                                                                            conn.id
                                                                        }
                                                                        isConfirming={
                                                                            confirmingDeleteId ===
                                                                            conn.id
                                                                        }
                                                                        index={index}
                                                                        onSelect={
                                                                            handleSelectConnection
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

                                {/* Connections section */}
                                {filteredUnstarred.length > 0 && (
                                    <div>
                                        <div className="bg-foreground/[0.03] flex items-center gap-2 px-4 py-2">
                                            <Clock className="text-foreground/40 h-3.5 w-3.5" />
                                            <span className="text-foreground/50 text-xs font-medium tracking-wider uppercase">
                                                {isSearching
                                                    ? "Results"
                                                    : "Connections"}
                                            </span>
                                            <span className="text-foreground/30 ml-auto text-xs">
                                                {isSearching
                                                    ? filteredUnstarred.length
                                                    : unstarredConnections.length}
                                            </span>
                                        </div>

                                        <div className="py-1">
                                            <AnimatePresence mode="popLayout">
                                                {filteredUnstarred.map(
                                                    (conn, index) => {
                                                        // Global index in visibleConnections
                                                        const globalIndex =
                                                            starredCollapsed
                                                                ? index
                                                                : filteredStarred.length +
                                                                  index;
                                                        return (
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
                                                                isFocused={
                                                                    focusedIndex ===
                                                                    globalIndex
                                                                }
                                                                isNavigating={
                                                                    navigatingToId ===
                                                                    conn.id
                                                                }
                                                                isConfirming={
                                                                    confirmingDeleteId ===
                                                                    conn.id
                                                                }
                                                                index={index}
                                                                onSelect={
                                                                    handleSelectConnection
                                                                }
                                                                onDelete={onDelete}
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
                                                        );
                                                    }
                                                )}
                                            </AnimatePresence>

                                            {/* Show all / Show less toggle when there are more than 6 recent */}
                                            {hasMoreRecent && !isSearching && (
                                                <button
                                                    onClick={() =>
                                                        setShowAllRecent(!showAllRecent)
                                                    }
                                                    className="border-foreground/5 text-primary/80 hover:bg-foreground/[0.03] hover:text-primary flex w-full items-center justify-center gap-2 border-t px-4 py-2.5 text-sm transition-colors"
                                                >
                                                    {showAllRecent ? (
                                                        <>Show less</>
                                                    ) : (
                                                        <>
                                                            View all{" "}
                                                            {
                                                                unstarredConnections.length
                                                            }{" "}
                                                            conversations
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Knowledge footer - only show when there are connections */}
                                {connections.length > 0 && (
                                    <div className="border-foreground/5 text-foreground/30 border-t px-4 py-3 text-center text-xs">
                                        Each conversation shapes how we understand you
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    // Render via portal to escape parent stacking contexts
    return canUsePortal ? createPortal(dropdownContent, document.body) : null;
}

export function ConnectionChooser({
    hideNewButton = false,
}: {
    /** Hide the new button when it's rendered elsewhere (e.g., mobile header row 1) */
    hideNewButton?: boolean;
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

    // Detect mobile for responsive animation and layout
    const isMobile = useMediaQuery("(max-width: 639px)");

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

    // Focus search input when dropdown opens (skip on mobile to avoid keyboard popup)
    useEffect(() => {
        if (isDropdownOpen && inputRef.current && !isMobile) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [isDropdownOpen, isMobile]);

    const hasConnections = connections.length > 0;
    const hasTitle = Boolean(displayTitle);
    const title = displayTitle ?? "";

    // S1: Fresh user - render nothing
    if (!hasConnections) {
        return null;
    }

    // Split layout: Glass pill (search/title) + standalone New button
    // max-w keeps it from stretching too wide on large screens
    return (
        <div className="flex max-w-xl items-center gap-3">
            {/* Glass pill with search/title */}
            <div className="relative min-w-0 flex-1">
                <motion.div
                    layout
                    className="border-foreground/8 bg-foreground/[0.02] hover:border-foreground/12 hover:bg-foreground/[0.04] flex h-10 w-full items-center rounded-2xl border backdrop-blur-xl transition-all"
                    transition={{
                        layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                    }}
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        {hasTitle ? (
                            // Has title: Search | Title | Star
                            <motion.div
                                key="full"
                                className="flex h-full w-full items-center gap-2 px-3 sm:gap-3 sm:px-4"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{
                                    duration: 0.4,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                            >
                                {/* Search button */}
                                <button
                                    onClick={openDropdown}
                                    className="btn-subtle-icon text-foreground/40 hover:text-foreground/60 shrink-0"
                                    aria-label="Search connections"
                                    data-tooltip-id="tip"
                                    data-tooltip-content="Find connections"
                                >
                                    <MagnifyingGlass className="h-4 w-4" />
                                </button>

                                {/* Divider */}
                                <div className="bg-foreground/10 hidden h-4 w-px sm:block" />

                                {/* Title area - fills available space */}
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    {isStreaming && <RunningIndicator />}
                                    <EditableTitle
                                        title={title}
                                        onSave={handleSaveTitle}
                                    />
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
                            </motion.div>
                        ) : (
                            // No title yet: "Search conversations..." placeholder
                            <motion.div
                                key="minimal"
                                className="flex h-full w-full items-center gap-2 px-3 sm:gap-3 sm:px-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <button
                                    onClick={openDropdown}
                                    className="text-foreground/50 hover:text-foreground/70 flex min-w-0 flex-1 items-center gap-2 text-sm transition-colors"
                                    aria-label="Search connections"
                                >
                                    <MagnifyingGlass className="h-4 w-4 shrink-0" />
                                    {isStreaming && <RunningIndicator />}
                                    <span className="truncate">
                                        Search connections...
                                    </span>
                                </button>
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
                    isMobile={isMobile}
                />
            </div>

            {/* Standalone New button - outside the glass pill */}
            {!hideNewButton && (
                <button
                    onClick={createNewConnection}
                    disabled={isPending}
                    className="interactive-focus border-primary/20 bg-primary/10 text-primary hover:border-primary/30 hover:bg-primary/15 flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border px-4 text-sm font-medium transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="New connection"
                >
                    {isPending ? (
                        <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">New Connection</span>
                </button>
            )}
        </div>
    );
}
