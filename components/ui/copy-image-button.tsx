"use client";

/**
 * Copy Image Button
 *
 * Copies image data to clipboard with visual feedback and delight messages.
 * Follows the same patterns as CopyButton but handles blob/image data.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";

import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion/presets";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { logger } from "@/lib/client-logger";

/**
 * Delight messages for image copy - themed around visual creation.
 * Variable reinforcement: boring most of the time, delightful sometimes.
 */
const IMAGE_DELIGHT_MESSAGES = [
    "Copied!",
    "Picture perfect 📸",
    "Ready to paste",
    "We made that together 💜",
    "Art acquired",
    "Pixels secured",
    "Captured!",
    "Looking good",
] as const;

/** Probability of showing a delight message vs plain "Copied" (1 in N) */
const DELIGHT_CHANCE = 5; // ~20% chance of delight

/** Duration to show success feedback before resetting */
const FEEDBACK_DURATION_MS = 2000;

interface CopyImageButtonProps {
    /** Data URI or blob URL of the image to copy */
    src: string;

    /** Accessible label for screen readers */
    ariaLabel?: string;

    /** Optional callback after successful copy */
    onCopySuccess?: () => void;

    /** Visual variant */
    variant?: "overlay" | "glass";

    /** Size variant */
    size?: "sm" | "md";

    /** Optional CSS class name */
    className?: string;
}

/**
 * Copy image button with visual feedback and delight messages.
 *
 * Copies image blob data to clipboard using the Clipboard API.
 * Shows toast on error instead of failing silently.
 */
export function CopyImageButton({
    src,
    ariaLabel = "Copy image",
    onCopySuccess,
    variant = "overlay",
    size = "md",
    className,
}: CopyImageButtonProps) {
    const [copied, setCopied] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);
    const { trigger: triggerHaptic } = useHapticFeedback();

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleCopy = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();

            try {
                // Clear any existing timeout
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                // Fetch image and convert to blob
                const response = await fetch(src);
                const blob = await response.blob();

                // Copy to clipboard
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob }),
                ]);

                logger.info({ blobType: blob.type }, "Image copied to clipboard");

                // Variable reinforcement: usually boring, sometimes delightful
                const isSpecial = Math.random() < 1 / DELIGHT_CHANCE;
                const delightMessage = isSpecial
                    ? IMAGE_DELIGHT_MESSAGES[
                          Math.floor(Math.random() * IMAGE_DELIGHT_MESSAGES.length)
                      ]
                    : "Copied!";

                if (mountedRef.current) {
                    setCopied(true);
                    setMessage(delightMessage);
                    triggerHaptic();
                    onCopySuccess?.();

                    timeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            setCopied(false);
                            setMessage(null);
                        }
                    }, FEEDBACK_DURATION_MS);
                }
            } catch (error) {
                logger.error({ error }, "Failed to copy image");
                Sentry.captureException(error, {
                    level: "info",
                    tags: { component: "copy-image-button", action: "copy" },
                });

                // User-friendly error feedback
                toast.error("Couldn't copy image to clipboard");
            }
        },
        [src, triggerHaptic, onCopySuccess]
    );

    const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

    const buttonClasses = cn(
        "inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "overlay" &&
            "rounded-md bg-black/50 p-2 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white",
        variant === "glass" &&
            "rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white",
        copied && "text-green-400",
        className
    );

    return (
        <motion.button
            onClick={handleCopy}
            aria-label={copied ? message || "Copied!" : ariaLabel}
            layout
            className={buttonClasses}
            title={ariaLabel}
        >
            {copied ? (
                <>
                    <CheckIcon className={cn(iconSize, "flex-shrink-0")} />
                    {message && size === "md" && (
                        <motion.span
                            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                            animate={{ opacity: 1, width: "auto", marginLeft: 6 }}
                            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                            transition={transitions.quick}
                            className="text-xs font-medium whitespace-nowrap"
                            aria-live="polite"
                        >
                            {message}
                        </motion.span>
                    )}
                </>
            ) : (
                <CopyIcon className={iconSize} />
            )}
        </motion.button>
    );
}
