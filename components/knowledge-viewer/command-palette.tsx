"use client";

/**
 * Command Palette
 *
 * Floating search overlay triggered by ⌘K (or Ctrl+K on Windows).
 * Provides quick navigation to any document in the knowledge base.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KBDocument, KBFolder } from "@/lib/kb/actions";
import { searchKB } from "@/lib/kb/actions";
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
    const [searchResults, setSearchResults] = useState<KBDocument[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Perform full-text search when query changes
    useEffect(() => {
        const abortController = new AbortController();

        const performSearch = async () => {
            if (!query.trim()) {
                setSearchResults([]);
                setIsSearching(false); // Bug fix: Reset loading state when clearing search
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
        const groups: Record<string, { name: string; documents: KBDocument[] }> = {};

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
                    onSelect(filtered[focusedIndex].path);
                }
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, filtered, focusedIndex, onSelect]);

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
        // Only reset if not already at 0 to avoid unnecessary state updates
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

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh] backdrop-blur-sm"
                    onClick={handleOverlayClick}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.2, bounce: 0.1 }}
                        className="w-full max-w-md overflow-hidden rounded-2xl border border-foreground/10 bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-gray-900/95"
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

                                            return (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => onSelect(doc.path)}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                                        isFocused
                                                            ? "bg-primary/15 text-primary"
                                                            : selectedPath === doc.path
                                                              ? "bg-foreground/5 text-foreground/80"
                                                              : "text-foreground/70 hover:bg-foreground/5"
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4 shrink-0" />
                                                    <span className="capitalize">
                                                        {doc.name.replace(".txt", "")}
                                                    </span>
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
