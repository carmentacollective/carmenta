/**
 * PWA Install Prompt Component
 *
 * Shows a beautiful, on-brand prompt encouraging users to install Carmenta.
 * Intelligently targets users when installation makes sense:
 * - iOS Safari mobile only (where PWA provides most value)
 * - After 3rd visit (user is engaged)
 * - After meaningful engagement (15s dwell OR scroll/click/touch)
 * - Not already installed
 * - Not previously dismissed
 *
 * Features:
 * - iOS Safari mobile-only targeting (no desktop interruption)
 * - Visit count tracking (3rd visit minimum)
 * - Engagement-based timing
 * - Dismissible with permanent snooze
 * - Manual iOS install instructions
 * - Tracks install outcome for analytics
 * - Carmenta voice and aesthetic
 * - Accessible with 44px touch targets
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, HouseIcon } from "@phosphor-icons/react";
import { logger } from "@/lib/client-logger";

const VISIT_COUNT_KEY = "carmenta-visit-count";
const SESSION_COUNTED_KEY = "carmenta-session-counted";
const DISMISSED_KEY = "pwa-install-dismissed";
const MIN_VISITS_REQUIRED = 3;
const ENGAGEMENT_DELAY_MS = 15000; // 15 seconds of dwell time

// Check if running on iOS Safari mobile
function isIOSSafariMobile(): boolean {
    if (typeof window === "undefined") return false;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari =
        /Safari/.test(navigator.userAgent) &&
        !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);
    const isMobile = window.innerWidth <= 768;

    return isIOS && isSafari && isMobile;
}

// Check if already installed (running in standalone mode)
function isAlreadyInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone ===
            true ||
        document.referrer.includes("android-app://")
    );
}

// Check initial eligibility (called once on mount via useState initializer)
function checkInitialEligibility(): boolean {
    if (typeof window === "undefined") return false;
    if (!isIOSSafariMobile()) return false;
    if (isAlreadyInstalled()) return false;
    if (localStorage.getItem(DISMISSED_KEY) === "true") return false;

    // Track visit count once per session
    const sessionCounted = sessionStorage.getItem(SESSION_COUNTED_KEY);
    if (!sessionCounted) {
        const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10);
        const newVisitCount = visitCount + 1;
        localStorage.setItem(VISIT_COUNT_KEY, newVisitCount.toString());
        sessionStorage.setItem(SESSION_COUNTED_KEY, "true");
        logger.info({ visitCount: newVisitCount }, "📲 Tracking PWA visit count");
    }

    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10);
    return visitCount >= MIN_VISITS_REQUIRED;
}

export function InstallPrompt() {
    // Initialize eligibility once on mount (no setState in effects)
    const [isEligible] = useState(checkInitialEligibility);
    const [hasEngaged, setHasEngaged] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const engagementTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Engagement tracking callback (stable reference)
    const trackEngagement = useCallback(() => {
        setHasEngaged(true);
        logger.debug({}, "📲 User engagement detected");
    }, []);

    // Set up engagement tracking only if eligible
    useEffect(() => {
        if (!isEligible) {
            logger.debug({}, "📲 Not eligible for install prompt");
            return;
        }

        // Listen for engagement signals
        const engagementEvents = ["scroll", "click", "touchstart"];
        engagementEvents.forEach((event) => {
            window.addEventListener(event, trackEngagement, { once: true });
        });

        // Time-based engagement (15 seconds dwell time)
        engagementTimerRef.current = setTimeout(() => {
            setHasEngaged(true);
            logger.debug({}, "📲 Engagement detected via dwell time");
        }, ENGAGEMENT_DELAY_MS);

        return () => {
            if (engagementTimerRef.current) {
                clearTimeout(engagementTimerRef.current);
            }
            engagementEvents.forEach((event) => {
                window.removeEventListener(event, trackEngagement);
            });
        };
    }, [isEligible, trackEngagement]);

    // Derive visibility from state
    const isVisible = isEligible && hasEngaged && !isDismissed;

    // Log when prompt becomes visible
    useEffect(() => {
        if (isVisible) {
            logger.info({}, "📲 Showing PWA install prompt for iOS after engagement");
        }
    }, [isVisible]);

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, "true");
        setIsDismissed(true);
        logger.info({}, "📲 Install prompt dismissed permanently");
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="z-modal fixed right-4 bottom-[max(5rem,calc(env(safe-area-inset-bottom)+1rem))] left-4 mx-auto max-w-sm"
                >
                    <div className="glass-card bg-background/95 overflow-hidden rounded-2xl border border-white/10 p-5 shadow-2xl backdrop-blur-xl">
                        {/* Dismiss button - 44px touch target (Apple HIG minimum) */}
                        <button
                            onClick={handleDismiss}
                            className="text-foreground/40 hover:bg-foreground/10 hover:text-foreground/60 absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-95"
                            aria-label="Dismiss install prompt"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>

                        {/* Header with icon */}
                        <div className="mb-4 flex items-center gap-3">
                            <div className="from-primary/20 to-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br">
                                <HouseIcon className="text-primary h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-foreground font-semibold">
                                    Add Carmenta to Home
                                </h3>
                                <p className="text-foreground/60 text-sm">
                                    Faster access, native experience
                                </p>
                            </div>
                        </div>

                        {/* iOS Instructions */}
                        <div className="bg-foreground/5 rounded-lg p-3">
                            <p className="text-foreground/80 mb-2 text-xs font-medium">
                                To install on iOS:
                            </p>
                            <ol className="text-foreground/60 space-y-1.5 text-xs">
                                <li className="flex items-start gap-2">
                                    <span className="text-foreground/30">1.</span>
                                    <span>
                                        Tap the Share button (square with arrow)
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-foreground/30">2.</span>
                                    <span>
                                        Scroll and tap &quot;Add to Home Screen&quot;
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-foreground/30">3.</span>
                                    <span>Tap &quot;Add&quot; in the top right</span>
                                </li>
                            </ol>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
