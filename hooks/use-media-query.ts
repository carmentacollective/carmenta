/**
 * useMediaQuery Hook
 *
 * Reactive media query matching for responsive components.
 */

import { useSyncExternalStore } from "react";

/**
 * Hook for responsive breakpoint detection
 *
 * Uses useSyncExternalStore for proper SSR hydration and avoids
 * the cascading render issue of calling setState in effects.
 *
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if the query matches
 *
 * @example
 * ```tsx
 * const isDesktop = useMediaQuery("(min-width: 768px)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = (callback: () => void) => {
        const mediaQuery = window.matchMedia(query);
        mediaQuery.addEventListener("change", callback);
        return () => mediaQuery.removeEventListener("change", callback);
    };

    const getSnapshot = () => {
        return window.matchMedia(query).matches;
    };

    const getServerSnapshot = () => {
        // Default to false on server (mobile-first)
        return false;
    };

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
