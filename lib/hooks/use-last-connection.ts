/**
 * Last Connection Tracking
 *
 * Remembers the user's last active chat so they can return to it
 * from other pages (integrations, knowledge-base, etc.).
 *
 * This is especially important in PWA mode where the URL bar is hidden
 * and the browser back button isn't available.
 */

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "carmenta:last-connection";

/**
 * Subscribe to localStorage changes for the connection key.
 * Returns unsubscribe function.
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
 * Get the last connection from localStorage.
 * Returns a cached object if the underlying value hasn't changed.
 */
function getStoredConnection(): LastConnection | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);

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

        const parsed = JSON.parse(stored) as LastConnection;

        // Expire after 7 days of inactivity
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > SEVEN_DAYS) {
            localStorage.removeItem(STORAGE_KEY);
            cachedConnection = null;
            cachedRawValue = null;
            return null;
        }

        cachedConnection = parsed;
        return parsed;
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
        localStorage.setItem(STORAGE_KEY, value);
        // Dispatch storage event so useSyncExternalStore picks up the change
        window.dispatchEvent(
            new StorageEvent("storage", { key: STORAGE_KEY, newValue: value })
        );
    } catch {
        // localStorage might be unavailable
    }
}

/**
 * Clear the stored connection
 */
function clearStoredConnection(): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem(STORAGE_KEY);
        // Reset cache to prevent stale reads
        cachedConnection = null;
        cachedRawValue = null;
    } catch {
        // localStorage might be unavailable
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

    // Sync current connection to localStorage when it changes
    // This effect syncs to an external system (localStorage) without calling setState
    useEffect(() => {
        if (currentConnection?.id) {
            const stored = getStoredConnection();
            // Write if ID differs OR if title/slug changed for same connection
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
        isOnConnectionPage && lastConnection && pathname?.includes(lastConnection.id);

    const shouldShowReturn =
        lastConnection !== null && !isOnSameConnection && !isOnConnectionPage;

    const clearLastConnection = useCallback(() => {
        if (typeof window === "undefined") return;

        clearStoredConnection();
        // Dispatch storage event so useSyncExternalStore picks up the change
        window.dispatchEvent(
            new StorageEvent("storage", { key: STORAGE_KEY, newValue: null })
        );
    }, []);

    return {
        lastConnection,
        returnUrl,
        isOnConnectionPage,
        shouldShowReturn,
        clearLastConnection,
    };
}
