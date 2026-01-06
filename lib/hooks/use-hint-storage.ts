"use client";

/**
 * Centralized hint storage for progressive disclosure
 *
 * Tracks "seen" state for tooltips, onboarding hints, and feature callouts.
 * Uses localStorage with consistent namespace and SSR-safe access.
 *
 * Design principles:
 * - Show hints while users are learning, then get out of the way
 * - Configurable max shows (default 3)
 * - Clean namespace: carmenta:hint:{key}
 * - SSR-safe with hydration handling
 */

import { useCallback, useSyncExternalStore } from "react";

const HINT_PREFIX = "carmenta:hint:";

interface HintState {
    /** Number of times hint has been shown */
    seenCount: number;
    /** Unix timestamp of first show */
    firstSeenAt: number;
    /** Unix timestamp of most recent show */
    lastSeenAt: number;
}

interface UseHintStorageOptions {
    /** Maximum times to show hint before hiding permanently (default: 3) */
    maxShows?: number;
    /** Expiration in days - reset hint after this many days (optional) */
    expiresAfterDays?: number;
}

/**
 * Read hint state from localStorage (SSR-safe)
 */
function getHintState(key: string): HintState | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = localStorage.getItem(`${HINT_PREFIX}${key}`);
        if (!stored) return null;

        const parsed = JSON.parse(stored);

        // Validate shape
        if (
            typeof parsed.seenCount !== "number" ||
            typeof parsed.firstSeenAt !== "number" ||
            typeof parsed.lastSeenAt !== "number"
        ) {
            // Corrupted data, remove it
            localStorage.removeItem(`${HINT_PREFIX}${key}`);
            return null;
        }

        return parsed as HintState;
    } catch {
        // JSON parse error - corrupted data
        localStorage.removeItem(`${HINT_PREFIX}${key}`);
        return null;
    }
}

/**
 * Write hint state to localStorage
 */
function setHintState(key: string, state: HintState): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(`${HINT_PREFIX}${key}`, JSON.stringify(state));
    } catch {
        // Quota exceeded or other error - fail silently
    }
}

/**
 * Hook for progressive disclosure hints
 *
 * @param key - Unique identifier for this hint
 * @param options - Configuration for max shows and expiration
 * @returns [shouldShow, markSeen] - Whether to show hint and function to mark it seen
 *
 * @example
 * ```tsx
 * const [showHint, markSeen] = useHintStorage("creativity-slider", { maxShows: 3 });
 *
 * return (
 *   <>
 *     <Slider />
 *     {showHint && (
 *       <OnboardingHint onDismiss={markSeen}>
 *         Creativity controls how adventurous we get with responses
 *       </OnboardingHint>
 *     )}
 *   </>
 * );
 * ```
 */
/**
 * Cache for useSyncExternalStore to avoid infinite loops.
 * Keyed by hint key + options to support multiple hooks with different configurations.
 */
const hintCache = new Map<
    string,
    { value: boolean; raw: string | null; maxShows: number; expiresAfterDays?: number }
>();

/**
 * Generate cache key including options to prevent sharing cached values
 * between hooks with different configurations
 */
function getCacheKey(key: string, maxShows: number, expiresAfterDays?: number): string {
    return `${key}:${maxShows}:${expiresAfterDays ?? "none"}`;
}

/**
 * Subscribe to storage changes for a specific hint key
 */
function createSubscribe(key: string) {
    return (callback: () => void): (() => void) => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === `${HINT_PREFIX}${key}`) {
                callback();
            }
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    };
}

/**
 * Create a snapshot getter for a specific hint configuration
 */
function createGetSnapshot(key: string, maxShows: number, expiresAfterDays?: number) {
    return (): boolean => {
        if (typeof window === "undefined") return false;

        const state = getHintState(key);
        const rawValue = localStorage.getItem(`${HINT_PREFIX}${key}`);
        const cacheKey = getCacheKey(key, maxShows, expiresAfterDays);

        // Check cache
        const cached = hintCache.get(cacheKey);
        if (
            cached &&
            cached.raw === rawValue &&
            cached.maxShows === maxShows &&
            cached.expiresAfterDays === expiresAfterDays
        ) {
            return cached.value;
        }

        // Compute new value
        let shouldShow = true;

        if (state) {
            // Check expiration
            if (expiresAfterDays) {
                const expirationMs = expiresAfterDays * 24 * 60 * 60 * 1000;
                if (Date.now() - state.lastSeenAt > expirationMs) {
                    // Expired - reset storage
                    localStorage.removeItem(`${HINT_PREFIX}${key}`);
                    shouldShow = true;
                } else {
                    shouldShow = state.seenCount < maxShows;
                }
            } else {
                shouldShow = state.seenCount < maxShows;
            }
        }

        // Update cache
        hintCache.set(cacheKey, {
            value: shouldShow,
            raw: rawValue,
            maxShows,
            expiresAfterDays,
        });
        return shouldShow;
    };
}

/**
 * Server snapshot always returns false (no hints during SSR)
 */
function getServerSnapshot(): boolean {
    return false;
}

/**
 * Empty subscribe for SSR
 */
function subscribeServer(): () => void {
    return () => {};
}

export function useHintStorage(
    key: string,
    options: UseHintStorageOptions = {}
): [boolean, () => void] {
    const { maxShows = 3, expiresAfterDays } = options;

    // Use useSyncExternalStore for SSR-safe localStorage access
    const shouldShow = useSyncExternalStore(
        typeof window !== "undefined" ? createSubscribe(key) : subscribeServer,
        createGetSnapshot(key, maxShows, expiresAfterDays),
        getServerSnapshot
    );

    // Mark hint as seen
    const markSeen = useCallback(() => {
        const now = Date.now();
        const existing = getHintState(key);

        const newState: HintState = existing
            ? {
                  seenCount: existing.seenCount + 1,
                  firstSeenAt: existing.firstSeenAt,
                  lastSeenAt: now,
              }
            : {
                  seenCount: 1,
                  firstSeenAt: now,
                  lastSeenAt: now,
              };

        setHintState(key, newState);

        // Invalidate cache to trigger re-render (clear all cache entries for this key)
        const cacheKey = getCacheKey(key, maxShows, expiresAfterDays);
        hintCache.delete(cacheKey);

        // Dispatch storage event to notify other tabs and trigger re-render
        window.dispatchEvent(
            new StorageEvent("storage", {
                key: `${HINT_PREFIX}${key}`,
                newValue: JSON.stringify(newState),
            })
        );
    }, [key, maxShows, expiresAfterDays]);

    return [shouldShow, markSeen];
}

/**
 * Check if a hint should be shown (non-hook version for one-off checks)
 */
export function shouldShowHint(
    key: string,
    options: UseHintStorageOptions = {}
): boolean {
    const { maxShows = 3, expiresAfterDays } = options;
    const state = getHintState(key);

    if (!state) return true;

    // Check expiration
    if (expiresAfterDays) {
        const expirationMs = expiresAfterDays * 24 * 60 * 60 * 1000;
        if (Date.now() - state.lastSeenAt > expirationMs) {
            return true;
        }
    }

    return state.seenCount < maxShows;
}

/**
 * Mark a hint as seen (non-hook version)
 */
export function markHintSeen(key: string): void {
    const now = Date.now();
    const existing = getHintState(key);

    const newState: HintState = existing
        ? {
              seenCount: existing.seenCount + 1,
              firstSeenAt: existing.firstSeenAt,
              lastSeenAt: now,
          }
        : {
              seenCount: 1,
              firstSeenAt: now,
              lastSeenAt: now,
          };

    setHintState(key, newState);
}

/**
 * Reset a hint (for testing or user-requested reset)
 */
export function resetHint(key: string): void {
    if (typeof window === "undefined") return;

    localStorage.removeItem(`${HINT_PREFIX}${key}`);

    // Invalidate all cache entries for this key (all option combinations)
    const keysToDelete: string[] = [];
    hintCache.forEach((_, cacheKey) => {
        if (cacheKey.startsWith(`${key}:`)) {
            keysToDelete.push(cacheKey);
        }
    });
    keysToDelete.forEach((cacheKey) => hintCache.delete(cacheKey));

    // Dispatch storage event to notify hooks
    window.dispatchEvent(
        new StorageEvent("storage", {
            key: `${HINT_PREFIX}${key}`,
            newValue: null,
        })
    );
}

/**
 * Reset all hints (for testing or settings)
 */
export function resetAllHints(): void {
    if (typeof window === "undefined") return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(HINT_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear all cache entries
    hintCache.clear();

    // Dispatch storage events for all removed keys
    keysToRemove.forEach((key) => {
        window.dispatchEvent(
            new StorageEvent("storage", {
                key,
                newValue: null,
            })
        );
    });
}
