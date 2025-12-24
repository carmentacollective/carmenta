"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
    // Initialize with a random message immediately (no waiting for effect)
    const [currentMessage, setCurrentMessage] = useState(() =>
        pickRandomMessage(THINKING_MESSAGES, "")
    );
    const [messageIndex, setMessageIndex] = useState(0);
    const lastMessageRef = useRef<string>(currentMessage);
    const [startTime] = useState(() => Date.now());

    // Get the appropriate message pool based on elapsed time
    const getMessagePool = useCallback(() => {
        return getThinkingMessages(elapsedMs);
    }, [elapsedMs]);

    // Pick a random message, avoiding the last one shown
    const pickNextMessage = useCallback(() => {
        const messages = getMessagePool();
        const selected = pickRandomMessage(messages, lastMessageRef.current);
        lastMessageRef.current = selected;
        return selected;
    }, [getMessagePool]);

    // Track elapsed time
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedMs(Date.now() - startTime);
        }, 100);

        return () => clearInterval(interval);
    }, [startTime]);

    // Rotate messages every 3-5 seconds
    useEffect(() => {
        // Random interval between 3-5 seconds
        const rotationInterval = 3000 + Math.random() * 2000;

        const timeout = setTimeout(() => {
            const next = pickNextMessage();
            setCurrentMessage(next);
            setMessageIndex((i) => i + 1);
        }, rotationInterval);

        return () => clearTimeout(timeout);
    }, [messageIndex, pickNextMessage]);

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
                "border border-white/20 bg-white/30 backdrop-blur-sm",
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
                        className="text-sm text-muted-foreground"
                    >
                        {currentMessage}
                    </motion.span>
                </AnimatePresence>
                {showTime && (
                    <span className="text-xs text-muted-foreground/60">
                        {elapsedSeconds}s
                    </span>
                )}
            </div>
        </motion.div>
    );
}
