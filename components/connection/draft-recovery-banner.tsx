/**
 * Draft Recovery Banner
 *
 * Shows a collapsible banner above the chat input when a draft
 * message has been recovered from localStorage.
 *
 * Copy:
 * - "We kept your message safe."
 * - Continue (keep text)
 * - Start fresh (clear text)
 *
 * @see knowledge/users-should-feel.md - "Memory is relationship"
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { History } from "lucide-react";

interface DraftRecoveryBannerProps {
    /** Whether to show the banner */
    show: boolean;
    /** Called when user clicks "Continue" - keeps the text */
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
                    }}
                    className="overflow-hidden"
                >
                    <div className="mb-3 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground/80">
                                We kept your message safe.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onStartFresh}
                                className="text-sm text-foreground/50 transition-colors hover:text-foreground/70"
                            >
                                Start fresh
                            </button>
                            <button
                                onClick={onContinue}
                                className="rounded-lg bg-primary/20 px-3 py-1 text-sm text-primary transition-colors hover:bg-primary/30"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
