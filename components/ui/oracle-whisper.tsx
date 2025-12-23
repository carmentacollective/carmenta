"use client";

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
 * - First 5 sessions: Always show (onboarding)
 * - Sessions 6-15: 50% chance (building familiarity)
 * - Sessions 16+: 25% chance (occasional reminders)
 * - Never show same tip twice in a row
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { getRandomTip, type Feature } from "@/lib/features/feature-catalog";
import { useSettingsModal } from "@/components/connection/connect-runtime-provider";
import { useConnection } from "@/components/connection/connection-context";

const STORAGE_KEY = "carmenta_whisper_state";

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

/**
 * Determine if we should show a tip this session.
 * Based on UX research on notification fatigue and progressive disclosure.
 */
function shouldShowTip(state: WhisperState): boolean {
    const { sessionCount } = state;

    // Always show for first 5 sessions (onboarding period)
    if (sessionCount < 5) return true;

    // 50% chance for sessions 6-15 (building familiarity)
    if (sessionCount < 15) return Math.random() < 0.5;

    // 25% chance after that (occasional helpful reminders)
    return Math.random() < 0.25;
}

interface OracleWhisperProps {
    className?: string;
}

export function OracleWhisper({ className }: OracleWhisperProps) {
    const [tip, setTip] = useState<Feature | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);
    const { setSettingsOpen } = useSettingsModal();
    const { isStreaming } = useConnection();

    useEffect(() => {
        const timer = setTimeout(() => {
            const state = getWhisperState();

            // Increment session count
            const newState = {
                ...state,
                sessionCount: state.sessionCount + 1,
            };

            // Check if we should show a tip
            if (!shouldShowTip(state)) {
                saveWhisperState(newState);
                return;
            }

            // Get a tip, avoiding the last one shown
            let selectedTip = getRandomTip();
            let attempts = 0;
            while (selectedTip.id === state.lastTipId && attempts < 5) {
                selectedTip = getRandomTip();
                attempts++;
            }

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
    }, []);

    const handleCtaClick = useCallback(() => {
        if (tip?.cta?.action === "settings") {
            setSettingsOpen(true);
            setIsDismissed(true);
        }
    }, [tip, setSettingsOpen]);

    const showWhisper = tip && !isDismissed && shouldShow;
    const isSpeaking = showWhisper && !isStreaming;

    return (
        <div className={cn("relative", className)}>
            {/* Oracle with speaking glow */}
            <Link href="/" className="relative block">
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
                                className="h-full w-full rounded-full bg-gradient-to-br from-primary/30 via-cyan-500/20 to-primary/30"
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

                {/* Oracle button */}
                <div
                    className={cn(
                        "relative flex items-center justify-center rounded-full",
                        "h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14",
                        "glass-bg glass-shadow ring-1 ring-foreground/20 backdrop-blur-xl",
                        "dark:ring-white/15",
                        "transition-[box-shadow,ring-color] duration-300",
                        "hover:shadow-2xl hover:ring-[3px] hover:ring-primary/40",
                        "focus:shadow-2xl focus:outline-none focus:ring-[3px] focus:ring-primary/40",
                        isStreaming && "oracle-working",
                        !isStreaming && "oracle-breathing",
                        "tooltip"
                    )}
                    data-tooltip="Return to Carmenta home"
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
                        className="absolute left-0 top-full z-50 mt-2 w-72 sm:w-80"
                    >
                        {/* Speech tail pointing up to Oracle */}
                        <div className="absolute -top-2 left-5 h-4 w-4 rotate-45 border-l border-t border-white/20 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/50" />

                        {/* Whisper card */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 p-3 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
                            {/* Subtle shimmer */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5" />

                            <div className="relative z-10">
                                {/* Header with title and dismiss */}
                                <div className="mb-1.5 flex items-start justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-foreground/90">
                                        {tip.tipTitle}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleDismiss}
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground/40 transition-all hover:bg-foreground/10 hover:text-foreground/60"
                                        aria-label="Dismiss"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>

                                {/* Description */}
                                <p className="text-xs leading-relaxed text-foreground/70">
                                    {tip.tipDescription}
                                </p>

                                {/* Coming soon badge or CTA */}
                                <div className="mt-2 flex items-center gap-2">
                                    {!tip.available && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                                            <span className="h-1 w-1 animate-pulse rounded-full bg-primary" />
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
                                                        className="group/cta inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20"
                                                    >
                                                        {tip.cta.label}
                                                        <ArrowRight className="h-3 w-3 transition-transform group-hover/cta:translate-x-0.5" />
                                                    </Link>
                                                )}
                                            {tip.cta.action === "settings" && (
                                                <button
                                                    type="button"
                                                    onClick={handleCtaClick}
                                                    className="group/cta inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20"
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
