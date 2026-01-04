"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LabelToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    size?: "sm" | "md";
}

/**
 * Label Toggle - Option 8 from Design Lab
 *
 * A premium toggle switch with sliding ON/OFF labels.
 * Theme-aware and accessible.
 */
export function LabelToggle({
    checked,
    onChange,
    disabled = false,
    className,
    size = "md",
}: LabelToggleProps) {
    const sizes = {
        sm: {
            track: "h-6 w-12",
            thumb: "h-4 w-4",
            thumbOffset: { on: 28, off: 4 },
            text: "text-[10px]",
            textOffset: "2",
        },
        md: {
            track: "h-8 w-16",
            thumb: "h-6 w-6",
            thumbOffset: { on: 36, off: 4 },
            text: "text-xs",
            textOffset: "2.5",
        },
    };

    const s = sizes[size];

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={cn(
                "tap-target relative overflow-hidden rounded-full transition-colors duration-200",
                "focus:ring-primary/40 focus:ring-offset-background focus:ring-2 focus:ring-offset-2 focus:outline-none",
                s.track,
                checked ? "bg-primary" : "bg-foreground/15 dark:bg-foreground/20",
                disabled && "cursor-not-allowed opacity-50",
                className
            )}
        >
            <AnimatePresence mode="wait">
                {checked ? (
                    <motion.span
                        key="on"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 font-semibold text-white",
                            s.text,
                            `left-${s.textOffset}`
                        )}
                        style={{ left: size === "sm" ? "6px" : "10px" }}
                    >
                        ON
                    </motion.span>
                ) : (
                    <motion.span
                        key="off"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 font-medium",
                            "text-foreground/60 dark:text-foreground/50",
                            s.text
                        )}
                        style={{ right: size === "sm" ? "6px" : "10px" }}
                    >
                        OFF
                    </motion.span>
                )}
            </AnimatePresence>
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                    "absolute top-1 rounded-full shadow-md",
                    "bg-white dark:bg-white",
                    s.thumb
                )}
                style={{ left: checked ? s.thumbOffset.on : s.thumbOffset.off }}
            />
        </button>
    );
}
