"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { getThinkingMessages, THINKING_MESSAGES } from "@/lib/tools/tool-config";

interface ThinkingIndicatorProps {
    className?: string;
}

/**
 * Pick a random message from the pool, avoiding the last one shown.
 */
function pickRandomMessage(messages: string[], lastMessage: string): string {
    if (messages.length === 0) return "";
    if (messages.length === 1) return messages[0];

    // Filter out last message to avoid immediate repeat
    const available = messages.filter((m) => m !== lastMessage);
    const pool = available.length > 0 ? available : messages;

    // Random selection
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

/**
 * Warm loading indicator with rotating messages in Carmenta's oracle voice.
 *
 * Features:
 * - Messages rotate every 3-5 seconds with smooth fade transitions
 * - On-brand oracle/wisdom/creative themed messages
 * - Elapsed time shown after 2 seconds
 * - Long wait acknowledgment after 8 seconds
 * - No repeat of same message twice in a row
 */
export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
    const [elapsedMs, setElapsedMs] = useState(0);
    const [currentMessage, setCurrentMessage] = useState(() =>
        pickRandomMessage(THINKING_MESSAGES, "")
    );
    const lastMessageRef = useRef<string>(currentMessage);
    const elapsedMsRef = useRef<number>(0);
    const [startTime] = useState(() => Date.now());

    // Track elapsed time
    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            elapsedMsRef.current = elapsed;
            setElapsedMs(elapsed);
        }, 100);

        return () => clearInterval(interval);
    }, [startTime]);

    // Rotate messages every 3-5 seconds
    useEffect(() => {
        // Random interval between 3-5 seconds
        const rotationInterval = 3000 + Math.random() * 2000;

        const timeout = setTimeout(() => {
            // Get current message pool based on latest elapsed time
            const messages = getThinkingMessages(elapsedMsRef.current);
            const next = pickRandomMessage(messages, lastMessageRef.current);
            lastMessageRef.current = next;
            setCurrentMessage(next);
        }, rotationInterval);

        return () => clearTimeout(timeout);
        // Only re-run when message changes (after rotation completes)
    }, [currentMessage]);

    const showTime = elapsedMs >= 2000;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
                "relative flex items-center gap-3 rounded-lg px-4 py-3",
                className
            )}
        >
            {/* Shimmer overlay */}
            <div className="animate-shimmer absolute inset-0 rounded-lg opacity-50" />

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

            {/* Message with fade transition */}
            <div className="relative flex items-baseline gap-2">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={currentMessage}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3 }}
                        className="text-muted-foreground text-sm"
                    >
                        {currentMessage}
                    </motion.span>
                </AnimatePresence>
                {showTime && (
                    <span className="text-muted-foreground/60 text-xs">
                        {elapsedSeconds}s
                    </span>
                )}
            </div>
        </motion.div>
    );
}
