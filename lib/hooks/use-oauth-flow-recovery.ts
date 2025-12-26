/**
 * OAuth Flow Recovery Hook
 *
 * Tracks OAuth attempts in sessionStorage and detects abandoned flows.
 * When a user starts an OAuth flow and returns without completing it,
 * this hook detects the abandoned state and enables graceful recovery.
 *
 * Why this exists: OAuth flows redirect users away from our app. If they
 * back out (browser back, close tab, deny access), we need to detect that
 * and let them retry without stuck UI states.
 */

import { useState, useEffect, useCallback } from "react";
import { getServiceById } from "@/lib/integrations/services";

const OAUTH_PENDING_KEY = "carmenta:oauth_pending";

interface OAuthPendingState {
    service: string;
    startedAt: number;
}

interface UseOAuthFlowRecoveryResult {
    /** Service ID that was abandoned (if any) */
    abandonedService: string | null;
    /** Human-readable name of the abandoned service */
    abandonedServiceName: string | null;
    /** Call when starting a new OAuth flow (before redirect) */
    markOAuthStarted: (service: string) => void;
    /** Call when OAuth completes (success or handled error) */
    markOAuthComplete: () => void;
    /** Dismiss the recovery prompt without retrying */
    dismissRecovery: () => void;
    /** Retry the abandoned OAuth flow */
    retryOAuth: () => void;
}

/**
 * Reads abandoned OAuth state from sessionStorage without triggering re-renders.
 * Returns the service ID if found and older than threshold, null otherwise.
 */
function getAbandonedServiceFromStorage(): string | null {
    try {
        const stored = sessionStorage.getItem(OAUTH_PENDING_KEY);
        if (!stored) return null;

        const pending: OAuthPendingState = JSON.parse(stored);
        const elapsed = Date.now() - pending.startedAt;

        // If the OAuth attempt is more than 2 seconds old, it's abandoned
        // (redirects happen faster than that)
        if (elapsed > 2000) {
            return pending.service;
        }
        return null;
    } catch {
        // Invalid storage state - clean it up
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        return null;
    }
}

export function useOAuthFlowRecovery(): UseOAuthFlowRecoveryResult {
    // Initialize state from sessionStorage to avoid flash of no content
    const [abandonedService, setAbandonedService] = useState<string | null>(() =>
        typeof window !== "undefined" ? getAbandonedServiceFromStorage() : null
    );
    // Re-check storage when page becomes visible or gains focus
    // (user returns from OAuth tab/window)
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const checkStorage = () => {
            const abandoned = getAbandonedServiceFromStorage();
            setAbandonedService(abandoned);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // Small delay to let any in-progress redirects complete
                timeoutId = setTimeout(checkStorage, 300);
            }
        };

        const handleFocus = () => {
            timeoutId = setTimeout(checkStorage, 300);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);

        return () => {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    const markOAuthStarted = useCallback((service: string) => {
        const state: OAuthPendingState = {
            service,
            startedAt: Date.now(),
        };
        sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(state));
        setAbandonedService(null);
    }, []);

    const markOAuthComplete = useCallback(() => {
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        setAbandonedService(null);
    }, []);

    const dismissRecovery = useCallback(() => {
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        setAbandonedService(null);
    }, []);

    const retryOAuth = useCallback(() => {
        // Read fresh from storage instead of using captured abandonedService
        // to avoid stale closure if sessionStorage is modified externally
        const freshService = getAbandonedServiceFromStorage();
        if (freshService) {
            // Clear old state
            sessionStorage.removeItem(OAUTH_PENDING_KEY);
            // Mark new attempt
            const state: OAuthPendingState = {
                service: freshService,
                startedAt: Date.now(),
            };
            sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(state));
            // Redirect to OAuth
            window.location.href = `/connect/${freshService}`;
        }
    }, []); // No dependency on abandonedService - reads fresh from storage

    const abandonedServiceName = abandonedService
        ? (getServiceById(abandonedService)?.name ?? abandonedService)
        : null;

    return {
        abandonedService,
        abandonedServiceName,
        markOAuthStarted,
        markOAuthComplete,
        dismissRecovery,
        retryOAuth,
    };
}
