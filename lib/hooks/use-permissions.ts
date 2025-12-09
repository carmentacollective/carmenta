"use client";

import { useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

const DEBUG_WELCOMED_KEY = "carmenta-debug-welcomed";

/**
 * Hook to check user permissions from Clerk metadata
 *
 * Permissions are explicitly defined in Clerk's publicMetadata:
 * - isAdmin: General admin access (debug features, admin panels, etc.)
 * - showBetaIntegrations: Can see and connect beta integrations
 * - showInternalIntegrations: Can see and connect internal integrations (Gmail, etc.)
 *
 * Development mode: All permissions default to true for testing
 * Production mode: Checks actual Clerk metadata
 *
 * @returns Object with permission flags
 */
export function usePermissions() {
    const { user } = useUser();

    // Development mode - all permissions enabled for testing
    if (process.env.NODE_ENV === "development") {
        return {
            isAdmin: true,
            showBetaIntegrations: true,
            showInternalIntegrations: true,
        };
    }

    // Production mode - check Clerk metadata
    return {
        isAdmin: user?.publicMetadata?.role === "admin",
        showBetaIntegrations: user?.publicMetadata?.showBetaIntegrations === true,
        showInternalIntegrations:
            user?.publicMetadata?.showInternalIntegrations === true,
    };
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
