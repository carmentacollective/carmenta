/**
 * PWA Install Prompt Hook
 *
 * Captures the beforeinstallprompt event and provides a controlled way
 * to show the native install prompt at the right moment.
 *
 * Features:
 * - Captures deferred install prompt
 * - Tracks whether app is already installed
 * - Provides install trigger function
 * - Tracks install outcome for analytics
 * - No additional permissions required
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { logger } from "@/lib/client-logger";

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export interface UseInstallPromptReturn {
    /** Whether the install prompt is available (browser supports and app not installed) */
    canInstall: boolean;
    /** Whether the app is already installed as PWA */
    isInstalled: boolean;
    /** Trigger the native install prompt */
    promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
    /** Whether install prompt has been shown this session */
    hasPrompted: boolean;
}

// Check if app is running in standalone/installed mode
function checkIsInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error - iOS Safari specific
        window.navigator.standalone === true
    );
}

export function useInstallPrompt(): UseInstallPromptReturn {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    // Initialize with computed value to avoid setState in effect
    const [isInstalled, setIsInstalled] = useState(checkIsInstalled);
    const [hasPrompted, setHasPrompted] = useState(false);

    // Log on mount if installed
    useEffect(() => {
        if (isInstalled) {
            logger.debug({}, "🏠 App is running in installed PWA mode");
        }
    }, [isInstalled]);

    // Capture the beforeinstallprompt event
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            // Store the event for later use
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            logger.info({}, "📲 Install prompt captured and deferred");
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsInstalled(true);
            logger.info({}, "🎉 App was installed");
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const promptInstall = useCallback(async (): Promise<
        "accepted" | "dismissed" | "unavailable"
    > => {
        if (!deferredPrompt) {
            logger.debug({}, "📲 Install prompt not available");
            return "unavailable";
        }

        setHasPrompted(true);

        try {
            // Show the native install prompt
            await deferredPrompt.prompt();

            // Wait for user response
            const { outcome } = await deferredPrompt.userChoice;

            logger.info({ outcome }, "📲 Install prompt outcome");

            // Clear the prompt - it can only be used once
            setDeferredPrompt(null);

            if (outcome === "accepted") {
                setIsInstalled(true);
            }

            return outcome;
        } catch (error) {
            logger.error({ error }, "📲 Install prompt failed");
            return "unavailable";
        }
    }, [deferredPrompt]);

    return {
        canInstall: !!deferredPrompt && !isInstalled,
        isInstalled,
        promptInstall,
        hasPrompted,
    };
}
