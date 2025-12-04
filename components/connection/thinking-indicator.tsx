"use client";

import { useEffect, useState, useId } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { getThinkingMessage } from "@/lib/tools/tool-config";

interface ThinkingIndicatorProps {
    className?: string;
}

/**
 * Warm loading indicator shown while waiting for the AI to respond.
 *
 * Features:
 * - Varied, human messages that rotate
 * - Elapsed time shown after 2 seconds
 * - Gentle shimmer animation
 * - Occasional delight variants (hash-based, 10% chance)
 * - Long wait acknowledgment after 5 seconds
 */
export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
    const messageId = useId();
    const [elapsedMs, setElapsedMs] = useState(0);
    const [startTime] = useState(() => Date.now());

    // Track elapsed time
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedMs(Date.now() - startTime);
        }, 100);

        return () => clearInterval(interval);
    }, [startTime]);

    const message = getThinkingMessage(messageId, elapsedMs);
    const showTime = elapsedMs >= 2000;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn("flex items-center gap-3", className)}
        >
            {/* Rotating logo */}
            <div className="relative flex h-8 w-8 items-center justify-center">
                <div className="animate-spin-slow">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Thinking"
                        width={32}
                        height={32}
                        className="opacity-70"
                    />
                </div>
            </div>

            {/* Message */}
            <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">{message}</span>
                {showTime && (
                    <span className="text-xs text-muted-foreground/60">
                        {elapsedSeconds}s
                    </span>
                )}
            </div>
        </motion.div>
    );
}
