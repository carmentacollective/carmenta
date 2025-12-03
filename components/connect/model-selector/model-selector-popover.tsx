"use client";

/**
 * ModelSelectorPopover - Advanced model selection UI
 *
 * A composer button that opens a popover for:
 * - Model selection (Auto or specific models)
 * - Creativity control (5 levels: Precise -> Expressive)
 * - Reasoning control (5 levels: None -> Maximum)
 *
 * Uses Variant 2 stepped slider design with segment-based tracks.
 */

import { useState } from "react";
import { Sparkles, X, RotateCcw } from "lucide-react";

import {
    MODELS,
    TEMPERATURE_PRESETS,
    REASONING_PRESETS,
    type ModelConfig,
} from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";
import { SteppedSlider } from "./stepped-slider";

import type { ModelOverrides, ReasoningOverride } from "./types";

/** Creativity presets with emojis for the slider */
const CREATIVITY_SLIDER_PRESETS = TEMPERATURE_PRESETS.map((p) => ({
    label: p.label,
    emoji:
        p.label === "Precise"
            ? "🎯"
            : p.label === "Focused"
              ? "🔍"
              : p.label === "Balanced"
                ? "⚖️"
                : p.label === "Creative"
                  ? "🎨"
                  : "✨",
}));

/** Reasoning presets with emojis for the slider (excluding "auto") */
const REASONING_SLIDER_PRESETS = REASONING_PRESETS.filter((p) => p.id !== "auto").map(
    (p) => ({
        label: p.label,
        emoji:
            p.label === "None"
                ? "⚡"
                : p.label === "Quick"
                  ? "🏃"
                  : p.label === "Balanced"
                    ? "⚖️"
                    : p.label === "Thorough"
                      ? "🔬"
                      : "🧠",
    })
);

interface ModelSelectorPopoverProps {
    /** Current override values */
    overrides: ModelOverrides;
    /** Callback when overrides change */
    onChange: (overrides: ModelOverrides) => void;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Current model selected by concierge (for icon display) */
    conciergeModel?: ModelConfig | null;
}

export function ModelSelectorPopover({
    overrides,
    onChange,
    disabled,
    className,
    conciergeModel,
}: ModelSelectorPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Determine which icon to show
    const manualModel = overrides.modelId
        ? MODELS.find((m) => m.id === overrides.modelId)
        : null;

    // Priority: manual override > concierge selection > auto sparkles
    const displayModel = manualModel ?? conciergeModel ?? null;
    const isAuto = overrides.modelId === null;

    const hasOverrides =
        overrides.modelId !== null ||
        overrides.temperature !== null ||
        overrides.reasoning !== null;

    // Find current index for creativity slider
    const creativityIndex =
        overrides.temperature !== null
            ? TEMPERATURE_PRESETS.findIndex((p) => p.value === overrides.temperature)
            : 2; // Default to "Balanced" (index 2)

    // Find current index for reasoning slider
    const reasoningPresets = REASONING_PRESETS.filter((p) => p.id !== "auto");
    const reasoningIndex =
        overrides.reasoning !== null
            ? reasoningPresets.findIndex((p) => p.id === overrides.reasoning)
            : 0; // Default to "None" (index 0)

    return (
        <div className={cn("relative", className)}>
            {/* Composer Button - sits next to send */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                    "bg-white/50 backdrop-blur-sm",
                    "hover:scale-105 hover:bg-white/70",
                    "active:scale-95",
                    hasOverrides && !isAuto
                        ? "ring-2 ring-primary/40"
                        : "ring-1 ring-white/40",
                    isOpen && "bg-white/70 ring-2 ring-primary/50",
                    disabled && "cursor-not-allowed opacity-50"
                )}
                aria-label="Model settings"
            >
                {isOpen ? (
                    <X className="h-4 w-4 text-foreground/60" />
                ) : displayModel ? (
                    <ProviderIcon
                        provider={displayModel.provider}
                        className={cn(
                            "h-4 w-4 transition-all duration-300",
                            isAuto ? "text-foreground/50" : "text-foreground/70"
                        )}
                    />
                ) : (
                    <Sparkles className="h-4 w-4 text-primary/70" />
                )}
            </button>

            {/* Popover */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    <div
                        className={cn(
                            "absolute bottom-12 right-0 z-50 w-80",
                            "max-h-[calc(100vh-8rem)] overflow-y-auto",
                            "rounded-2xl bg-white/95 backdrop-blur-xl",
                            "shadow-2xl ring-1 ring-black/5",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
                            "p-3"
                        )}
                    >
                        {/* Model Selection - horizontal scroll for scalability */}
                        <div className="mb-4">
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-medium text-foreground/60">
                                    Model
                                </label>
                                {hasOverrides && (
                                    <button
                                        onClick={() => {
                                            onChange({
                                                modelId: null,
                                                temperature: null,
                                                reasoning: null,
                                            });
                                        }}
                                        className="flex items-center gap-1 text-[10px] text-foreground/40 transition-colors hover:text-foreground/60"
                                    >
                                        <RotateCcw className="h-2.5 w-2.5" />
                                        Reset
                                    </button>
                                )}
                            </div>
                            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                                {/* Auto option */}
                                <button
                                    onClick={() =>
                                        onChange({ ...overrides, modelId: null })
                                    }
                                    className={cn(
                                        "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-all",
                                        overrides.modelId === null
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-foreground/5 hover:bg-foreground/10"
                                    )}
                                >
                                    <Sparkles
                                        className={cn(
                                            "h-4 w-4",
                                            overrides.modelId === null
                                                ? "text-primary"
                                                : "text-foreground/40"
                                        )}
                                    />
                                    <span className="text-[9px] font-medium">Auto</span>
                                </button>

                                {/* Model options - show short names */}
                                {MODELS.map((model) => (
                                    <button
                                        key={model.id}
                                        onClick={() =>
                                            onChange({
                                                ...overrides,
                                                modelId: model.id,
                                            })
                                        }
                                        className={cn(
                                            "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-all",
                                            overrides.modelId === model.id
                                                ? "bg-primary/10 ring-1 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                        title={model.description}
                                    >
                                        <ProviderIcon
                                            provider={model.provider}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-[9px] font-medium">
                                            {model.displayName.split(" ").pop()}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Creativity Slider - position mode (no fill between) */}
                        <div className="mb-5">
                            <SteppedSlider
                                label="Creativity"
                                value={creativityIndex >= 0 ? creativityIndex : 2}
                                onChange={(index) =>
                                    onChange({
                                        ...overrides,
                                        temperature: TEMPERATURE_PRESETS[index].value,
                                    })
                                }
                                presets={CREATIVITY_SLIDER_PRESETS}
                                theme="primary"
                                disabled={disabled}
                                progressMode={false}
                            />
                        </div>

                        {/* Reasoning Slider - progress mode (fills/builds) */}
                        <div className="mb-4">
                            <SteppedSlider
                                label="Reasoning"
                                value={reasoningIndex >= 0 ? reasoningIndex : 0}
                                onChange={(index) =>
                                    onChange({
                                        ...overrides,
                                        reasoning: reasoningPresets[index]
                                            .id as ReasoningOverride,
                                    })
                                }
                                presets={REASONING_SLIDER_PRESETS}
                                theme="cyan"
                                disabled={disabled}
                                progressMode={true}
                            />
                        </div>

                        {/* AI Concierge button */}
                        <div className="flex justify-center border-t border-foreground/5 pt-2">
                            <button
                                onClick={() => {
                                    onChange({
                                        modelId: null,
                                        temperature: null,
                                        reasoning: null,
                                    });
                                    setIsOpen(false);
                                }}
                                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
                            >
                                <Sparkles className="h-3 w-3" />
                                Carmenta AI Concierge decides automagically
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
