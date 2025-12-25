"use client";

import { useEffect, useState, useRef } from "react";
import { X, Home } from "lucide-react";
import { logger } from "@/lib/client-logger";

/**
 * PWA Install Prompt
 *
 * Shows a prompt to install Carmenta as a PWA only when conditions are right:
 * - iOS Safari on mobile device
 * - After 3rd visit to the site (tracked per session to avoid double-counting)
 * - User has shown meaningful engagement (15s dwell time OR scroll OR interaction)
 * - Not already installed (not in standalone mode)
 * - User hasn't previously dismissed it
 * - Not on desktop
 *
 * The prompt uses the browser's native beforeinstallprompt event when available
 * (Chrome/Edge) or shows manual instructions for iOS Safari.
 *
 * Design follows iOS patterns: smooth animations, proper touch targets (44x44px),
 * safe area insets, and native gesture support.
 */

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const VISIT_COUNT_KEY = "carmenta-visit-count";
const SESSION_COUNTED_KEY = "carmenta-session-counted";
const DISMISSED_KEY = "pwa-install-dismissed";
const MIN_VISITS_REQUIRED = 3;
const ENGAGEMENT_DELAY_MS = 15000; // 15 seconds of dwell time

export function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [hasEngaged, setHasEngaged] = useState(false);
    const engagementTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Track visit count once per session to avoid double-counting on remounts
        const sessionCounted = sessionStorage.getItem(SESSION_COUNTED_KEY);
        if (!sessionCounted) {
            const visitCount = parseInt(
                localStorage.getItem(VISIT_COUNT_KEY) || "0",
                10
            );
            const newVisitCount = visitCount + 1;
            localStorage.setItem(VISIT_COUNT_KEY, newVisitCount.toString());
            sessionStorage.setItem(SESSION_COUNTED_KEY, "true");
            logger.info({ visitCount: newVisitCount }, "Tracking PWA visit count");
        }

        // Check if all conditions are met to show the prompt
        const shouldShowPrompt = (): boolean => {
            // Don't show if user already dismissed it
            if (localStorage.getItem(DISMISSED_KEY) === "true") {
                logger.debug({}, "PWA install prompt dismissed by user previously");
                return false;
            }

            // Check if already installed (running in standalone mode)
            const isStandalone =
                window.matchMedia("(display-mode: standalone)").matches ||
                (window.navigator as Navigator & { standalone?: boolean }).standalone ||
                document.referrer.includes("android-app://");

            if (isStandalone) {
                logger.debug({}, "PWA already installed");
                return false;
            }

            // Detect iOS Safari
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isSafari =
                /Safari/.test(navigator.userAgent) &&
                !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);

            // Check if mobile device (viewport width)
            const isMobile = window.innerWidth <= 768;

            if (!isIOS || !isSafari || !isMobile) {
                logger.debug(
                    { isIOS, isSafari, isMobile },
                    "Not iOS Safari mobile - skipping install prompt"
                );
                return false;
            }

            // Check visit count
            const visitCount = parseInt(
                localStorage.getItem(VISIT_COUNT_KEY) || "0",
                10
            );

            // Only show on 3rd visit or later
            if (visitCount < MIN_VISITS_REQUIRED) {
                logger.debug(
                    { visitCount, required: MIN_VISITS_REQUIRED },
                    "Not enough visits yet for install prompt"
                );
                return false;
            }

            return true;
        };

        // Handle the beforeinstallprompt event (Chrome/Edge)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            setDeferredPrompt(promptEvent);

            if (shouldShowPrompt()) {
                setShowPrompt(true);
                logger.info({}, "Showing PWA install prompt");
            }
        };

        // Track user engagement before showing prompt
        const trackEngagement = () => {
            setHasEngaged(true);
            logger.debug({}, "User engagement detected");
        };

        // Listen for engagement signals
        const engagementEvents = ["scroll", "click", "touchstart"];
        engagementEvents.forEach((event) => {
            window.addEventListener(event, trackEngagement, { once: true });
        });

        // Also consider time-based engagement (15 seconds dwell time)
        engagementTimerRef.current = setTimeout(() => {
            setHasEngaged(true);
            logger.debug({}, "Engagement detected via dwell time");
        }, ENGAGEMENT_DELAY_MS);

        // For iOS Safari, we can't intercept the install prompt,
        // so we show our custom UI with instructions after engagement
        if (shouldShowPrompt()) {
            // Wait for engagement before showing
            const checkEngagement = setInterval(() => {
                if (hasEngaged) {
                    clearInterval(checkEngagement);
                    setShowPrompt(true);
                    logger.info(
                        {},
                        "Showing PWA install prompt for iOS after engagement"
                    );
                }
            }, 500);

            // Cleanup
            return () => {
                clearInterval(checkEngagement);
                if (engagementTimerRef.current) {
                    clearTimeout(engagementTimerRef.current);
                }
                engagementEvents.forEach((event) => {
                    window.removeEventListener(event, trackEngagement);
                });
            };
        }

        // Listen for beforeinstallprompt event (Chrome/Edge)
        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
            if (engagementTimerRef.current) {
                clearTimeout(engagementTimerRef.current);
            }
            engagementEvents.forEach((event) => {
                window.removeEventListener(event, trackEngagement);
            });
        };
    }, [hasEngaged]);

    const handleInstall = async () => {
        if (deferredPrompt) {
            // Chrome/Edge path - use native prompt
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            logger.info({ outcome }, "PWA install prompt result");

            if (outcome === "accepted") {
                setShowPrompt(false);
            }

            setDeferredPrompt(null);
        }

        // For iOS, we can't programmatically trigger installation,
        // the user needs to use Share > Add to Home Screen
        // Our UI provides instructions
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, "true");
        setShowPrompt(false);
        logger.info({}, "PWA install prompt dismissed");
    };

    if (!showPrompt) {
        return null;
    }

    return (
        <div className="pb-safe fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm duration-300 animate-in fade-in-0">
            <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-2xl duration-300 animate-in slide-in-from-bottom-4 dark:from-gray-900 dark:to-gray-800">
                {/* Close button - 44x44px touch target for iOS */}
                <button
                    onClick={handleDismiss}
                    className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-95 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    aria-label="Dismiss install prompt"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* App Icon */}
                <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                        <Home className="h-8 w-8 text-white" />
                    </div>
                </div>

                {/* Content */}
                <div className="text-center">
                    <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                        Add Carmenta to Home
                    </h2>
                    <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                        Install for faster access, offline support, and a native app
                        experience.
                    </p>

                    {/* iOS Instructions */}
                    <div className="mb-6 rounded-lg bg-white p-4 dark:bg-gray-800/50">
                        <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                            To install on iOS:
                        </p>
                        <ol className="space-y-1 text-left text-xs text-gray-600 dark:text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="text-gray-400">•</span>
                                <span>
                                    Tap the Share button (square with arrow) at the
                                    bottom
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-400">•</span>
                                <span>
                                    Scroll and tap &quot;Add to Home Screen&quot;
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-400">•</span>
                                <span>Tap &quot;Add&quot; in the top right</span>
                            </li>
                        </ol>
                    </div>

                    {/* Install Button (for Chrome/Edge) */}
                    {deferredPrompt && (
                        <button
                            onClick={handleInstall}
                            className="w-full rounded-full bg-gradient-to-r from-primary to-primary/80 px-6 py-3 font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-95"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Home className="h-5 w-5" />
                                Install
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
