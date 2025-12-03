"use client";

/**
 * Variant 2: Inline Collapsible Panel
 *
 * A subtle trigger that expands into an inline panel below the input.
 * Shows current settings in a compact form when collapsed.
 */

import { useState } from "react";
import { ChevronDown, Sparkles, Thermometer, Brain } from "lucide-react";

import { MODELS, TEMPERATURE_PRESETS, REASONING_PRESETS } from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { ModelSelectorProps } from "./types";

export function ModelSelectorCollapsible({
    overrides,
    onChange,
    disabled,
    className,
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const selectedModel = overrides.modelId
        ? MODELS.find((m) => m.id === overrides.modelId)
        : null;

    const selectedTemp =
        overrides.temperature !== null
            ? TEMPERATURE_PRESETS.find((p) => p.value === overrides.temperature)
            : null;

    const selectedReasoning =
        overrides.reasoning !== null
            ? REASONING_PRESETS.find((p) => p.id === overrides.reasoning)
            : null;

    const isAuto = !selectedModel && !selectedTemp && !selectedReasoning;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("w-full", className)}
        >
            <CollapsibleTrigger
                disabled={disabled}
                className={cn(
                    "group flex w-full items-center justify-between rounded-xl px-4 py-2.5 transition-all",
                    "bg-white/40 backdrop-blur-sm",
                    "hover:bg-white/60",
                    isOpen && "bg-white/60 ring-1 ring-primary/20",
                    disabled && "cursor-not-allowed opacity-50"
                )}
            >
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            "bg-gradient-to-br from-primary/20 to-primary/10"
                        )}
                    >
                        {selectedModel ? (
                            <ProviderIcon
                                provider={selectedModel.provider}
                                className="h-4 w-4 text-foreground/70"
                            />
                        ) : (
                            <Sparkles className="h-4 w-4 text-primary" />
                        )}
                    </div>

                    <div className="text-left">
                        <div className="text-sm font-medium text-foreground/80">
                            {isAuto
                                ? "Carmenta Chooses"
                                : (selectedModel?.displayName ?? "Custom")}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-foreground/50">
                            {selectedTemp && (
                                <span className="flex items-center gap-1">
                                    <Thermometer className="h-3 w-3" />
                                    {selectedTemp.label}
                                </span>
                            )}
                            {selectedReasoning && (
                                <span className="flex items-center gap-1">
                                    <Brain className="h-3 w-3" />
                                    {selectedReasoning.label}
                                </span>
                            )}
                            {isAuto && "Automatic model selection"}
                        </div>
                    </div>
                </div>

                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-foreground/40 transition-transform",
                        isOpen && "rotate-180"
                    )}
                />
            </CollapsibleTrigger>

            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <div
                    className={cn(
                        "mt-2 rounded-xl bg-white/60 p-4 backdrop-blur-sm",
                        "ring-1 ring-black/5"
                    )}
                >
                    {/* Model Grid */}
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground/60">
                                Model
                            </label>
                            {overrides.modelId && (
                                <button
                                    onClick={() =>
                                        onChange({ ...overrides, modelId: null })
                                    }
                                    className="text-xs text-primary/70 hover:text-primary"
                                >
                                    Use Auto
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {MODELS.map((model) => (
                                <button
                                    key={model.id}
                                    onClick={() =>
                                        onChange({ ...overrides, modelId: model.id })
                                    }
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 rounded-lg p-3 transition-all",
                                        overrides.modelId === model.id
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-foreground/5 hover:bg-foreground/10"
                                    )}
                                >
                                    <ProviderIcon
                                        provider={model.provider}
                                        className="h-5 w-5"
                                    />
                                    <span className="text-xs font-medium">
                                        {model.displayName.split(" ")[1] ??
                                            model.displayName}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Temperature Slider */}
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground/60">
                                Temperature
                            </label>
                            <span className="text-xs text-foreground/50">
                                {overrides.temperature !== null
                                    ? overrides.temperature.toFixed(1)
                                    : "Auto"}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {TEMPERATURE_PRESETS.map((preset, i) => (
                                <button
                                    key={preset.value}
                                    onClick={() =>
                                        onChange({
                                            ...overrides,
                                            temperature: preset.value,
                                        })
                                    }
                                    className={cn(
                                        "flex-1 py-2 text-center text-xs transition-all",
                                        i === 0 && "rounded-l-lg",
                                        i === TEMPERATURE_PRESETS.length - 1 &&
                                            "rounded-r-lg",
                                        overrides.temperature === preset.value
                                            ? "bg-primary text-white"
                                            : "bg-foreground/10 text-foreground/70 hover:bg-foreground/15"
                                    )}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reasoning Depth */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground/60">
                                Reasoning Depth
                            </label>
                        </div>
                        <div className="flex gap-2">
                            {REASONING_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() =>
                                        onChange({
                                            ...overrides,
                                            reasoning:
                                                preset.id === "auto" ? null : preset.id,
                                        })
                                    }
                                    className={cn(
                                        "flex-1 rounded-lg py-2 text-center text-xs transition-all",
                                        (preset.id === "auto" &&
                                            overrides.reasoning === null) ||
                                            overrides.reasoning === preset.id
                                            ? "bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                                            : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                                    )}
                                    title={preset.description}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
