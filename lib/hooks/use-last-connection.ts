/**
 * Last Connection Tracking (Session-Scoped)
 *
 * Remembers the user's active chat within a browser session so they can
 * return to it from other pages (integrations, knowledge-base, etc.).
 *
 * Uses sessionStorage for session-scoped persistence:
 * - Survives page refreshes and navigation within the tab
 * - Clears when the tab/window closes
 * - Each tab has its own independent session
 *
 * This matches user expectations: opening Carmenta fresh = clean slate.
 * Users who want yesterday's chats can find them in the connection list.
 */

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

const STORAGE_KEY = "carmenta:last-connection";

/**
 * Subscribe to storage changes for the connection key.
 * sessionStorage is tab-isolated, so StorageEvent from other tabs won't fire.
 * We use manual dispatch for in-tab updates to trigger useSyncExternalStore.
 */
function subscribeToStorage(callback: () => void): () => void {
    const handleStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
            callback();
        }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
}

/**
 * Empty subscribe for SSR - no-op since there's no window
 */
function subscribeToStorageServer(): () => void {
    return () => {};
}

export interface LastConnection {
    id: string;
    slug: string;
    title: string | null;
    timestamp: number;
}

/**
 * Cache for useSyncExternalStore to avoid infinite loops.
 * useSyncExternalStore compares by reference, so we need to return
 * the same object if the underlying data hasn't changed.
 */
let cachedConnection: LastConnection | null = null;
let cachedRawValue: string | null = null;

/**
 * Get the last connection from sessionStorage.
 * Returns a cached object if the underlying value hasn't changed.
 *
 * No expiration logic needed - sessionStorage clears when the tab closes,
 * which is the desired session-scoped behavior.
 */
function getStoredConnection(): LastConnection | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);

        // Return cached value if raw storage hasn't changed
        if (stored === cachedRawValue) {
            return cachedConnection;
        }

        // Update cache
        cachedRawValue = stored;

        if (!stored) {
            cachedConnection = null;
            return null;
        }

        const parsed = JSON.parse(stored);

        // Validate shape before using - corrupted data should be discarded
        if (
            !parsed ||
            typeof parsed.id !== "string" ||
            typeof parsed.slug !== "string" ||
            typeof parsed.timestamp !== "number" ||
            (parsed.title !== null && typeof parsed.title !== "string")
        ) {
            sessionStorage.removeItem(STORAGE_KEY);
            cachedConnection = null;
            cachedRawValue = null;
            return null;
        }

        cachedConnection = parsed as LastConnection;
        return cachedConnection;
    } catch {
        cachedConnection = null;
        cachedRawValue = null;
        return null;
    }
}

/**
 * Store a connection as the last visited
 */
function storeConnection(connection: Omit<LastConnection, "timestamp">): void {
    if (typeof window === "undefined") return;

    try {
        const data: LastConnection = {
            ...connection,
            timestamp: Date.now(),
        };
        const value = JSON.stringify(data);
        sessionStorage.setItem(STORAGE_KEY, value);
        // Update cache immediately to prevent stale reads
        cachedRawValue = value;
        cachedConnection = data;
        // Dispatch storage event so useSyncExternalStore picks up the change
        try {
            window.dispatchEvent(
                new StorageEvent("storage", { key: STORAGE_KEY, newValue: value })
            );
        } catch (error) {
            // Storage event dispatch failed - UI will update on next page load
            // This is non-critical since the data IS persisted
            Sentry.captureException(error, {
                level: "warning",
                tags: { component: "last-connection", action: "store-event-dispatch" },
            });
        }
    } catch {
        // sessionStorage might be unavailable
    }
}

/**
 * Clear the stored connection
 */
function clearStoredConnection(): void {
    if (typeof window === "undefined") return;

    try {
        sessionStorage.removeItem(STORAGE_KEY);
        // Reset cache to prevent stale reads
        cachedConnection = null;
        cachedRawValue = null;
    } catch {
        // sessionStorage might be unavailable
    }
}

interface UseLastConnectionOptions {
    /**
     * Current connection info to store (when on a chat page)
     */
    currentConnection?: {
        id: string;
        slug: string;
        title: string | null;
    } | null;
}

interface UseLastConnectionReturn {
    /**
     * The last connection the user was in (if any)
     */
    lastConnection: LastConnection | null;

    /**
     * URL to return to the last connection
     */
    returnUrl: string | null;

    /**
     * Whether we're currently on a connection page
     */
    isOnConnectionPage: boolean;

    /**
     * Whether we should show the return navigation
     * (true when there's a last connection and we're not on that page)
     */
    shouldShowReturn: boolean;

    /**
     * Clear the last connection (e.g., when user starts a new chat)
     */
    clearLastConnection: () => void;
}

/**
 * Track and restore the user's last active connection.
 *
 * Usage in ConnectLayout:
 * ```tsx
 * useLastConnection({
 *   currentConnection: activeConnection ? {
 *     id: activeConnection.id,
 *     slug: activeConnection.slug,
 *     title: activeConnection.title,
 *   } : null,
 * });
 * ```
 *
 * Usage in SiteHeader:
 * ```tsx
 * const { lastConnection, returnUrl, shouldShowReturn } = useLastConnection({});
 * if (shouldShowReturn && returnUrl) {
 *   return <Link href={returnUrl}>{lastConnection.title}</Link>
 * }
 * ```
 */
export function useLastConnection({
    currentConnection,
}: UseLastConnectionOptions = {}): UseLastConnectionReturn {
    const pathname = usePathname();

    // Use useSyncExternalStore for proper SSR hydration and localStorage sync
    const lastConnection = useSyncExternalStore(
        typeof window === "undefined" ? subscribeToStorageServer : subscribeToStorage,
        getStoredConnection,
        () => null // Server snapshot
    );

    // Check if we're on a connection page
    const isOnConnectionPage = pathname?.startsWith("/connection") ?? false;

    // Sync current connection to sessionStorage when it changes
    useEffect(() => {
        if (currentConnection?.id) {
            const stored = getStoredConnection();
            // Update when connection data changes (ID, title, or slug)
            const needsUpdate =
                stored?.id !== currentConnection.id ||
                stored?.title !== currentConnection.title ||
                stored?.slug !== currentConnection.slug;

            if (needsUpdate) {
                storeConnection({
                    id: currentConnection.id,
                    slug: currentConnection.slug,
                    title: currentConnection.title,
                });
            }
        }
    }, [currentConnection?.id, currentConnection?.slug, currentConnection?.title]);

    // Build return URL
    const returnUrl = lastConnection
        ? `/connection/${lastConnection.slug}/${lastConnection.id}`
        : null;

    // Should we show the return nav?
    // Yes if: there's a last connection AND we're not currently on that connection
    const isOnSameConnection =
        isOnConnectionPage &&
        lastConnection &&
        pathname === `/connection/${lastConnection.slug}/${lastConnection.id}`;

    const shouldShowReturn =
        lastConnection !== null && !isOnSameConnection && !isOnConnectionPage;

    const clearLastConnection = useCallback(() => {
        if (typeof window === "undefined") return;

        clearStoredConnection();
        // Dispatch storage event so useSyncExternalStore picks up the change
        try {
            window.dispatchEvent(
                new StorageEvent("storage", { key: STORAGE_KEY, newValue: null })
            );
        } catch (error) {
            // Storage event dispatch failed - UI will update on next page load
            // This is non-critical since the data IS cleared
            Sentry.captureException(error, {
                level: "warning",
                tags: { component: "last-connection", action: "clear-event-dispatch" },
            });
        }
    }, []);

    return {
        lastConnection,
        returnUrl,
        isOnConnectionPage,
        shouldShowReturn,
        clearLastConnection,
    };
}
