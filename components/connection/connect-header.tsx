"use client";

/**
 * Connect Header
 *
 * Dock-style navigation that mirrors the chat input at the bottom.
 * Same glass styling, same rounded corners, same shadow treatment.
 * Creates perfect visual symmetry between top and bottom of the interface.
 *
 * UX Philosophy: Harmony through reflection. The header and footer speak
 * the same visual language. Users feel the coherence without thinking about it.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Search, X, Clock, Loader2, Sparkles, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import { OptionalUserButton } from "@/components/connection/optional-user-button";
import { useConnection } from "./connection-context";
import { SEARCH_HISTORY, getRelativeTime } from "./mock-connections";

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

export function ConnectHeader() {
    const { activeConnection, runningCount, setActiveConnection, createNewConnection } =
        useConnection();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const closeSearch = useCallback(() => {
        setIsSearchOpen(false);
        setQuery("");
    }, []);

    const openSearch = useCallback(() => setIsSearchOpen(true), []);

    const handleSelect = useCallback(
        (id: string) => {
            setActiveConnection(id);
            closeSearch();
        },
        [setActiveConnection, closeSearch]
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

    const filtered = query.trim()
        ? SEARCH_HISTORY.filter(
              (c) =>
                  c.title.toLowerCase().includes(query.toLowerCase()) ||
                  c.shortTitle.toLowerCase().includes(query.toLowerCase()) ||
                  c.preview?.toLowerCase().includes(query.toLowerCase())
          )
        : SEARCH_HISTORY.slice(0, 6);

    return (
        <header className="flex items-center justify-between px-4 py-3 sm:px-6">
            {/* Logo */}
            <Link
                href="/"
                className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
            >
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={36}
                    height={36}
                    className="h-9 w-9"
                    priority
                />
                <span className="hidden text-lg font-semibold tracking-tight text-foreground/90 lg:inline">
                    Carmenta
                </span>
            </Link>

            {/* Center: Dock style - mirrors chat input */}
            <div className="relative">
                <div className="glass-input-dock flex min-w-[280px] items-center gap-2 sm:min-w-[400px]">
                    {/* Search button */}
                    <button
                        onClick={openSearch}
                        className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            "text-foreground/40 hover:bg-white/40 hover:text-foreground/60",
                            "transition-all"
                        )}
                        title="Search conversations"
                    >
                        <Search className="h-4 w-4" />
                    </button>

                    {/* Title - opens search */}
                    <button
                        onClick={openSearch}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1"
                    >
                        {runningCount > 0 && <RunningIndicator />}
                        <span className="truncate text-sm text-foreground/70">
                            {activeConnection?.title}
                        </span>
                    </button>

                    {/* New chat button - like send button */}
                    <button
                        onClick={createNewConnection}
                        className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                            "bg-gradient-to-br from-[rgba(200,160,220,0.8)] via-[rgba(160,200,220,0.8)] to-[rgba(220,180,200,0.8)]",
                            "text-white/90 hover:scale-105 hover:shadow-md"
                        )}
                        title="New conversation"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                {/* Search dropdown - positioned below */}
                {isSearchOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={closeSearch} />
                        <div className="absolute left-0 right-0 top-full z-50 mt-2">
                            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-foreground/10">
                                {/* Search input header with close button */}
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
                                    >
                                        <X className="h-4 w-4 text-foreground/40" />
                                    </button>
                                </div>

                                {/* Results list */}
                                <div className="max-h-80 overflow-y-auto">
                                    <div className="flex items-center gap-2 bg-foreground/5 px-4 py-2">
                                        <Clock className="h-3.5 w-3.5 text-foreground/40" />
                                        <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                            {query ? "Results" : "Recent"}
                                        </span>
                                    </div>
                                    {filtered.length > 0 ? (
                                        <div className="py-2">
                                            {filtered.map((conn) => (
                                                <button
                                                    key={conn.id}
                                                    onClick={() =>
                                                        handleSelect(conn.id)
                                                    }
                                                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-foreground/5"
                                                >
                                                    <div className="mt-0.5">
                                                        {conn.isRunning ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        ) : (
                                                            <Sparkles className="h-4 w-4 text-foreground/40" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-medium text-foreground/80">
                                                                {conn.title}
                                                            </span>
                                                            {conn.isPinned && (
                                                                <Pin className="h-3 w-3 shrink-0 text-foreground/30" />
                                                            )}
                                                        </div>
                                                        <div className="mt-0.5 flex items-center gap-2">
                                                            <span className="truncate text-xs text-foreground/50">
                                                                {conn.preview}
                                                            </span>
                                                            <span className="shrink-0 text-xs text-foreground/30">
                                                                {getRelativeTime(
                                                                    conn.lastActive
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-foreground/50">
                                            No connections found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Right side - just user button */}
            <div className="flex shrink-0 items-center gap-3">
                <OptionalUserButton />
            </div>
        </header>
    );
}
