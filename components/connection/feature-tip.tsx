"use client";

/**
 * FeatureTip - Contextual feature discovery tips
 *
 * Shows above the composer when thread is empty, introducing users to
 * Carmenta's capabilities. Uses variable reward psychology - tips appear
 * with decreasing frequency over time to feel special rather than nagging.
 *
 * Design: Compact gradient bar with soft purple-to-cyan gradient matching
 * the Carmenta brand. Animates in smoothly, dismisses on user engagement.
 *
 * Engagements:
 * - navigate: Go to a page (internal or external)
 * - highlight: Flash/pulse a UI element
 * - open-panel: Open settings or model selector
 * - prefill: Put demo text in composer
 * - dismiss: Just close the tip
 */

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { XIcon, ArrowRightIcon, SparkleIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { Feature } from "@/lib/features/feature-catalog";
import { useHighlightElement } from "@/lib/hooks/use-highlight-element";

export interface FeatureTipProps {
    /** The feature to display as a tip */
    feature: Feature;
    /** Called when user dismisses the tip (X button) */
    onDismiss: () => void;
    /** Called when user engages with the tip (CTA button) */
    onEngage: () => void;
    /** Optional: Prefill composer with text (for prefill engagement type) */
    onPrefill?: (text: string) => void;
    /** Optional className for container */
    className?: string;
}

/**
 * Compact gradient bar tip component.
 *
 * Layout: [✨ Icon] [Title + Description] [CTA Button] [X]
 * Mobile: Stacks vertically with full-width CTA
 */
export function FeatureTip({
    feature,
    onDismiss,
    onEngage,
    onPrefill,
    className,
}: FeatureTipProps) {
    const router = useRouter();
    const { highlightElement } = useHighlightElement();
    const [isExiting, setIsExiting] = useState(false);

    const handleEngage = useCallback(() => {
        const engagement = feature.engagement;
        if (!engagement) {
            // No engagement defined - just dismiss
            onEngage();
            return;
        }

        const action = engagement.action;

        switch (action.type) {
            case "navigate":
                if (action.external) {
                    window.open(action.href, "_blank", "noopener,noreferrer");
                } else {
                    router.push(action.href);
                }
                break;

            case "highlight":
                highlightElement(action.element, action.duration);
                break;

            case "open-panel":
                // TODO: Implement panel opening
                // For now, highlight the model selector as a fallback
                if (action.panel === "model-selector") {
                    highlightElement("model-selector", 2000);
                }
                break;

            case "prefill":
                if (onPrefill) {
                    onPrefill(action.text);
                }
                break;

            case "dismiss":
                // Just close - no additional action
                break;
        }

        onEngage();
    }, [feature.engagement, onEngage, router, highlightElement, onPrefill]);

    const handleDismiss = useCallback(() => {
        setIsExiting(true);
        // Let exit animation play before calling parent
        setTimeout(() => onDismiss(), 200);
    }, [onDismiss]);

    const engagement = feature.engagement;

    return (
        <AnimatePresence>
            {!isExiting && (
                <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{
                        duration: 0.3,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                    className={cn(
                        // Base container
                        "relative w-full overflow-hidden rounded-xl",
                        // Gradient background - soft purple to cyan
                        "via-primary/10 bg-gradient-to-r from-purple-500/10 to-cyan-500/10",
                        // Border and shadow
                        "border-primary/20 border shadow-sm",
                        // Backdrop blur for glass effect
                        "backdrop-blur-sm",
                        className
                    )}
                >
                    {/* Content row */}
                    <div className="flex items-center gap-3 px-3 py-2.5 @md:px-4 @md:py-3">
                        {/* Icon */}
                        <div className="text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/50 dark:bg-black/30">
                            <SparkleIcon className="h-4 w-4" weight="fill" />
                        </div>

                        {/* Text content - grows to fill */}
                        <div className="min-w-0 flex-1">
                            <p className="text-foreground text-sm leading-tight font-medium">
                                {feature.tipTitle}
                            </p>
                            <p className="text-foreground/60 mt-0.5 text-xs">
                                {feature.tipDescription}
                            </p>
                        </div>

                        {/* CTA button - only if engagement exists */}
                        {engagement && (
                            <button
                                onClick={handleEngage}
                                className={cn(
                                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                    "bg-primary/20 text-primary hover:bg-primary/30",
                                    "focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none"
                                )}
                            >
                                {engagement.label}
                                <ArrowRightIcon className="h-3 w-3" />
                            </button>
                        )}

                        {/* Dismiss button */}
                        <button
                            onClick={handleDismiss}
                            aria-label="Dismiss tip"
                            className={cn(
                                "text-foreground/40 hover:text-foreground/70 shrink-0 rounded-md p-1 transition-colors",
                                "focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none"
                            )}
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Subtle animated gradient accent line */}
                    <div className="via-primary/30 absolute right-0 bottom-0 left-0 h-0.5 bg-gradient-to-r from-purple-500/30 to-cyan-500/30" />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Wrapper that handles tip display logic with oracle whisper integration.
 *
 * This component:
 * - Listens for user engagement events (dismisses tips when user starts typing)
 * - Tracks tip visibility state
 * - Provides the FeatureTip with callbacks
 */
export interface FeatureTipWhisperProps {
    /** The feature to display */
    feature: Feature | null;
    /** Called when tip is dismissed or engaged */
    onComplete: (state: "dismissed" | "engaged") => void;
    /** Called to prefill composer */
    onPrefill?: (text: string) => void;
    /** Optional className */
    className?: string;
}

export function FeatureTipWhisper({
    feature,
    onComplete,
    onPrefill,
    className,
}: FeatureTipWhisperProps) {
    if (!feature) return null;

    return (
        <FeatureTip
            feature={feature}
            onDismiss={() => onComplete("dismissed")}
            onEngage={() => onComplete("engaged")}
            onPrefill={onPrefill}
            className={className}
        />
    );
}
