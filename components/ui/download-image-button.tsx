"use client";

/**
 * Download Image Button
 *
 * Downloads image data with visual feedback.
 * Shows toast on error instead of failing silently.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { DownloadIcon, CheckIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";

import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion/presets";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { logger } from "@/lib/client-logger";

/** Duration to show success feedback before resetting */
const FEEDBACK_DURATION_MS = 2000;

interface DownloadImageButtonProps {
    /** Data URI or blob URL of the image to download */
    src: string;

    /** Filename for the downloaded image (without extension) */
    filename?: string;

    /** MIME type of the image */
    mimeType?: string;

    /** Accessible label for screen readers */
    ariaLabel?: string;

    /** Optional callback after successful download */
    onDownloadSuccess?: () => void;

    /** Visual variant */
    variant?: "overlay" | "glass";

    /** Size variant */
    size?: "sm" | "md";

    /** Optional CSS class name */
    className?: string;
}

/**
 * Download image button with visual feedback.
 *
 * Creates a download link and triggers file save.
 * Shows toast on error instead of failing silently.
 */
export function DownloadImageButton({
    src,
    filename = `carmenta-${Date.now()}`,
    mimeType = "image/png",
    ariaLabel = "Download image",
    onDownloadSuccess,
    variant = "overlay",
    size = "md",
    className,
}: DownloadImageButtonProps) {
    const [downloaded, setDownloaded] = useState(false);
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

    const handleDownload = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();

            try {
                // Clear any existing timeout
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                // Extract extension from MIME type
                const extension = mimeType.split("/")[1] ?? "png";

                // Create download link
                const link = document.createElement("a");
                link.href = src;
                link.download = `${filename}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                logger.info({ filename, mimeType }, "Image download triggered");

                if (mountedRef.current) {
                    setDownloaded(true);
                    triggerHaptic();
                    onDownloadSuccess?.();

                    timeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            setDownloaded(false);
                        }
                    }, FEEDBACK_DURATION_MS);
                }
            } catch (error) {
                logger.error({ error }, "Failed to download image");
                Sentry.captureException(error, {
                    level: "info",
                    tags: { component: "download-image-button", action: "download" },
                });

                // User-friendly error feedback
                toast.error("Couldn't download image");
            }
        },
        [src, filename, mimeType, triggerHaptic, onDownloadSuccess]
    );

    const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

    const buttonClasses = cn(
        "inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "overlay" &&
            "rounded-md bg-black/50 p-2 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white",
        variant === "glass" &&
            "rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white",
        downloaded && "text-green-400",
        className
    );

    return (
        <motion.button
            onClick={handleDownload}
            aria-label={downloaded ? "Downloaded!" : ariaLabel}
            layout
            className={buttonClasses}
            title={ariaLabel}
        >
            {downloaded ? (
                <>
                    <CheckIcon className={cn(iconSize, "flex-shrink-0")} />
                    {size === "md" && (
                        <motion.span
                            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                            animate={{ opacity: 1, width: "auto", marginLeft: 6 }}
                            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                            transition={transitions.quick}
                            className="text-xs font-medium whitespace-nowrap"
                            aria-live="polite"
                        >
                            Saved!
                        </motion.span>
                    )}
                </>
            ) : (
                <DownloadIcon className={iconSize} />
            )}
        </motion.button>
    );
}
