/**
 * Swipe Back Indicator Component
 *
 * Visual feedback for swipe-from-edge back navigation.
 * Shows a chevron that appears from the left edge during swipe.
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CaretLeftIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SwipeBackIndicatorProps {
    /** Swipe progress from 0 to 1 */
    progress: number;
    /** Whether user is actively swiping */
    isSwiping: boolean;
    /** Current swipe distance in pixels */
    swipeDistance: number;
}

export function SwipeBackIndicator({
    progress,
    isSwiping,
    swipeDistance,
}: SwipeBackIndicatorProps) {
    const isTriggered = progress >= 1;

    return (
        <AnimatePresence>
            {isSwiping && swipeDistance > 10 && (
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                        opacity: Math.min(progress * 1.5, 1),
                        x: Math.min(swipeDistance * 0.3, 40),
                    }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="z-modal pointer-events-none fixed top-1/2 left-0 -translate-y-1/2"
                >
                    <div
                        className={cn(
                            "flex h-12 w-8 items-center justify-center rounded-r-full shadow-lg backdrop-blur-sm transition-colors",
                            isTriggered
                                ? "bg-indigo-500/90 text-white"
                                : "bg-background/80 text-foreground/60"
                        )}
                    >
                        <CaretLeftIcon
                            className={cn(
                                "h-6 w-6 transition-transform",
                                isTriggered && "scale-110"
                            )}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
