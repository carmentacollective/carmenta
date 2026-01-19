"use client";

/**
 * Command Palette
 *
 * Floating search overlay triggered by ⌘K (or Ctrl+K on Windows).
 * Provides quick navigation to any document in the knowledge base.
 *
 * Features:
 * - Full-text search with highlighting
 * - Recent searches (clickable chips)
 * - Search filters (date, starred, model)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MagnifyingGlass,
    User,
    Gear,
    FileText,
    Clock,
    Funnel,
    Calendar,
    Star,
    Robot,
    CaretDown,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KBDocument, KBFolder, KBSearchResult } from "@/lib/kb/actions";
import {
    searchKB,
    getRecentSearches,
    addRecentSearch,
    clearRecentSearches,
} from "@/lib/kb/actions";
import type { SearchFilters } from "@/lib/db/schema";
import { logger } from "@/lib/client-logger";

// Map paths to icons
const PATH_ICONS: Record<string, typeof FileText> = {
    "profile.identity": User,
    "profile.instructions": Gear,
};

// Map folder paths to names
const FOLDER_NAMES: Record<string, string> = {
    profile: "Profile",
};

export interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documents: KBDocument[];
    folders: KBFolder[];
    selectedPath: string | null;
    onSelect: (path: string) => void;
}

/**
 * Renders text with <mark> tags as highlighted spans
 *
 * Security: React JSX automatically escapes text content to prevent XSS.
 * The ts_headline() PostgreSQL function returns safe <mark> tags that we parse manually.
 */
function HighlightedText({ html }: { html: string }) {
    const parts = html.split(/(<mark>.*?<\/mark>)/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("<mark>") && part.endsWith("</mark>")) {
                    const text = part.slice(6, -7);
                    return (
                        <mark
                            key={i}
                            className="bg-primary/20 text-primary rounded-sm px-0.5"
                        >
                            {text}
                        </mark>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

export function CommandPalette({
    open,
    onOpenChange,
    documents,
    folders,
    selectedPath,
    onSelect,
}: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [searchResults, setSearchResults] = useState<KBSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [retryTrigger, setRetryTrigger] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load recent searches when palette opens
    useEffect(() => {
        if (open) {
            getRecentSearches()
                .then(setRecentSearches)
                .catch((error) =>
                    logger.error({ error }, "Failed to load recent searches")
                );
        }
    }, [open]);

    // Perform full-text search when query changes or retry is triggered
    useEffect(() => {
        const abortController = new AbortController();

        const performSearch = async () => {
            if (!query.trim()) {
                setSearchResults([]);
                setSearchError(false);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            setSearchError(false);
            try {
                const results = await searchKB(query, abortController.signal);
                if (!abortController.signal.aborted) {
                    setSearchResults(results);
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    logger.error({ error, query }, "Search failed");
                    setSearchResults([]);
                    setSearchError(true);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsSearching(false);
                }
            }
        };

        const debounceTimer = setTimeout(performSearch, 300);
        return () => {
            clearTimeout(debounceTimer);
            abortController.abort();
        };
    }, [query, retryTrigger]);

    // Use search results if query exists, otherwise show all documents
    const filtered = useMemo(() => {
        return query.trim() ? searchResults : documents;
    }, [query, searchResults, documents]);

    // Group filtered results by folder
    const grouped = useMemo(() => {
        const groups: Record<
            string,
            { name: string; documents: (KBDocument | KBSearchResult)[] }
        > = {};

        for (const doc of filtered) {
            const folderPath = doc.path.split(".").slice(0, -1).join(".");
            if (!groups[folderPath]) {
                groups[folderPath] = {
                    name: FOLDER_NAMES[folderPath] ?? folderPath,
                    documents: [],
                };
            }
            groups[folderPath].documents.push(doc);
        }

        return groups;
    }, [filtered]);

    // Handle selection with recent search tracking
    const handleSelect = useCallback(
        (path: string) => {
            if (query.trim()) {
                // Save to recent searches (fire-and-forget)
                addRecentSearch(query).catch((error) =>
                    logger.error({ error }, "Failed to save recent search")
                );
            }
            onSelect(path);
        },
        [query, onSelect]
    );

    // Handle recent search click
    const handleRecentSearchClick = useCallback((searchQuery: string) => {
        setQuery(searchQuery);
    }, []);

    // Handle clear recent searches
    const handleClearRecent = useCallback(() => {
        clearRecentSearches()
            .then(() => setRecentSearches([]))
            .catch((error) =>
                logger.error({ error }, "Failed to clear recent searches")
            );
    }, []);

    // ⌘K keyboard shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Open on ⌘K or Ctrl+K
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(true);
                setQuery("");
                setFocusedIndex(0);
            }

            // Close on Escape
            if (e.key === "Escape" && open) {
                e.preventDefault();
                onOpenChange(false);
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onOpenChange]);

    // Keyboard navigation within palette
    useEffect(() => {
        if (!open) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[focusedIndex]) {
                    handleSelect(filtered[focusedIndex].path);
                }
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, filtered, focusedIndex, handleSelect]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [open]);

    // Reset focused index when filtered results change
    useEffect(() => {
        if (focusedIndex !== 0) {
            setFocusedIndex(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only run when filtered changes
    }, [filtered.length]);

    // Handle click outside
    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) {
                onOpenChange(false);
            }
        },
        [onOpenChange]
    );

    // Check if we have any active filters
    const hasActiveFilters = filters.dateRange && filters.dateRange !== "all";

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="z-modal fixed inset-0 flex items-start justify-center bg-black/20 pt-[15vh] backdrop-blur-sm"
                    onClick={handleOverlayClick}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.2, bounce: 0.1 }}
                        className="border-foreground/10 w-full max-w-lg overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-gray-900/95"
                    >
                        {/* Search input */}
                        <div className="border-foreground/10 flex items-center gap-3 border-b px-4 py-3">
                            <MagnifyingGlass
                                className={cn(
                                    "text-foreground/40 h-5 w-5",
                                    isSearching && "animate-pulse"
                                )}
                            />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search knowledge..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="text-foreground placeholder:text-foreground/40 flex-1 bg-transparent text-base outline-none"
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={cn(
                                            "hover:bg-foreground/5 rounded-md p-1.5 transition-colors",
                                            showFilters || hasActiveFilters
                                                ? "text-primary"
                                                : "text-foreground/40"
                                        )}
                                    >
                                        <Funnel className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Toggle filters</TooltipContent>
                            </Tooltip>
                            {isSearching ? (
                                <span className="text-foreground/40 text-xs">
                                    searching...
                                </span>
                            ) : (
                                <kbd className="bg-foreground/5 text-foreground/50 rounded px-2 py-0.5 text-xs">
                                    esc
                                </kbd>
                            )}
                        </div>

                        {/* Filters (collapsible) */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="border-foreground/10 overflow-hidden border-b"
                                >
                                    {/*
                                        PLACEHOLDER: Filter UI is scaffolded but not yet wired to search.
                                        These controls update local state but searchKB() doesn't use them yet.
                                        Backend filter support will be added in a follow-up PR.
                                    */}
                                    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
                                        {/* Date Range Filter - UI only, not yet applied */}
                                        <div className="bg-foreground/5 flex items-center gap-1.5 rounded-md px-2 py-1">
                                            <Calendar className="text-foreground/50 h-3.5 w-3.5" />
                                            <select
                                                value={filters.dateRange ?? "all"}
                                                onChange={(e) =>
                                                    setFilters({
                                                        ...filters,
                                                        dateRange: e.target
                                                            .value as SearchFilters["dateRange"],
                                                    })
                                                }
                                                className="text-foreground/70 bg-transparent text-xs outline-none"
                                            >
                                                <option value="all">All time</option>
                                                <option value="today">Today</option>
                                                <option value="week">This week</option>
                                                <option value="month">
                                                    This month
                                                </option>
                                            </select>
                                        </div>

                                        {/* Starred Filter - UI only, not yet applied */}
                                        <button
                                            onClick={() =>
                                                setFilters({
                                                    ...filters,
                                                    starredOnly: !filters.starredOnly,
                                                })
                                            }
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                                                filters.starredOnly
                                                    ? "bg-primary/15 text-primary"
                                                    : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10"
                                            )}
                                        >
                                            <Star
                                                className={cn(
                                                    "h-3.5 w-3.5",
                                                    filters.starredOnly &&
                                                        "fill-current"
                                                )}
                                            />
                                            Starred
                                        </button>

                                        {/* Model Filter - placeholder for future */}
                                        <div className="bg-foreground/5 flex items-center gap-1.5 rounded-md px-2 py-1 opacity-50">
                                            <Robot className="text-foreground/50 h-3.5 w-3.5" />
                                            <span className="text-foreground/50 text-xs">
                                                Model
                                            </span>
                                            <CaretDown className="text-foreground/50 h-3 w-3" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Recent searches (shown when no query) */}
                        {!query.trim() && recentSearches.length > 0 && (
                            <div className="border-foreground/10 border-b px-4 py-2">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-foreground/50 flex items-center gap-1.5 text-xs font-medium">
                                        <Clock className="h-3.5 w-3.5" />
                                        Recent
                                    </div>
                                    <button
                                        onClick={handleClearRecent}
                                        className="text-foreground/40 hover:text-foreground/60 text-xs"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {recentSearches.map((search) => (
                                        <button
                                            key={search}
                                            onClick={() =>
                                                handleRecentSearchClick(search)
                                            }
                                            className="bg-foreground/5 text-foreground/70 hover:bg-foreground/10 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors"
                                        >
                                            <MagnifyingGlass className="h-3 w-3" />
                                            {search}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Results */}
                        <div className="max-h-80 overflow-y-auto p-2">
                            {searchError ? (
                                <div className="py-8 text-center">
                                    <p className="text-foreground/50 text-sm">
                                        Search hit a snag
                                    </p>
                                    <button
                                        onClick={() =>
                                            setRetryTrigger((prev) => prev + 1)
                                        }
                                        className="text-primary hover:text-primary/80 mt-2 text-sm"
                                    >
                                        Try again
                                    </button>
                                </div>
                            ) : Object.keys(grouped).length === 0 ? (
                                <p className="text-foreground/40 py-8 text-center text-sm">
                                    {query
                                        ? "Nothing matching that—try different words?"
                                        : "No documents yet"}
                                </p>
                            ) : (
                                Object.entries(grouped).map(([folderPath, group]) => (
                                    <div key={folderPath} className="mb-3 last:mb-0">
                                        <div className="text-foreground/50 flex items-center gap-2 px-2 py-1 text-xs font-medium tracking-wide uppercase">
                                            <User className="h-3.5 w-3.5" />
                                            {group.name}
                                        </div>
                                        {group.documents.map((doc) => {
                                            const Icon =
                                                PATH_ICONS[doc.path] ?? FileText;
                                            const globalIndex = filtered.indexOf(doc);
                                            const isFocused =
                                                globalIndex === focusedIndex;
                                            const searchResult = doc as KBSearchResult;
                                            const hasSnippet =
                                                "snippet" in doc && doc.snippet;

                                            return (
                                                <button
                                                    key={doc.id}
                                                    onClick={() =>
                                                        handleSelect(doc.path)
                                                    }
                                                    className={cn(
                                                        "flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors",
                                                        isFocused
                                                            ? "bg-primary/15"
                                                            : selectedPath === doc.path
                                                              ? "bg-foreground/5"
                                                              : "hover:bg-foreground/5"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Icon
                                                            className={cn(
                                                                "h-4 w-4 shrink-0",
                                                                isFocused
                                                                    ? "text-primary"
                                                                    : "text-foreground/50"
                                                            )}
                                                        />
                                                        <span
                                                            className={cn(
                                                                "text-sm capitalize",
                                                                isFocused
                                                                    ? "text-primary"
                                                                    : "text-foreground/70"
                                                            )}
                                                        >
                                                            {doc.name.replace(
                                                                ".txt",
                                                                ""
                                                            )}
                                                        </span>
                                                    </div>
                                                    {/* Show highlighted snippet for search results */}
                                                    {hasSnippet && (
                                                        <div className="text-foreground/50 ml-6 line-clamp-2 text-xs">
                                                            <HighlightedText
                                                                html={
                                                                    searchResult.snippet
                                                                }
                                                            />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
