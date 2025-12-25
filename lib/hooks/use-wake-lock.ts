/**
 * Screen Wake Lock Hook
 *
 * Prevents the screen from dimming/locking during active use.
 * Perfect for long AI responses or active conversations.
 *
 * Features:
 * - Acquires wake lock when requested
 * - Auto-releases on component unmount
 * - Re-acquires on visibility change (tab focus)
 * - Graceful fallback when not supported
 * - No permissions required (auto-granted for user-gesture-triggered)
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/client-logger";

export interface UseWakeLockOptions {
    /** Whether to acquire wake lock immediately (default: false) */
    enabled?: boolean;
}

export interface UseWakeLockReturn {
    /** Whether wake lock is currently active */
    isLocked: boolean;
    /** Whether wake lock API is supported */
    isSupported: boolean;
    /** Request wake lock */
    requestWakeLock: () => Promise<boolean>;
    /** Release wake lock */
    releaseWakeLock: () => Promise<void>;
}

// Check wake lock support
function checkWakeLockSupport(): boolean {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export function useWakeLock({
    enabled = false,
}: UseWakeLockOptions = {}): UseWakeLockReturn {
    const [isLocked, setIsLocked] = useState(false);
    // Initialize with computed value to avoid setState in effect
    const isSupported = checkWakeLockSupport();
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Log support status on mount
    useEffect(() => {
        if (!isSupported) {
            logger.debug({}, "🔒 Screen Wake Lock API not supported");
        }
    }, [isSupported]);

    // Request wake lock
    const requestWakeLock = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        try {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
            setIsLocked(true);

            logger.debug({}, "🔒 Screen wake lock acquired");

            // Handle release (e.g., when tab loses focus)
            wakeLockRef.current.addEventListener("release", () => {
                setIsLocked(false);
                logger.debug({}, "🔓 Screen wake lock released");
            });

            return true;
        } catch (error) {
            // Wake lock can fail if document is not visible
            logger.debug({ error }, "🔒 Failed to acquire wake lock");
            return false;
        }
    }, [isSupported]);

    // Release wake lock
    const releaseWakeLock = useCallback(async (): Promise<void> => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
            setIsLocked(false);
        }
    }, []);

    // Auto-acquire when enabled changes to true
    // Using void async IIFE since wake lock API is async
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            if (enabled && isSupported && !isLocked) {
                const acquired = await requestWakeLock();
                if (cancelled) return;
                // State is set inside requestWakeLock after async operation
                if (!acquired) {
                    logger.debug(
                        {},
                        "🔒 Wake lock not acquired (may retry on visibility)"
                    );
                }
            } else if (!enabled && isLocked) {
                await releaseWakeLock();
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, isSupported, isLocked, requestWakeLock, releaseWakeLock]);

    // Re-acquire wake lock when page becomes visible again
    useEffect(() => {
        if (!enabled || !isSupported) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible" && !isLocked) {
                requestWakeLock();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [enabled, isSupported, isLocked, requestWakeLock]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
            }
        };
    }, []);

    return {
        isLocked,
        isSupported,
        requestWakeLock,
        releaseWakeLock,
    };
}
