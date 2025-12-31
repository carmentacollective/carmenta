/**
 * Pull-to-Refresh Indicator Component
 *
 * Visual feedback for pull-to-refresh gesture.
 * Shows a spinner that fills up as user pulls down.
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { motion } from "framer-motion";
import { RefreshCw, Loader2 } from "lucide-react";
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
            className="z-modal pointer-events-none fixed top-0 left-1/2 -translate-x-1/2"
        >
            <div
                className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-sm transition-colors",
                    isTriggered || isRefreshing
                        ? "bg-indigo-500/90 text-white"
                        : "bg-background/90 text-foreground/60"
                )}
            >
                {isRefreshing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <motion.div
                        animate={{ rotate: progress * 180 }}
                        transition={{ type: "spring", damping: 20 }}
                    >
                        <RefreshCw
                            className={cn("h-5 w-5", isTriggered && "text-white")}
                            style={{ opacity: 0.4 + progress * 0.6 }}
                        />
                    </motion.div>
                )}
            </div>

            {/* Progress ring */}
            {!isRefreshing && (
                <svg
                    className="absolute inset-0 h-10 w-10 -rotate-90"
                    viewBox="0 0 40 40"
                >
                    <circle
                        cx="20"
                        cy="20"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${progress * 113} 113`}
                        className={cn(
                            "transition-colors",
                            isTriggered ? "text-white" : "text-indigo-500"
                        )}
                    />
                </svg>
            )}
        </motion.div>
    );
}
