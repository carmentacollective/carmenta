"use client";

/**
 * ModelSelectorPopover - Advanced model selection UI
 *
 * A composer button that opens a popover for:
 * - Model selection (Auto or specific models) - scrollable list with details
 * - Creativity control (5 levels: Precise -> Expressive)
 * - Reasoning control (5 levels: None -> Maximum)
 *
 * Uses Variant 5 detailed list for models, Variant 2 stepped sliders for controls.
 */

import { useState } from "react";
import { Sparkles, X, RotateCcw } from "lucide-react";

import {
    MODELS,
    PROVIDERS,
    TEMPERATURE_PRESETS,
    REASONING_PRESETS,
    type ModelConfig,
    type SpeedQuality,
    type ModelTag,
} from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";
import { SteppedSlider } from "./stepped-slider";

import type { ModelOverrides, ReasoningOverride } from "./types";

/** Extract version from model ID (e.g., "anthropic/claude-sonnet-4.5" -> "4.5") */
function getVersion(model: ModelConfig): string {
    const parts = model.id.split("/")[1]?.split("-") ?? [];
    const version = parts.find((p) => /^\d/.test(p));
    return version ?? "";
}

/** Speed/quality display config */
const SPEED_QUALITY_DISPLAY: Record<
    SpeedQuality,
    { label: string; emoji: string; color: string }
> = {
    fast: { label: "Fast", emoji: "⚡", color: "text-amber-500" },
    balanced: { label: "Balanced", emoji: "⚖️", color: "text-blue-500" },
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

            {/* Popover - uses fixed positioning to escape stacking context */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsOpen(false)}
                    />

                    <div
                        className={cn(
                            "fixed bottom-24 right-4 z-[101] w-80",
                            "max-h-[calc(100vh-8rem)]",
                            "rounded-2xl bg-white backdrop-blur-xl",
                            "shadow-2xl ring-1 ring-black/10",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
                            "flex flex-col overflow-hidden"
                        )}
                    >
                        {/* Model Selection - scrollable list with details */}
                        <div className="bg-white p-3 pb-2">
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
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
                            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-foreground/10 bg-gradient-to-b from-foreground/[0.02] to-foreground/[0.04] p-1.5">
                                {/* Auto option */}
                                <button
                                    onClick={() =>
                                        onChange({ ...overrides, modelId: null })
                                    }
                                    className={cn(
                                        "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-all",
                                        overrides.modelId === null
                                            ? "bg-white shadow-sm ring-1 ring-primary/20"
                                            : "hover:bg-white/50"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles
                                            className={cn(
                                                "h-4 w-4",
                                                overrides.modelId === null
                                                    ? "text-primary"
                                                    : "text-foreground/40"
                                            )}
                                        />
                                        <span className="text-sm font-medium">
                                            Auto
                                        </span>
                                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                            Recommended
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground/50">
                                        Carmenta analyzes your request and picks the
                                        best model
                                    </p>
                                </button>

                                {/* Model options - detailed cards */}
                                {MODELS.map((model) => {
                                    const version = getVersion(model);
                                    const speedQuality =
                                        SPEED_QUALITY_DISPLAY[model.speedQuality];

                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() =>
                                                onChange({
                                                    ...overrides,
                                                    modelId: model.id,
                                                })
                                            }
                                            className={cn(
                                                "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-all",
                                                overrides.modelId === model.id
                                                    ? "bg-white shadow-sm ring-1 ring-primary/20"
                                                    : "hover:bg-white/50"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <ProviderIcon
                                                    provider={model.provider}
                                                    className="h-4 w-4"
                                                />
                                                <span className="text-sm font-medium">
                                                    {
                                                        PROVIDERS[model.provider]
                                                            .displayName
                                                    }
                                                </span>
                                                <span className="text-sm text-foreground/60">
                                                    {model.displayName.split(" ").pop()}
                                                </span>
                                                {version && (
                                                    <span className="text-xs text-foreground/30">
                                                        {version}
                                                    </span>
                                                )}
                                                <span
                                                    className={cn(
                                                        "ml-auto text-xs",
                                                        speedQuality.color
                                                    )}
                                                >
                                                    {speedQuality.emoji}{" "}
                                                    {speedQuality.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-foreground/50">
                                                {model.description}
                                            </p>
                                            {model.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {model.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/60"
                                                        >
                                                            {TAG_EMOJI[tag]} {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Response Tuning Section - visually distinct */}
                        <div className="border-t-2 border-foreground/10 bg-gradient-to-b from-slate-50/80 to-slate-100/60">
                            {/* Creativity Slider */}
                            <div className="px-3 pb-2 pt-3">
                                <SteppedSlider
                                    label="Creativity"
                                    value={creativityIndex >= 0 ? creativityIndex : 2}
                                    onChange={(index) =>
                                        onChange({
                                            ...overrides,
                                            temperature:
                                                TEMPERATURE_PRESETS[index].value,
                                        })
                                    }
                                    presets={CREATIVITY_SLIDER_PRESETS}
                                    theme="primary"
                                    disabled={disabled}
                                    progressMode={false}
                                />
                            </div>

                            {/* Reasoning Slider */}
                            <div className="px-3 py-2">
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
                            <div className="flex justify-center border-t border-foreground/10 p-2">
                                <button
                                    onClick={() => {
                                        onChange({
                                            modelId: null,
                                            temperature: null,
                                            reasoning: null,
                                        });
                                        setIsOpen(false);
                                    }}
                                    className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-white hover:text-foreground/70"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Carmenta AI Concierge decides automagically
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
