/**
 * Onboarding Hint Component
 *
 * Reusable progressive disclosure hint that shows a configurable number
 * of times before hiding permanently. Uses use-hint-storage for persistence.
 *
 * @see knowledge/components/pwa-mobile-enhancements.md
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XIcon, LightbulbIcon } from "@phosphor-icons/react";
import { useHintStorage } from "@/lib/hooks/use-hint-storage";
import { cn } from "@/lib/utils";

interface OnboardingHintProps {
    /** Unique identifier for this hint (used for localStorage) */
    hintKey: string;
    /** Content to display in the hint */
    children: React.ReactNode;
    /** Maximum times to show hint before hiding permanently (default: 3) */
    maxShows?: number;
    /** Expiration in days - reset hint after this many days (optional) */
    expiresAfterDays?: number;
    /** Position relative to trigger element */
    position?: "top" | "bottom" | "left" | "right";
    /** Additional class names */
    className?: string;
    /** Icon to display (default: LightbulbIcon) */
    icon?: React.ReactNode;
    /** Callback when hint is dismissed */
    onDismiss?: () => void;
}

export function OnboardingHint({
    hintKey,
    children,
    maxShows = 3,
    expiresAfterDays,
    position = "bottom",
    className,
    icon,
    onDismiss,
}: OnboardingHintProps) {
    const [shouldShow, markSeen] = useHintStorage(hintKey, {
        maxShows,
        expiresAfterDays,
    });

    const handleDismiss = () => {
        markSeen();
        onDismiss?.();
    };

    const positionClasses = {
        top: "bottom-full mb-2",
        bottom: "top-full mt-2",
        left: "right-full mr-2",
        right: "left-full ml-2",
    };

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{
                        opacity: 0,
                        y: position === "top" ? 8 : -8,
                        scale: 0.95,
                    }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: position === "top" ? 8 : -8, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={cn(
                        "z-tooltip absolute",
                        positionClasses[position],
                        className
                    )}
                >
                    <div className="bg-background/95 flex max-w-xs items-start gap-2 rounded-lg border border-white/10 p-3 shadow-lg backdrop-blur-xl">
                        <div className="text-primary flex-shrink-0">
                            {icon ?? <LightbulbIcon className="h-4 w-4" />}
                        </div>
                        <div className="text-foreground/80 flex-1 text-sm">
                            {children}
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-foreground/40 hover:text-foreground/60 flex-shrink-0 transition-colors"
                            aria-label="Dismiss hint"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
