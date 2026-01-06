/**
 * Draft Recovery Banner
 *
 * Shows a collapsible banner above the chat input when a draft
 * message has been recovered from localStorage.
 *
 * Copy:
 * - "We saved your message—pick up where we left off?"
 * - Keep going (keep text)
 * - Start fresh (clear text)
 *
 * Auto-dismisses when user starts typing (implicit acceptance).
 *
 * @see knowledge/users-should-feel.md - "Memory is relationship"
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";

interface DraftRecoveryBannerProps {
    /** Whether to show the banner */
    show: boolean;
    /** Called when user clicks "Keep going" - keeps the text */
    onContinue: () => void;
    /** Called when user clicks "Start fresh" - clears the text */
    onStartFresh: () => void;
}

export function DraftRecoveryBanner({
    show,
    onContinue,
    onStartFresh,
}: DraftRecoveryBannerProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 300,
                        delay: 0.15, // Brief delay so user notices the banner appearing
                    }}
                    className="overflow-hidden"
                >
                    <div className="bg-primary/10 mb-3 flex items-center justify-between rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                            <ClockCounterClockwiseIcon className="text-primary h-4 w-4" />
                            <span className="text-foreground/80 text-sm">
                                We saved your message—pick up where we left off?
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onStartFresh}
                                className="text-foreground/50 hover:text-foreground/70 text-sm transition-colors"
                            >
                                Start fresh
                            </button>
                            <button
                                onClick={onContinue}
                                className="bg-primary/20 text-primary hover:bg-primary/30 rounded-lg px-3 py-1 text-sm transition-colors"
                            >
                                Keep going
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
