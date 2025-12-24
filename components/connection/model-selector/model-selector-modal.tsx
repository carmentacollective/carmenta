"use client";

/**
 * ModelSelectorModal - Full-screen model selection experience
 *
 * Based on Design Lab Option 4: Hero Auto + Rich Cards
 * - No header bar (floating close button)
 * - Hero "Automagically" section with prominent gradient styling
 * - Two-column grid of model cards with full descriptions
 * - Scroll fade indicator
 * - Slider footer for Creativity and Reasoning
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check } from "lucide-react";

import {
    MODELS,
    PROVIDERS,
    TEMPERATURE_PRESETS,
    REASONING_PRESETS,
    type ModelConfig,
    type SpeedQuality,
    type ModelTag,
} from "@/lib/model-config";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";
import { SteppedSlider } from "./stepped-slider";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";

import type { ModelOverrides, ReasoningOverride } from "./types";

/** Speed/quality display config */
const SPEED_QUALITY_DISPLAY: Record<
    SpeedQuality,
    { label: string; emoji: string; color: string }
> = {
    fast: { label: "Fast", emoji: "⚡", color: "text-amber-500" },
    versatile: { label: "Versatile", emoji: "⚖️", color: "text-blue-500" },
    deep: { label: "Deep", emoji: "🔬", color: "text-purple-500" },
    specialized: { label: "Specialized", emoji: "✨", color: "text-green-500" },
};

/** Tag emoji mapping */
const TAG_EMOJI: Record<ModelTag, string> = {
    "Deep thinking": "🧠",
    "Long docs": "📚",
    "Live web": "🌐",
    Video: "🎬",
    Audio: "🎵",
    Tools: "🔧",
};

/** Format context window for display (e.g., 200000 → "200K", 1000000 → "1M") */
function formatContextWindow(tokens: number): string {
    if (tokens >= 1_000_000) {
        return `${tokens / 1_000_000}M`;
    }
    return `${tokens / 1_000}K`;
}

/** Creativity presets with emojis for the slider (4 levels) */
const CREATIVITY_SLIDER_PRESETS = TEMPERATURE_PRESETS.map((p) => ({
    label: p.label,
    emoji:
        p.label === "Precise"
            ? "🎯"
            : p.label === "Balanced"
              ? "⚖️"
              : p.label === "Creative"
                ? "🎨"
                : "✨", // Expressive
}));

/** Reasoning presets with emojis for the slider (4 levels, excluding "auto") */
const REASONING_SLIDER_PRESETS = REASONING_PRESETS.filter((p) => p.id !== "auto").map(
    (p) => ({
        label: p.label,
        emoji:
            p.label === "Quick"
                ? "⚡"
                : p.label === "Thoughtful"
                  ? "🏃"
                  : p.label === "Thorough"
                    ? "⚖️"
                    : "🧠", // Deep
    })
);

interface ModelSelectorModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** Current override values */
    overrides: ModelOverrides;
    /** Callback when overrides change */
    onChange: (overrides: ModelOverrides) => void;
    /** Current model selected by concierge (for display) */
    conciergeModel?: ModelConfig | null;
}

export function ModelSelectorModal({
    isOpen,
    onClose,
    overrides,
    onChange,
    conciergeModel,
}: ModelSelectorModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const { triggerHaptic } = useHapticFeedback();

    // Handle Escape key to close modal
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Find current index for creativity slider (fallback to Balanced if not found)
    const creativityIndex =
        overrides.temperature !== null
            ? Math.max(
                  0,
                  TEMPERATURE_PRESETS.findIndex(
                      (p) => p.value === overrides.temperature
                  )
              )
            : 1; // Default to "Balanced" (index 1 in 4-level array)

    // Find current index for reasoning slider (fallback to Quick if not found)
    const reasoningPresets = REASONING_PRESETS.filter((p) => p.id !== "auto");
    const reasoningIndex =
        overrides.reasoning !== null
            ? Math.max(
                  0,
                  reasoningPresets.findIndex((p) => p.id === overrides.reasoning)
              )
            : 0; // Default to "Quick" (index 0)

    const handleModelSelect = (modelId: string | null) => {
        triggerHaptic("medium"); // Haptic feedback on model selection
        onChange({ ...overrides, modelId });
    };

    const handleCreativityChange = (index: number) => {
        onChange({
            ...overrides,
            temperature: TEMPERATURE_PRESETS[index].value,
        });
    };

    const handleReasoningChange = (index: number) => {
        onChange({
            ...overrides,
            reasoning: reasoningPresets[index].id as ReasoningOverride,
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        ref={modalRef}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.4 }}
                        className="glass-container relative w-full max-w-2xl overflow-hidden rounded-2xl"
                    >
                        {/* Close button - floats in corner, no header bar */}
                        <button
                            onClick={onClose}
                            className="absolute right-3 top-3 z-10 rounded-full bg-white/60 p-2 text-foreground/50 shadow-sm backdrop-blur-sm transition-all hover:bg-white/80 hover:text-foreground/70 dark:bg-white/10 dark:hover:bg-white/20"
                            aria-label="Close model selector"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* HERO: Automagically Selection - Full width, unmistakably primary */}
                        <div className="from-primary/8 via-primary/12 to-primary/6 bg-gradient-to-br p-6">
                            <button
                                onClick={() => handleModelSelect(null)}
                                className={cn(
                                    "flex w-full items-center gap-5 rounded-2xl p-5 text-left transition-all",
                                    overrides.modelId === null
                                        ? "bg-white/90 shadow-xl ring-2 ring-primary/50 dark:bg-white/15"
                                        : "bg-white/50 hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/15"
                                )}
                            >
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 shadow-lg">
                                    <Sparkles className="h-7 w-7 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            "text-xl font-bold",
                                            overrides.modelId === null
                                                ? "bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
                                                : "text-foreground/90"
                                        )}
                                    >
                                        Automagically
                                    </span>
                                    <p className="mt-1 text-sm text-foreground/60">
                                        Picks the best model for your message
                                    </p>
                                </div>
                                {overrides.modelId === null && (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary shadow-md">
                                        <Check className="h-5 w-5 text-white" />
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* Strong visual separator */}
                        <div className="h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

                        {/* Model cards grid with scroll fade */}
                        <div className="relative">
                            <div className="max-h-80 overflow-y-auto p-5">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {MODELS.map((model) => {
                                        const speedQuality =
                                            SPEED_QUALITY_DISPLAY[model.speedQuality];
                                        const isSelected =
                                            overrides.modelId === model.id;

                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() =>
                                                    handleModelSelect(model.id)
                                                }
                                                className={cn(
                                                    "group flex items-start gap-3 rounded-xl p-4 text-left transition-all duration-200",
                                                    isSelected
                                                        ? "bg-primary/12 shadow-lg shadow-primary/20 ring-2 ring-primary/50"
                                                        : "bg-foreground/5 hover:-translate-y-0.5 hover:bg-foreground/10 hover:shadow-md"
                                                )}
                                            >
                                                <ProviderIcon
                                                    provider={model.provider}
                                                    className="mt-0.5 h-6 w-6 shrink-0 transition-transform duration-200 group-hover:scale-110"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-foreground/90">
                                                                {model.displayName}
                                                            </span>
                                                            <span
                                                                className={cn(
                                                                    "text-sm",
                                                                    speedQuality.color
                                                                )}
                                                            >
                                                                {speedQuality.emoji}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] tabular-nums text-foreground/40">
                                                            {formatContextWindow(
                                                                model.contextWindow
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs leading-relaxed text-foreground/50">
                                                        {model.description}
                                                    </p>
                                                    {model.tags.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {model.tags.map((tag) => (
                                                                <span
                                                                    key={tag}
                                                                    className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/60"
                                                                >
                                                                    {TAG_EMOJI[tag]}{" "}
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Consistent selection indicator */}
                                                {isSelected && (
                                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
                                                        <Check className="h-4 w-4 text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Scroll fade indicator at bottom */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/80 to-transparent dark:from-background/80" />
                        </div>

                        {/* Slider Footer - Same as popover */}
                        <div className="border-t-2 border-foreground/10 bg-gradient-to-b from-slate-50/80 to-slate-100/60 dark:from-white/5 dark:to-transparent">
                            {/* Two distinct sections with visual separator */}
                            <div className="flex flex-col sm:flex-row">
                                {/* Creativity section */}
                                <div className="flex-1 p-4">
                                    <SteppedSlider
                                        label="Creativity"
                                        value={
                                            creativityIndex >= 0 ? creativityIndex : 1
                                        }
                                        onChange={handleCreativityChange}
                                        presets={CREATIVITY_SLIDER_PRESETS}
                                        theme="primary"
                                        progressMode={false}
                                    />
                                </div>

                                {/* Strong visual divider */}
                                <div className="mx-2 hidden items-center sm:flex">
                                    <div className="h-16 w-px bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />
                                </div>
                                <div className="mx-4 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent sm:hidden" />

                                {/* Reasoning section */}
                                <div className="flex-1 p-4">
                                    <SteppedSlider
                                        label="Reasoning"
                                        value={reasoningIndex >= 0 ? reasoningIndex : 0}
                                        onChange={handleReasoningChange}
                                        presets={REASONING_SLIDER_PRESETS}
                                        theme="secondary"
                                        progressMode={true}
                                    />
                                </div>
                            </div>

                            {/* AI Concierge button */}
                            <div className="flex justify-center border-t border-foreground/10 p-2">
                                <button
                                    onClick={() => {
                                        onChange({
                                            modelId: null,
                                            temperature: null,
                                            reasoning: null,
                                        });
                                        onClose();
                                    }}
                                    className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs text-foreground/50 transition-all hover:bg-gradient-to-r hover:from-primary/10 hover:to-purple-500/10 hover:text-foreground/70"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Let Carmenta decide automagically
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
