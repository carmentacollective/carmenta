"use client";

/**
 * Background Mode Banner
 *
 * Persistent banner shown when Carmenta is working in the background.
 * Uses glass morphism styling with animated progress dots and elapsed time
 * to indicate active processing. Reassures users they can safely leave and return.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface BackgroundModeBannerProps {
    className?: string;
    /** When background mode started (for elapsed time display) */
    startTime?: number | null;
}

/**
 * Format elapsed seconds into human-readable string.
 * - Under 60s: "45s"
 * - 60s+: "1m 23s"
 */
function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

export function BackgroundModeBanner({
    className,
    startTime,
}: BackgroundModeBannerProps) {
    // Calculate elapsed time, updating every second
    const [elapsedSeconds, setElapsedSeconds] = useState(() =>
        startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
    );

    // Update elapsed time every second
    useEffect(() => {
        if (!startTime) return;

        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                "relative mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3",
                // Glass morphism effect
                "bg-primary/10 backdrop-blur-md",
                "border-primary/20 border",
                // Subtle shadow
                "shadow-primary/5 shadow-lg",
                className
            )}
        >
            {/* Animated progress dots - three sequential pulses */}
            <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="bg-primary h-1.5 w-1.5 rounded-full"
                        animate={{
                            opacity: [0.4, 1, 0.4],
                            scale: [0.8, 1, 0.8],
                        }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.2,
                            ease: "easeInOut",
                        }}
                    />
                ))}
            </div>

            {/* Message copy with elapsed time */}
            <div className="flex flex-col gap-0.5">
                <p className="text-foreground text-sm font-medium">
                    Working in background
                    {startTime && (
                        <span className="text-foreground/60 ml-1.5">
                            ({formatElapsed(elapsedSeconds)})
                        </span>
                    )}
                </p>
                <p className="text-foreground/70 text-xs">
                    Keep chatting—we'll notify you when this is ready.
                </p>
            </div>
        </motion.div>
    );
}
