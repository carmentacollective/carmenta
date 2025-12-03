"use client";

/**
 * Variant: Composer Button (Refined FAB)
 *
 * Lives next to the send button in the chat input.
 * Icon reflects current model - sparkles for auto, provider logo when selected.
 * Three approaches for temperature/reasoning controls:
 *   A) Stepped slider with labels
 *   B) Segmented pill buttons
 *   C) Visual meter/gauge
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

import type { ModelSelectorProps, ReasoningOverride } from "./types";

type ControlStyle = "slider" | "segments" | "meter";

interface ComposerButtonProps extends ModelSelectorProps {
    /** Which control style to demonstrate */
    controlStyle?: ControlStyle;
    /** Current model selected by concierge (for icon display) */
    conciergeModel?: ModelConfig | null;
}

export function ModelSelectorComposerButton({
    overrides,
    onChange,
    disabled,
    className,
    controlStyle = "slider",
    conciergeModel,
}: ComposerButtonProps) {
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
                            "rounded-2xl bg-white/95 backdrop-blur-xl",
                            "shadow-2xl ring-1 ring-black/5",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
                            "p-4"
                        )}
                    >
                        {/* Header */}
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-foreground/80">
                                    Response Settings
                                </h3>
                                <p className="text-xs text-foreground/50">
                                    {hasOverrides
                                        ? "Custom configuration"
                                        : "Carmenta chooses based on your query"}
                                </p>
                            </div>
                            {hasOverrides && (
                                <button
                                    onClick={() => {
                                        onChange({
                                            modelId: null,
                                            temperature: null,
                                            reasoning: null,
                                        });
                                    }}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Reset
                                </button>
                            )}
                        </div>

                        {/* Model Selection */}
                        <div className="mb-5">
                            <label className="mb-2 block text-xs font-medium text-foreground/60">
                                Model
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {/* Auto option */}
                                <button
                                    onClick={() =>
                                        onChange({ ...overrides, modelId: null })
                                    }
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all",
                                        overrides.modelId === null
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-foreground/5 hover:bg-foreground/10"
                                    )}
                                >
                                    <Sparkles
                                        className={cn(
                                            "h-5 w-5",
                                            overrides.modelId === null
                                                ? "text-primary"
                                                : "text-foreground/40"
                                        )}
                                    />
                                    <span className="text-xs font-medium">Auto</span>
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
                                            "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all",
                                            overrides.modelId === model.id
                                                ? "bg-primary/10 ring-1 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                        title={model.description}
                                    >
                                        <ProviderIcon
                                            provider={model.provider}
                                            className="h-5 w-5"
                                        />
                                        <span className="text-xs font-medium">
                                            {model.displayName.split(" ").pop()}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Creativity Control (Temperature) */}
                        <div className="mb-5">
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-medium text-foreground/60">
                                    Creativity
                                </label>
                                <span className="text-xs text-foreground/40">
                                    {overrides.temperature !== null
                                        ? (TEMPERATURE_PRESETS.find(
                                              (p) => p.value === overrides.temperature
                                          )?.label ?? overrides.temperature)
                                        : "Auto"}
                                </span>
                            </div>

                            {controlStyle === "slider" && (
                                <CreativitySlider
                                    value={overrides.temperature}
                                    onChange={(temp) =>
                                        onChange({
                                            ...overrides,
                                            temperature: temp,
                                        })
                                    }
                                />
                            )}

                            {controlStyle === "segments" && (
                                <CreativitySegments
                                    value={overrides.temperature}
                                    onChange={(temp) =>
                                        onChange({
                                            ...overrides,
                                            temperature: temp,
                                        })
                                    }
                                />
                            )}

                            {controlStyle === "meter" && (
                                <CreativityMeter
                                    value={overrides.temperature}
                                    onChange={(temp) =>
                                        onChange({
                                            ...overrides,
                                            temperature: temp,
                                        })
                                    }
                                />
                            )}
                        </div>

                        {/* Reasoning */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-medium text-foreground/60">
                                    Reasoning
                                </label>
                                <span className="text-xs text-foreground/40">
                                    {overrides.reasoning !== null
                                        ? REASONING_PRESETS.find(
                                              (p) => p.id === overrides.reasoning
                                          )?.label
                                        : "Auto"}
                                </span>
                            </div>

                            {controlStyle === "slider" && (
                                <ReasoningSlider
                                    value={overrides.reasoning}
                                    onChange={(reasoning) =>
                                        onChange({
                                            ...overrides,
                                            reasoning,
                                        })
                                    }
                                />
                            )}

                            {controlStyle === "segments" && (
                                <ThinkingSegments
                                    value={overrides.reasoning}
                                    onChange={(reasoning) =>
                                        onChange({
                                            ...overrides,
                                            reasoning,
                                        })
                                    }
                                />
                            )}

                            {controlStyle === "meter" && (
                                <ThinkingMeter
                                    value={overrides.reasoning}
                                    onChange={(reasoning) =>
                                        onChange({
                                            ...overrides,
                                            reasoning,
                                        })
                                    }
                                />
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Approach A: Stepped Slider with Labels
 * Continuous visual, but snaps to meaningful presets
 */
function CreativitySlider({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
}) {
    const presets = TEMPERATURE_PRESETS;
    const currentIndex =
        value !== null ? presets.findIndex((p) => p.value === value) : -1;

    return (
        <div className="space-y-2">
            <div className="relative h-10 pt-2">
                {/* Track */}
                <div className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/10">
                    {/* Fill */}
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 transition-all"
                        style={{
                            width:
                                currentIndex >= 0
                                    ? `${(currentIndex / (presets.length - 1)) * 100}%`
                                    : "0%",
                        }}
                    />
                </div>

                {/* Stops with labels */}
                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
                    {presets.map((preset, i) => (
                        <button
                            key={preset.value}
                            onClick={() => onChange(preset.value)}
                            className={cn(
                                "flex flex-col items-center transition-all",
                                "hover:scale-110"
                            )}
                            title={preset.description}
                        >
                            <div
                                className={cn(
                                    "h-4 w-4 rounded-full transition-all",
                                    currentIndex === i
                                        ? "scale-110 bg-white shadow-lg ring-2 ring-primary"
                                        : currentIndex > i
                                          ? "bg-white/80"
                                          : "bg-foreground/20"
                                )}
                            />
                            <span
                                className={cn(
                                    "mt-1.5 text-[10px] transition-colors",
                                    currentIndex === i
                                        ? "font-medium text-foreground/70"
                                        : "text-foreground/40"
                                )}
                            >
                                {preset.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Auto toggle */}
            <button
                onClick={() => onChange(null)}
                className={cn(
                    "mt-4 w-full rounded-lg py-1.5 text-xs transition-all",
                    value === null
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground/50 hover:bg-foreground/5"
                )}
            >
                {value === null ? "Carmenta chooses" : "Let Carmenta choose"}
            </button>
        </div>
    );
}

/**
 * Approach B: Segmented Pill Buttons
 * Clear, tappable, immediate feedback
 */
function CreativitySegments({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
}) {
    const options = [
        { value: null, label: "Auto", description: "Carmenta picks" },
        ...TEMPERATURE_PRESETS.map((p) => ({
            value: p.value,
            label: p.label,
            description: p.description,
        })),
    ];

    return (
        <div className="flex gap-1">
            {options.map((option) => (
                <button
                    key={option.label}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
                        value === option.value
                            ? "bg-primary text-white shadow-sm"
                            : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                    )}
                    title={option.description}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/**
 * Approach C: Visual Meter/Gauge
 * More playful, shows the spectrum visually
 */
function CreativityMeter({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
}) {
    const presets = TEMPERATURE_PRESETS;
    const currentIndex =
        value !== null ? presets.findIndex((p) => p.value === value) : -1;

    return (
        <div className="space-y-2">
            {/* Meter */}
            <div className="flex h-10 gap-1 rounded-xl bg-foreground/5 p-1">
                {presets.map((preset, i) => (
                    <button
                        key={preset.value}
                        onClick={() => onChange(preset.value)}
                        className={cn(
                            "flex-1 rounded-lg transition-all",
                            "flex items-center justify-center text-xs font-medium",
                            currentIndex === i
                                ? "bg-gradient-to-br from-primary/80 to-primary text-white shadow-sm"
                                : currentIndex > i
                                  ? "bg-primary/20 text-primary/70"
                                  : "text-foreground/40 hover:bg-foreground/10"
                        )}
                        title={preset.description}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {/* Auto option as subtle toggle */}
            <div className="flex items-center justify-center gap-2">
                <button
                    onClick={() => onChange(null)}
                    className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all",
                        value === null
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/40 hover:text-foreground/60"
                    )}
                >
                    <Sparkles className="h-3 w-3" />
                    {value === null ? "Carmenta choosing" : "Let Carmenta choose"}
                </button>
            </div>
        </div>
    );
}

/**
 * Reasoning controls - same three approaches
 */
function ReasoningSlider({
    value,
    onChange,
}: {
    value: ReasoningOverride | null;
    onChange: (value: ReasoningOverride | null) => void;
}) {
    // Filter out "auto" since we handle that separately
    const presets = REASONING_PRESETS.filter((p) => p.id !== "auto");
    const currentIndex = value !== null ? presets.findIndex((p) => p.id === value) : -1;

    return (
        <div className="space-y-2">
            <div className="relative h-10 pt-2">
                {/* Track */}
                <div className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/10">
                    {/* Fill */}
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 transition-all"
                        style={{
                            width:
                                currentIndex >= 0
                                    ? `${(currentIndex / (presets.length - 1)) * 100}%`
                                    : "0%",
                        }}
                    />
                </div>

                {/* Stops with labels */}
                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
                    {presets.map((preset, i) => (
                        <button
                            key={preset.id}
                            onClick={() => onChange(preset.id as ReasoningOverride)}
                            className={cn(
                                "flex flex-col items-center transition-all",
                                "hover:scale-110"
                            )}
                            title={preset.description}
                        >
                            <div
                                className={cn(
                                    "h-4 w-4 rounded-full transition-all",
                                    currentIndex === i
                                        ? "scale-110 bg-white shadow-lg ring-2 ring-cyan-500"
                                        : currentIndex > i
                                          ? "bg-white/80"
                                          : "bg-foreground/20"
                                )}
                            />
                            <span
                                className={cn(
                                    "mt-1.5 text-[10px] transition-colors",
                                    currentIndex === i
                                        ? "font-medium text-foreground/70"
                                        : "text-foreground/40"
                                )}
                            >
                                {preset.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Auto toggle */}
            <button
                onClick={() => onChange(null)}
                className={cn(
                    "mt-4 w-full rounded-lg py-1.5 text-xs transition-all",
                    value === null
                        ? "bg-cyan-500/10 font-medium text-cyan-600"
                        : "text-foreground/50 hover:bg-foreground/5"
                )}
            >
                {value === null ? "Carmenta chooses" : "Let Carmenta choose"}
            </button>
        </div>
    );
}

function ThinkingSegments({
    value,
    onChange,
}: {
    value: ReasoningOverride | null;
    onChange: (value: ReasoningOverride | null) => void;
}) {
    const options = REASONING_PRESETS.map((p) => ({
        value: (p.id === "auto" ? null : p.id) as ReasoningOverride | null,
        label: p.label,
        description: p.description,
    }));

    return (
        <div className="flex gap-1">
            {options.map((option) => (
                <button
                    key={option.label}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
                        value === option.value
                            ? "bg-cyan-500 text-white shadow-sm"
                            : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                    )}
                    title={option.description}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function ThinkingMeter({
    value,
    onChange,
}: {
    value: ReasoningOverride | null;
    onChange: (value: ReasoningOverride | null) => void;
}) {
    const presets = REASONING_PRESETS.filter((p) => p.id !== "auto");
    const currentIndex = value !== null ? presets.findIndex((p) => p.id === value) : -1;

    return (
        <div className="space-y-2">
            {/* Meter */}
            <div className="flex h-10 gap-1 rounded-xl bg-foreground/5 p-1">
                {presets.map((preset, i) => (
                    <button
                        key={preset.id}
                        onClick={() => onChange(preset.id as ReasoningOverride)}
                        className={cn(
                            "flex-1 rounded-lg transition-all",
                            "flex items-center justify-center text-xs font-medium",
                            currentIndex === i
                                ? "bg-gradient-to-br from-cyan-500/80 to-cyan-600 text-white shadow-sm"
                                : currentIndex > i
                                  ? "bg-cyan-500/20 text-cyan-600/70"
                                  : "text-foreground/40 hover:bg-foreground/10"
                        )}
                        title={preset.description}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {/* Auto option */}
            <div className="flex items-center justify-center gap-2">
                <button
                    onClick={() => onChange(null)}
                    className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all",
                        value === null
                            ? "bg-cyan-500/10 font-medium text-cyan-600"
                            : "text-foreground/40 hover:text-foreground/60"
                    )}
                >
                    <Sparkles className="h-3 w-3" />
                    {value === null ? "Carmenta choosing" : "Let Carmenta choose"}
                </button>
            </div>
        </div>
    );
}
