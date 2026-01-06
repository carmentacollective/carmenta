"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";

interface RegenerateButtonProps {
    /**
     * Callback when regenerate is requested
     */
    onRegenerate: () => Promise<void>;

    /**
     * Whether regeneration is currently in progress
     */
    isRegenerating?: boolean;

    /**
     * Disable the button (e.g., during streaming)
     */
    disabled?: boolean;

    /**
     * Accessible label for screen readers
     */
    ariaLabel?: string;

    /**
     * Optional CSS class name
     */
    className?: string;
}

/**
 * Regenerate button for requesting a new AI response.
 *
 * Shows a rotate icon that spins briefly when clicked.
 * Disabled during active streaming to prevent confusing state.
 */
export function RegenerateButton({
    onRegenerate,
    isRegenerating = false,
    disabled = false,
    ariaLabel = "Regenerate this response",
    className,
}: RegenerateButtonProps) {
    const [isAnimating, setIsAnimating] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { trigger: triggerHaptic } = useHapticFeedback();

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleClick = useCallback(async () => {
        if (disabled || isRegenerating || isAnimating) return;

        triggerHaptic();
        setIsAnimating(true);
        try {
            await onRegenerate();
        } finally {
            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            // Keep spinning briefly for visual feedback
            timeoutRef.current = setTimeout(() => {
                setIsAnimating(false);
                timeoutRef.current = null;
            }, 500);
        }
    }, [onRegenerate, disabled, isRegenerating, isAnimating, triggerHaptic]);

    const isSpinning = isAnimating || isRegenerating;

    return (
        <motion.button
            onClick={handleClick}
            aria-label={ariaLabel}
            disabled={disabled || isRegenerating}
            data-tooltip-id="tip"
            data-tooltip-content="Another angle?"
            className={cn(
                "inline-flex h-7 shrink-0 items-center justify-center rounded-md transition-all",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                "hover:bg-foreground/10 active:bg-foreground/15",
                disabled || isRegenerating
                    ? "cursor-not-allowed opacity-40"
                    : "text-foreground/60 hover:text-foreground/90",
                className
            )}
            whileTap={!disabled && !isRegenerating ? { scale: 0.95 } : undefined}
        >
            <AnimatePresence mode="wait">
                {isSpinning ? (
                    <motion.div
                        key="spinning"
                        initial={{ opacity: 0, rotate: 0 }}
                        animate={{ opacity: 1, rotate: 360 }}
                        exit={{ opacity: 0 }}
                        transition={{
                            rotate: { duration: 0.5, ease: "easeInOut" },
                            opacity: { duration: 0.15 },
                        }}
                    >
                        <ArrowClockwiseIcon className="h-3.5 w-3.5" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="static"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <ArrowClockwiseIcon className="h-3.5 w-3.5" />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
}
