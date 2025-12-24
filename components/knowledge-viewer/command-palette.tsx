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
    Search,
    User,
    Settings,
    FileText,
    Clock,
    Filter,
    Calendar,
    Star,
    Bot,
    ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
    "profile.instructions": Settings,
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
 * Escapes HTML entities for safe text rendering
 */
function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Renders text with <mark> tags as highlighted spans
 *
 * Defense-in-depth: Although ts_headline escapes HTML server-side,
 * we also escape the extracted text to prevent XSS if content
 * somehow contains unescaped user input.
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
                            className="rounded-sm bg-primary/20 px-0.5 text-primary"
                        >
                            {escapeHtml(text)}
                        </mark>
                    );
                }
                return <span key={i}>{escapeHtml(part)}</span>;
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
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({});
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

    // Perform full-text search when query changes
    useEffect(() => {
        const abortController = new AbortController();

        const performSearch = async () => {
            if (!query.trim()) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchKB(query, abortController.signal);
                if (!abortController.signal.aborted) {
                    setSearchResults(results);
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    logger.error({ error, query }, "Search failed");
                    setSearchResults([]);
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
    }, [query]);

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
                    className="fixed inset-0 z-modal flex items-start justify-center bg-black/20 pt-[15vh] backdrop-blur-sm"
                    onClick={handleOverlayClick}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.2, bounce: 0.1 }}
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-foreground/10 bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-gray-900/95"
                    >
                        {/* Search input */}
                        <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
                            <Search
                                className={cn(
                                    "h-5 w-5 text-foreground/40",
                                    isSearching && "animate-pulse"
                                )}
                            />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search knowledge..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-foreground/40"
                            />
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "rounded-md p-1.5 transition-colors hover:bg-foreground/5",
                                    showFilters || hasActiveFilters
                                        ? "text-primary"
                                        : "text-foreground/40"
                                )}
                                title="Toggle filters"
                            >
                                <Filter className="h-4 w-4" />
                            </button>
                            {isSearching ? (
                                <span className="text-xs text-foreground/40">
                                    searching...
                                </span>
                            ) : (
                                <kbd className="rounded bg-foreground/5 px-2 py-0.5 text-xs text-foreground/50">
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
                                    className="overflow-hidden border-b border-foreground/10"
                                >
                                    {/*
                                        PLACEHOLDER: Filter UI is scaffolded but not yet wired to search.
                                        These controls update local state but searchKB() doesn't use them yet.
                                        Backend filter support will be added in a follow-up PR.
                                    */}
                                    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
                                        {/* Date Range Filter - UI only, not yet applied */}
                                        <div className="flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1">
                                            <Calendar className="h-3.5 w-3.5 text-foreground/50" />
                                            <select
                                                value={filters.dateRange ?? "all"}
                                                onChange={(e) =>
                                                    setFilters({
                                                        ...filters,
                                                        dateRange: e.target
                                                            .value as SearchFilters["dateRange"],
                                                    })
                                                }
                                                className="bg-transparent text-xs text-foreground/70 outline-none"
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
                                        <div className="flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1 opacity-50">
                                            <Bot className="h-3.5 w-3.5 text-foreground/50" />
                                            <span className="text-xs text-foreground/50">
                                                Model
                                            </span>
                                            <ChevronDown className="h-3 w-3 text-foreground/50" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Recent searches (shown when no query) */}
                        {!query.trim() && recentSearches.length > 0 && (
                            <div className="border-b border-foreground/10 px-4 py-2">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/50">
                                        <Clock className="h-3.5 w-3.5" />
                                        Recent
                                    </div>
                                    <button
                                        onClick={handleClearRecent}
                                        className="text-xs text-foreground/40 hover:text-foreground/60"
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
                                            className="flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:bg-foreground/10"
                                        >
                                            <Search className="h-3 w-3" />
                                            {search}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Results */}
                        <div className="max-h-80 overflow-y-auto p-2">
                            {Object.keys(grouped).length === 0 ? (
                                <p className="py-8 text-center text-sm text-foreground/40">
                                    {query ? "No matches found" : "No documents yet"}
                                </p>
                            ) : (
                                Object.entries(grouped).map(([folderPath, group]) => (
                                    <div key={folderPath} className="mb-3 last:mb-0">
                                        <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium uppercase tracking-wide text-foreground/50">
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
                                                        <div className="ml-6 line-clamp-2 text-xs text-foreground/50">
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
