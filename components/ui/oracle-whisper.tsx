"use client";

// DISABLED: Rotating tips were mis-implemented.
// To re-enable: change TIPS_DISABLED to false
const TIPS_DISABLED = true;

/**
 * OracleWhisper - Carmenta speaks to the user
 *
 * Combines the Oracle with a speech bubble for feature tips and guidance.
 * The whisper emanates from Carmenta herself, establishing her as a presence
 * that communicates directly with users.
 *
 * Design: A glass speech bubble appears to the right of the Oracle,
 * connected by a subtle tail. The Oracle glows gently when speaking.
 *
 * Frequency Logic (based on UX psychology research):
 * - First 3 sessions: Never show (let new users explore naturally)
 * - Sessions 3-7: Always show (onboarding period starts)
 * - Sessions 8-17: 50% chance (building familiarity)
 * - Sessions 18+: 25% chance (occasional reminders)
 * - Never show same tip twice in a row
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { glassOrbPreset } from "@/lib/design-tokens";
import {
    getRandomTip,
    getConnectPageFeatures,
    type Feature,
} from "@/lib/features/feature-catalog";
import { useSettingsModal } from "@/components/connection/connect-runtime-provider";
import { useConnection } from "@/components/connection/connection-context";

const STORAGE_KEY = "carmenta_whisper_state";
const SESSION_TRACKED_KEY = "carmenta_session_tracked";
const SESSION_DISMISSED_KEY = "carmenta_whisper_dismissed";

/** How long the whisper stays visible before auto-dismissing (ms) */
const AUTO_DISMISS_TIMEOUT_MS = 25000;

/** Custom event emitted when user engages with the chat */
export const USER_ENGAGED_EVENT = "carmenta:user-engaged";

interface WhisperState {
    sessionCount: number;
    lastTipId: string | null;
    lastShownAt: number; // timestamp
}

function getWhisperState(): WhisperState {
    if (typeof window === "undefined") {
        return { sessionCount: 0, lastTipId: null, lastShownAt: 0 };
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Ignore parse errors
    }
    return { sessionCount: 0, lastTipId: null, lastShownAt: 0 };
}

function saveWhisperState(state: WhisperState): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage errors
    }
}

/** Minimum sessions before tips appear - let new users explore naturally */
const MIN_SESSIONS_BEFORE_TIPS = 3;

/**
 * Determine if we should show a tip this session.
 * Based on UX research on notification fatigue and progressive disclosure.
 */
function shouldShowTip(state: WhisperState): boolean {
    const { sessionCount } = state;

    // Never show for first 3 sessions - let new users explore naturally
    if (sessionCount < MIN_SESSIONS_BEFORE_TIPS) return false;

    // Always show for sessions 3-7 (onboarding period now they're familiar)
    if (sessionCount < 8) return true;

    // 50% chance for sessions 8-17 (building familiarity)
    if (sessionCount < 18) return Math.random() < 0.5;

    // 25% chance after that (occasional helpful reminders)
    return Math.random() < 0.25;
}

interface OracleWhisperProps {
    className?: string;
}

/**
 * Check if whisper was already dismissed this browser session.
 */
function isSessionDismissed(): boolean {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "true";
}

/**
 * Mark the whisper as dismissed for this browser session.
 * This prevents it from reappearing after streaming cycles.
 */
function markSessionDismissed(): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
}

export function OracleWhisper({ className }: OracleWhisperProps) {
    const [tip, setTip] = useState<Feature | null>(null);
    // Initialize from sessionStorage to persist dismissal across streaming cycles
    const [isDismissed, setIsDismissed] = useState(isSessionDismissed);
    const [shouldShow, setShouldShow] = useState(false);
    const { setSettingsOpen } = useSettingsModal();
    const { isStreaming } = useConnection();

    useEffect(() => {
        const timer = setTimeout(() => {
            const state = getWhisperState();

            // Check if we've already tracked this browser session
            // This prevents incrementing the counter on every component mount
            const sessionAlreadyTracked =
                typeof window !== "undefined" &&
                sessionStorage.getItem(SESSION_TRACKED_KEY) === "true";

            let newState = state;
            if (!sessionAlreadyTracked) {
                // First mount in this browser session - increment counter
                newState = {
                    ...state,
                    sessionCount: state.sessionCount + 1,
                };
                if (typeof window !== "undefined") {
                    sessionStorage.setItem(SESSION_TRACKED_KEY, "true");
                }
            }

            // Check if we should show a tip
            if (!shouldShowTip(newState)) {
                saveWhisperState(newState);
                return;
            }

            // Get a tip, avoiding the last one shown
            // Filter out last tip before selection to guarantee no repeat
            const availableTips = getConnectPageFeatures();
            const tipsToChooseFrom = state.lastTipId
                ? availableTips.filter((t) => t.id !== state.lastTipId)
                : availableTips;

            const selectedTip =
                tipsToChooseFrom.length > 0
                    ? tipsToChooseFrom[
                          Math.floor(Math.random() * tipsToChooseFrom.length)
                      ]
                    : getRandomTip(); // Fallback if somehow we filtered everything

            // Update state with this tip
            saveWhisperState({
                ...newState,
                lastTipId: selectedTip.id,
                lastShownAt: Date.now(),
            });

            setTip(selectedTip);
            setShouldShow(true);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
        markSessionDismissed();
    }, []);

    const handleCtaClick = useCallback(() => {
        if (tip?.cta?.action === "settings") {
            setSettingsOpen(true);
            setIsDismissed(true);
            markSessionDismissed();
        }
    }, [tip, setSettingsOpen]);

    // Auto-dismiss after timeout (user saw it, didn't interact)
    useEffect(() => {
        if (!tip || isDismissed || !shouldShow) return;

        const timer = setTimeout(() => {
            setIsDismissed(true);
            markSessionDismissed();
        }, AUTO_DISMISS_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [tip, isDismissed, shouldShow]);

    // Listen for user engagement events (typing, sending messages)
    useEffect(() => {
        const handleUserEngaged = () => {
            if (!isDismissed) {
                setIsDismissed(true);
                markSessionDismissed();
            }
        };

        window.addEventListener(USER_ENGAGED_EVENT, handleUserEngaged);
        return () => window.removeEventListener(USER_ENGAGED_EVENT, handleUserEngaged);
    }, [isDismissed]);

    // Only show whisper when tips are enabled AND we have a tip ready
    const showWhisper = !TIPS_DISABLED && tip && !isDismissed && shouldShow;
    const isSpeaking = showWhisper && !isStreaming;

    return (
        <div className={cn("relative", className)}>
            {/* Oracle with speaking glow */}
            <Link href="/home" className="relative block">
                {/* Speaking glow - pulses when whisper is visible */}
                <AnimatePresence>
                    {isSpeaking && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.4 }}
                            className="absolute -inset-2 rounded-full"
                        >
                            <motion.div
                                className="from-primary/30 to-primary/30 h-full w-full rounded-full bg-gradient-to-br via-cyan-500/20"
                                animate={{
                                    opacity: [0.4, 0.7, 0.4],
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Oracle - glass orb anchoring the header */}
                <div
                    className={cn(
                        glassOrbPreset,
                        isStreaming && "oracle-working",
                        !isStreaming && "oracle-breathing"
                    )}
                    data-tooltip-id="tip"
                    data-tooltip-content="Home"
                >
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={40}
                        height={40}
                        className="pointer-events-none"
                    />
                </div>
            </Link>

            {/* Speech bubble whisper - positioned below Oracle */}
            <AnimatePresence>
                {showWhisper && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{
                            duration: 0.4,
                            delay: 0.6,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                        className="z-modal absolute top-full left-1/2 mt-3 w-56 -translate-x-1/2 sm:w-72"
                    >
                        {/* Speech tail pointing up to Oracle */}
                        <div className="absolute -top-2 left-6 h-4 w-4 rotate-45 border-t border-l border-white/20 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/50" />

                        {/* Whisper card - more compact on mobile */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 p-2.5 shadow-lg backdrop-blur-xl sm:p-3 dark:border-white/10 dark:bg-black/50">
                            {/* Subtle shimmer */}
                            <div className="from-primary/5 absolute inset-0 bg-gradient-to-br via-transparent to-cyan-500/5" />

                            <div className="relative z-10">
                                {/* Header with title and dismiss */}
                                <div className="mb-1.5 flex items-start justify-between gap-2">
                                    <h3 className="text-foreground/90 text-xs font-semibold sm:text-sm">
                                        {tip.tipTitle}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleDismiss}
                                        className="text-foreground/40 hover:bg-foreground/10 hover:text-foreground/60 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
                                        aria-label="Dismiss"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>

                                {/* Description - tighter line height on mobile */}
                                <p className="text-foreground/70 text-xs leading-snug sm:leading-relaxed">
                                    {tip.tipDescription}
                                </p>

                                {/* Coming soon badge or CTA */}
                                <div className="mt-2 flex items-center gap-2">
                                    {!tip.available && (
                                        <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                            <span className="bg-primary h-1 w-1 animate-pulse rounded-full" />
                                            Coming soon
                                        </span>
                                    )}

                                    {tip.cta && tip.available && (
                                        <>
                                            {tip.cta.action === "link" &&
                                                tip.cta.href && (
                                                    <Link
                                                        href={tip.cta.href}
                                                        target={
                                                            tip.cta.external
                                                                ? "_blank"
                                                                : undefined
                                                        }
                                                        rel={
                                                            tip.cta.external
                                                                ? "noopener noreferrer"
                                                                : undefined
                                                        }
                                                        className="group/cta bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                                                    >
                                                        {tip.cta.label}
                                                        <ArrowRight className="h-3 w-3 transition-transform group-hover/cta:translate-x-0.5" />
                                                    </Link>
                                                )}
                                            {tip.cta.action === "settings" && (
                                                <button
                                                    type="button"
                                                    onClick={handleCtaClick}
                                                    className="group/cta bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                                                >
                                                    {tip.cta.label}
                                                    <ArrowRight className="h-3 w-3 transition-transform group-hover/cta:translate-x-0.5" />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
