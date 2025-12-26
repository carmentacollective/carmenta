import { useSyncExternalStore } from "react";

/**
 * Hook to detect if a media query matches
 *
 * @param query - Media query string (e.g., "(max-width: 767px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = (callback: () => void) => {
        const mediaQuery = window.matchMedia(query);
        mediaQuery.addEventListener("change", callback);
        return () => mediaQuery.removeEventListener("change", callback);
    };

    const getSnapshot = () => window.matchMedia(query).matches;

    // Server-side returns false (assumes desktop)
    const getServerSnapshot = () => false;

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
