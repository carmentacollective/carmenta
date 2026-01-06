/**
 * Pull-to-Refresh Indicator Component
 *
 * Visual feedback for pull-to-refresh gesture.
 * Glassy spinner that fades in as user pulls down.
 *
 * Design: Liquid Glass aesthetic with Carmenta brand accent.
 * Simpler than progress ring - just opacity scaling + indigo trigger.
 */

"use client";

import { motion } from "framer-motion";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
    /** Pull progress from 0 to 1 */
    progress: number;
    /** Whether refresh is in progress */
    isRefreshing: boolean;
    /** Whether user is actively pulling */
    isPulling: boolean;
    /** Current pull distance in pixels */
    pullDistance: number;
}

export function PullToRefreshIndicator({
    progress,
    isRefreshing,
    isPulling,
    pullDistance,
}: PullToRefreshIndicatorProps) {
    // Don't show if not pulling and not refreshing
    if (!isPulling && !isRefreshing && pullDistance === 0) {
        return null;
    }

    const isTriggered = progress >= 1;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
                opacity: isPulling || isRefreshing ? 1 : 0,
                scale: isPulling || isRefreshing ? 1 : 0.5,
                y: Math.min(pullDistance * 0.5, 60),
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="z-sticky pointer-events-none fixed top-[env(safe-area-inset-top)] left-1/2 -translate-x-1/2"
        >
            <div
                className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full",
                    "shadow-lg shadow-black/10 backdrop-blur-xl transition-colors",
                    isTriggered || isRefreshing
                        ? "border border-indigo-400/30 bg-indigo-500/80 text-white"
                        : "text-foreground/70 border border-white/20 bg-white/20 dark:bg-white/10"
                )}
            >
                <CircleNotch
                    className={cn("h-5 w-5", isRefreshing && "animate-spin")}
                    style={{
                        opacity: isRefreshing ? 1 : 0.4 + progress * 0.6,
                        transform: isRefreshing
                            ? undefined
                            : `rotate(${progress * 360}deg)`,
                    }}
                />
            </div>
        </motion.div>
    );
}
