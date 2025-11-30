"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

import { useOptionalUser } from "@/lib/hooks/use-optional-user";

const DEBUG_WELCOMED_KEY = "carmenta-debug-welcomed";

/**
 * Subscribe to URL search params (no-op since we only read once on mount)
 */
function subscribeToUrl(_callback: () => void) {
    // URL doesn't change without navigation, so we don't need to subscribe
    return () => {};
}

/**
 * Get the current debug param state from URL
 */
function getUrlDebugSnapshot(): boolean {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("debug");
}

/**
 * Server snapshot for SSR
 */
function getServerUrlDebugSnapshot(): boolean {
    return false;
}

/**
 * Determine if current user should see debug/admin features.
 *
 * Access granted if:
 * - User has admin role in Clerk metadata
 * - Running in development environment
 * - URL has ?debug param
 */
export function useIsAdmin(): boolean {
    const { user } = useOptionalUser();
    const urlDebug = useSyncExternalStore(
        subscribeToUrl,
        getUrlDebugSnapshot,
        getServerUrlDebugSnapshot
    );

    // Development environment
    if (process.env.NODE_ENV === "development") {
        return true;
    }

    // Admin role from Clerk metadata
    if (user?.publicMetadata?.role === "admin") {
        return true;
    }

    // URL param for testing
    return urlDebug;
}

/**
 * Get initial welcome state from session storage
 */
function getInitialWelcomeState(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const welcomed = sessionStorage.getItem(DEBUG_WELCOMED_KEY);
        return !welcomed;
    } catch {
        return false;
    }
}

/**
 * Check if this is the first time debug mode is being viewed this session.
 * Returns true only once per session (for the easter egg).
 */
export function useDebugWelcome(): {
    showWelcome: boolean;
    dismissWelcome: () => void;
} {
    const [showWelcome, setShowWelcome] = useState(getInitialWelcomeState);

    const dismissWelcome = useCallback(() => {
        setShowWelcome(false);
        try {
            sessionStorage.setItem(DEBUG_WELCOMED_KEY, "true");
        } catch {
            // Session storage unavailable
        }
    }, []);

    return { showWelcome, dismissWelcome };
}
