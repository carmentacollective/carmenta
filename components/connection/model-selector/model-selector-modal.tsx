"use client";

/**
 * ModelSelectorModal - Full-screen model selection experience
 *
 * Uses shadcn Dialog (Radix) for proper modal behavior:
 * - Escape to close, backdrop click to close
 * - Focus trap, scroll lock, portal rendering
 * - Proper viewport constraints
 */

import { useRef, useState, useEffect } from "react";
import { Sparkles, Check, Info, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    MODELS,
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

/** Generate tooltip HTML for a model's detailed info */
function getModelTooltipHtml(model: ModelConfig): string {
    const speedQuality = SPEED_QUALITY_DISPLAY[model.speedQuality];
    const contextFormatted = formatContextWindow(model.contextWindow);
    const attachmentTypes = model.attachments.join(", ") || "None";

    return `
<div style="max-width: 280px;">
  <div style="font-weight: 600; margin-bottom: 6px;">${model.displayName}</div>
  <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">${model.description}</div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
    <div><span style="opacity: 0.6;">Context:</span> ${contextFormatted}</div>
    <div><span style="opacity: 0.6;">Speed:</span> ${model.tokensPerSecond} tok/s</div>
    <div><span style="opacity: 0.6;">Type:</span> ${speedQuality.label}</div>
    <div><span style="opacity: 0.6;">Files:</span> ${attachmentTypes}</div>
  </div>
  ${model.tags.length > 0 ? `<div style="margin-top: 8px; font-size: 11px;">${model.tags.map((t) => TAG_EMOJI[t] + " " + t).join(" · ")}</div>` : ""}
</div>`.trim();
}

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
                : "✨",
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
                    : "🧠",
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
}: ModelSelectorModalProps) {
    const [switchingTo, setSwitchingTo] = useState<string | null>(null);
    const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { trigger: triggerHaptic } = useHapticFeedback();

    // Clear switch timeout on unmount
    useEffect(() => {
        return () => {
            if (switchTimeoutRef.current) {
                clearTimeout(switchTimeoutRef.current);
            }
        };
    }, []);

    // Find current index for creativity slider
    const creativityIndex =
        overrides.temperature !== null
            ? Math.max(
                  0,
                  TEMPERATURE_PRESETS.findIndex(
                      (p) => p.value === overrides.temperature
                  )
              )
            : 1;

    // Find current index for reasoning slider
    const reasoningPresets = REASONING_PRESETS.filter((p) => p.id !== "auto");
    const reasoningIndex =
        overrides.reasoning !== null
            ? Math.max(
                  0,
                  reasoningPresets.findIndex((p) => p.id === overrides.reasoning)
              )
            : 0;

    const handleModelSelect = (modelId: string | null) => {
        triggerHaptic();
        setSwitchingTo(modelId ?? "auto");
        onChange({ ...overrides, modelId });
        if (switchTimeoutRef.current) {
            clearTimeout(switchTimeoutRef.current);
        }
        switchTimeoutRef.current = setTimeout(() => setSwitchingTo(null), 300);
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
                {/* Hidden title for accessibility */}
                <DialogTitle className="sr-only">Select Model</DialogTitle>

                {/* HERO: Automagically Selection */}
                <div className="from-primary/8 via-primary/12 to-primary/6 shrink-0 bg-gradient-to-br p-6">
                    <button
                        onClick={() => handleModelSelect(null)}
                        className={cn(
                            "relative flex w-full items-center gap-5 rounded-2xl p-5 text-left transition-all",
                            overrides.modelId === null
                                ? "ring-primary/50 bg-white/90 shadow-xl ring-2 dark:bg-white/15"
                                : "bg-white/50 hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/15"
                        )}
                    >
                        <span className="from-primary absolute -top-2 left-4 rounded-full bg-gradient-to-r to-purple-500 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase shadow-sm">
                            Recommended
                        </span>
                        <div className="from-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br to-purple-500 shadow-lg">
                            {switchingTo === "auto" ? (
                                <Loader2 className="h-7 w-7 animate-spin text-white" />
                            ) : (
                                <Sparkles className="h-7 w-7 text-white" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <span
                                className={cn(
                                    "text-xl font-bold",
                                    overrides.modelId === null
                                        ? "from-primary bg-gradient-to-r to-purple-500 bg-clip-text text-transparent"
                                        : "text-foreground/90"
                                )}
                            >
                                Automagically
                            </span>
                            <p className="text-foreground/60 mt-1 text-sm">
                                Picks the best model for your message
                            </p>
                        </div>
                        {overrides.modelId === null && (
                            <div className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-md">
                                <Check className="h-5 w-5 text-white" />
                            </div>
                        )}
                    </button>
                </div>

                {/* Separator */}
                <div className="via-foreground/15 h-px shrink-0 bg-gradient-to-r from-transparent to-transparent" />

                {/* Model cards grid - scrollable middle section */}
                <div className="bg-muted/30 min-h-0 flex-1 overflow-y-auto p-5 dark:bg-transparent">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {MODELS.map((model) => {
                            const speedQuality =
                                SPEED_QUALITY_DISPLAY[model.speedQuality];
                            const isSelected = overrides.modelId === model.id;
                            const isSwitching = switchingTo === model.id;

                            return (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelSelect(model.id)}
                                    className={cn(
                                        "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                                        isSelected
                                            ? "border-primary/50 bg-primary/10 shadow-primary/20 ring-primary/50 dark:bg-primary/12 shadow-lg ring-2"
                                            : "border-border/50 bg-background hover:border-border hover:bg-muted/50 dark:bg-foreground/5 dark:hover:bg-foreground/10 hover:-translate-y-0.5 hover:shadow-md"
                                    )}
                                >
                                    <div
                                        className="absolute top-2 right-2 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                                        data-tooltip-id="tip"
                                        data-tooltip-html={getModelTooltipHtml(model)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Info className="text-foreground/40 hover:text-foreground/70 h-3.5 w-3.5 transition-colors" />
                                    </div>
                                    <div className="relative mt-0.5 h-6 w-6 shrink-0">
                                        {isSwitching ? (
                                            <Loader2 className="text-primary h-6 w-6 animate-spin" />
                                        ) : (
                                            <ProviderIcon
                                                provider={model.provider}
                                                className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 pr-6">
                                            <div className="flex items-center gap-2">
                                                <span className="text-foreground/90 font-semibold">
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
                                            <span className="text-foreground/40 text-[10px] tabular-nums">
                                                {formatContextWindow(
                                                    model.contextWindow
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-foreground/50 mt-1 text-xs leading-relaxed">
                                            {model.description}
                                        </p>
                                        {model.tags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {model.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="bg-muted text-muted-foreground dark:bg-foreground/5 dark:text-foreground/60 rounded-full px-1.5 py-0.5 text-[10px]"
                                                    >
                                                        {TAG_EMOJI[tag]} {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <div className="bg-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm">
                                            <Check className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Slider Footer */}
                <div className="border-border bg-muted/50 dark:border-foreground/10 shrink-0 border-t dark:bg-white/5">
                    <div className="flex flex-col sm:flex-row">
                        <div className="flex-1 p-4">
                            <SteppedSlider
                                label="Creativity"
                                value={creativityIndex >= 0 ? creativityIndex : 1}
                                onChange={handleCreativityChange}
                                presets={CREATIVITY_SLIDER_PRESETS}
                                theme="primary"
                                progressMode={false}
                            />
                        </div>
                        <div className="mx-2 hidden items-center sm:flex">
                            <div className="via-foreground/20 h-16 w-px bg-gradient-to-b from-transparent to-transparent" />
                        </div>
                        <div className="via-foreground/20 mx-4 h-px bg-gradient-to-r from-transparent to-transparent sm:hidden" />
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
                    <div className="border-border dark:border-foreground/10 flex justify-center border-t p-2">
                        <button
                            onClick={() => {
                                onChange({
                                    modelId: null,
                                    temperature: null,
                                    reasoning: null,
                                });
                                onClose();
                            }}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
                        >
                            <Sparkles className="h-3 w-3" />
                            Let Carmenta decide automagically
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
