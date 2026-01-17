"use client";

/**
 * Background Mode Banner
 *
 * Persistent banner shown when Carmenta is working in the background.
 * Uses glass morphism styling with a subtle pulse animation to indicate
 * active processing. Reassures users they can safely leave and return.
 */

import { SparkleIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface BackgroundModeBannerProps {
    className?: string;
}

export function BackgroundModeBanner({ className }: BackgroundModeBannerProps) {
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
            {/* Pulsing icon to show active state */}
            <SparkleIcon weight="fill" className="text-primary h-5 w-5 animate-pulse" />

            {/* Message copy */}
            <div className="flex flex-col gap-0.5">
                <p className="text-foreground text-sm font-medium">
                    We're diving deep on this one.
                </p>
                <p className="text-foreground/70 text-xs">
                    Close the tab if you need to—we'll be here when you return.
                </p>
            </div>
        </motion.div>
    );
}
