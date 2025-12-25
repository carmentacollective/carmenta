/**
 * PWA Install Prompt Component
 *
 * Shows a beautiful, on-brand prompt encouraging users to install Carmenta.
 * Only appears when installation is available (browser supports + not installed).
 *
 * Features:
 * - Dismissible with 7-day snooze
 * - Tracks install outcome for analytics
 * - Carmenta voice and aesthetic
 * - Accessible
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Smartphone } from "lucide-react";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
// import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback"; // TODO: Re-enable
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";

const SNOOZE_KEY = "carmenta-install-prompt-snoozed";
const SNOOZE_DAYS = 7;

// Check if prompt is snoozed (pure function, safe for SSR)
function isSnoozed(): boolean {
    if (typeof window === "undefined") return true;
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    return Boolean(snoozedUntil && Date.now() < parseInt(snoozedUntil, 10));
}

export function InstallPrompt() {
    const { canInstall, promptInstall } = useInstallPrompt();
    // TODO: Re-enable haptic feedback once CI type resolution issue is fixed
    // const { trigger: triggerHaptic } = useHapticFeedback();
    const triggerHaptic = (_type: string) => {}; // no-op for now
    // Track whether user has dismissed or installed this session
    const [userDismissed, setUserDismissed] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    // Track delay timer completion (don't interrupt initial load)
    const [delayComplete, setDelayComplete] = useState(false);

    // Delay showing prompt to not interrupt initial load
    useEffect(() => {
        if (!canInstall) return;
        const timer = setTimeout(() => setDelayComplete(true), 3000);
        return () => clearTimeout(timer);
    }, [canInstall]);

    // Derive visibility from state (no setState in effect body)
    const isVisible = canInstall && !userDismissed && !isSnoozed() && delayComplete;

    const handleInstall = async () => {
        setIsInstalling(true);
        triggerHaptic("medium");

        const outcome = await promptInstall();

        logger.info({ outcome }, "📲 Install prompt interaction");

        setIsInstalling(false);

        if (outcome === "accepted") {
            setUserDismissed(true);
        }
    };

    const handleDismiss = () => {
        triggerHaptic("light");

        // Snooze for configured days
        const snoozeUntil = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
        localStorage.setItem(SNOOZE_KEY, snoozeUntil.toString());

        setUserDismissed(true);
        logger.debug({}, "📲 Install prompt dismissed, snoozed");
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom)+1rem))] left-4 right-4 z-modal mx-auto max-w-sm sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-6"
                >
                    <div className="glass-card overflow-hidden rounded-2xl border border-white/10 bg-background/95 p-4 shadow-2xl backdrop-blur-xl">
                        {/* Dismiss button - 44px touch target (Apple HIG minimum) */}
                        <button
                            onClick={handleDismiss}
                            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground/60"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="flex gap-4">
                            {/* Icon */}
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                                <Smartphone className="h-6 w-6 text-indigo-400" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 pr-4">
                                <h3 className="font-semibold text-foreground">
                                    Add Carmenta to Home
                                </h3>
                                <p className="mt-1 text-sm text-foreground/60">
                                    Install for faster access, offline support, and a
                                    native app experience.
                                </p>

                                {/* Install button - 44px min height for touch target */}
                                <button
                                    onClick={handleInstall}
                                    disabled={isInstalling}
                                    className={cn(
                                        "mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all",
                                        "bg-gradient-to-r from-indigo-500 to-purple-500 text-white",
                                        "hover:from-indigo-600 hover:to-purple-600",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                                        "disabled:opacity-50"
                                    )}
                                >
                                    <Download className="h-4 w-4" />
                                    {isInstalling ? "Installing..." : "Install"}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
