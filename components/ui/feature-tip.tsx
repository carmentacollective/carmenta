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
 * - Actionable: CTAs help users discover how to use features
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkle, ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { getRandomTip, type Feature } from "@/lib/features/feature-catalog";
import { useSettingsModal } from "@/components/connection/connect-runtime-provider";

interface FeatureTipProps {
    className?: string;
}

export function FeatureTip({ className }: FeatureTipProps) {
    // Select tip on client-side only to avoid hydration mismatch
    // Server renders null, client picks a random tip on mount
    const [tip, setTip] = useState<Feature | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const { setSettingsOpen } = useSettingsModal();

    useEffect(() => {
        // Defer to next tick to avoid React Compiler lint warning
        // about synchronous setState in effects
        const timer = setTimeout(() => setTip(getRandomTip()), 0);
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
    }, []);

    const handleCtaClick = useCallback(() => {
        if (tip?.cta?.action === "settings") {
            setSettingsOpen(true);
            setIsDismissed(true); // Dismiss tip after opening settings
        }
    }, [tip, setSettingsOpen]);

    // Show the tip if we have one and it hasn't been dismissed
    const showTip = tip && !isDismissed;

    return (
        <AnimatePresence>
            {showTip && (
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
                        <div className="from-primary/5 absolute inset-0 bg-gradient-to-br via-transparent to-cyan-500/5 opacity-60" />

                        {/* Content */}
                        <div className="relative z-10">
                            {/* Header with icon and dismiss */}
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                                        <Sparkle className="text-primary h-3.5 w-3.5" />
                                    </div>
                                    <h3 className="text-foreground/90 text-sm font-semibold">
                                        {tip.tipTitle}
                                    </h3>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleDismiss}
                                    className="text-foreground/40 hover:bg-foreground/10 hover:text-foreground/60 focus-visible:bg-foreground/10 focus-visible:text-foreground/60 focus-visible:ring-primary/50 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2"
                                    aria-label="Dismiss tip"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* Description */}
                            <p className="text-foreground/70 text-sm leading-relaxed">
                                {tip.tipDescription}
                            </p>

                            {/* Coming soon badge */}
                            {!tip.available && (
                                <span className="bg-primary/15 text-primary mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                                    <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
                                    Coming soon
                                </span>
                            )}

                            {/* Optional media */}
                            {tip.media && (
                                <div className="border-foreground/10 mt-3 overflow-hidden rounded-lg border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={tip.media.src}
                                        alt={tip.media.alt}
                                        className="h-auto w-full"
                                    />
                                </div>
                            )}

                            {/* CTA button - only show for available features */}
                            {tip.cta && tip.available && (
                                <div className="mt-3">
                                    {tip.cta.action === "link" && tip.cta.href && (
                                        <Link
                                            href={tip.cta.href}
                                            target={
                                                tip.cta.external ? "_blank" : undefined
                                            }
                                            rel={
                                                tip.cta.external
                                                    ? "noopener noreferrer"
                                                    : undefined
                                            }
                                            className="btn-glass-interactive text-foreground/80 hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                                        >
                                            {tip.cta.label}
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                    )}
                                    {tip.cta.action === "settings" && (
                                        <button
                                            type="button"
                                            onClick={handleCtaClick}
                                            className="btn-glass-interactive text-foreground/80 hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                                        >
                                            {tip.cta.label}
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
