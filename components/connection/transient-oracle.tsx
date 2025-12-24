"use client";

/**
 * TransientOracle - Real-time notifications from Carmenta
 *
 * Displays transient messages destined for the Oracle message center.
 * These are wisdom, tips, or encouragement from Carmenta during streaming.
 *
 * Design: A floating speech bubble near the Oracle that animates in/out.
 * More ephemeral than OracleWhisper - appears during streaming operations.
 */

import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTransientOracle } from "@/lib/streaming";

interface TransientOracleProps {
    className?: string;
}

/**
 * Floating notification bubble for Oracle messages.
 * Positioned relative to its container (should be near the Oracle).
 */
export function TransientOracle({ className }: TransientOracleProps) {
    const messages = useTransientOracle();

    // Only show the most recent oracle message
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage) {
        return null;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={latestMessage.id}
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                    // Glass morphism bubble
                    "rounded-xl px-3 py-2",
                    "border border-primary/20 bg-primary/5 backdrop-blur-md",
                    "shadow-lg shadow-primary/5",
                    className
                )}
            >
                {/* Speech bubble tail - pointing left toward Oracle */}
                <div
                    className={cn(
                        "absolute left-0 top-1/2 -translate-x-full -translate-y-1/2",
                        "h-0 w-0",
                        "border-r-6 border-y-4 border-y-transparent border-r-primary/20"
                    )}
                />

                {/* Content */}
                <div className="flex items-center gap-2">
                    {latestMessage.icon && (
                        <span className="text-base" role="img" aria-hidden>
                            {latestMessage.icon}
                        </span>
                    )}
                    <span className="text-sm text-foreground/80">
                        {latestMessage.text}
                    </span>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
