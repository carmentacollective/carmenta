"use client";

/**
 * FeatureTip - Rotating tips to highlight Carmenta functionality
 *
 * Displays a beautiful glass card with feature information on the new chat screen.
 * Tips rotate randomly to progressively educate users about capabilities.
 *
 * Design principles:
 * - Non-intrusive: subtle entrance, easy to dismiss
 * - Contextual: appears naturally below the greeting
 * - Concise: one tip at a time, brief content
 * - Beautiful: glass morphism matching Carmenta's aesthetic
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { getRandomTip } from "@/lib/tips/tips-config";

interface FeatureTipProps {
    className?: string;
}

export function FeatureTip({ className }: FeatureTipProps) {
    // Select a random tip once on component mount
    // useMemo with empty deps ensures stable selection across re-renders
    const tip = useMemo(() => getRandomTip(), []);
    const [isDismissed, setIsDismissed] = useState(false);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
    }, []);

    // Don't render until we have a tip (avoids hydration mismatch)
    if (!tip || isDismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{
                    duration: 0.5,
                    delay: 0.3, // Slight delay after greeting appears
                    ease: [0.16, 1, 0.3, 1], // expo-out for smooth entrance
                }}
                className={cn("w-full max-w-md", className)}
            >
                <div className="feature-tip-card group relative overflow-hidden rounded-2xl border border-white/20 bg-white/50 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
                    {/* Subtle gradient accent */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 opacity-60" />

                    {/* Content */}
                    <div className="relative z-10">
                        {/* Header with icon and dismiss */}
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground/90">
                                    {tip.title}
                                </h3>
                            </div>

                            <button
                                onClick={handleDismiss}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground/60"
                                aria-label="Dismiss tip"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {/* Description */}
                        <p className="text-sm leading-relaxed text-foreground/70">
                            {tip.description}
                        </p>

                        {/* Optional media */}
                        {tip.media && (
                            <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={tip.media.src}
                                    alt={tip.media.alt}
                                    className="h-auto w-full"
                                />
                            </div>
                        )}

                        {/* Optional doc link */}
                        {tip.docUrl && (
                            <Link
                                href={tip.docUrl}
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                            >
                                Learn more
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
