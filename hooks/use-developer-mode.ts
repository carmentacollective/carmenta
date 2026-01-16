"use client";

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "carmenta:developer-mode";

/**
 * Read developer mode from localStorage safely.
 */
function getSnapshot(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
        // localStorage unavailable (e.g., private browsing)
        return false;
    }
}

/**
 * SSR fallback - default to false on server.
 */
function getServerSnapshot(): boolean {
    return false;
}

/**
 * Subscribe to storage events for cross-tab sync.
 */
function subscribe(callback: () => void): () => void {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

/**
 * Hook to manage developer mode state from localStorage.
 * Handles localStorage unavailability gracefully (e.g., private browsing).
 * Syncs across tabs via storage events.
 */
export function useDeveloperMode(): [boolean, (value: boolean) => void] {
    const developerMode = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );

    const setDeveloperMode = useCallback((value: boolean) => {
        try {
            localStorage.setItem(STORAGE_KEY, String(value));
            // Dispatch storage event for same-tab reactivity
            window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
        } catch {
            // localStorage unavailable (e.g., private browsing)
        }
    }, []);

    return [developerMode, setDeveloperMode];
}
