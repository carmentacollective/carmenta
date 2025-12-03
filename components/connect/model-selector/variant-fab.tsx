"use client";

/**
 * Variant 1: Floating Action Button with Radial Menu
 *
 * A minimal FAB in the corner that expands into a radial/popover menu
 * when clicked. Geeky but unobtrusive.
 */

import { useState } from "react";
import { Settings2, Sparkles, X } from "lucide-react";

import { MODELS, TEMPERATURE_PRESETS, REASONING_PRESETS } from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";

import type { ModelSelectorProps } from "./types";

export function ModelSelectorFAB({
    overrides,
    onChange,
    disabled,
    className,
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const hasOverrides =
        overrides.modelId !== null ||
        overrides.temperature !== null ||
        overrides.reasoning !== null;

    const selectedModel = overrides.modelId
        ? MODELS.find((m) => m.id === overrides.modelId)
        : null;

    return (
        <div className={cn("relative", className)}>
            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                    "bg-white/60 backdrop-blur-lg",
                    "shadow-lg hover:shadow-xl",
                    "hover:scale-105 active:scale-95",
                    hasOverrides ? "ring-2 ring-primary/50" : "ring-1 ring-white/40",
                    disabled && "cursor-not-allowed opacity-50"
                )}
                aria-label="Model settings"
            >
                {isOpen ? (
                    <X className="h-4 w-4 text-foreground/70" />
                ) : hasOverrides ? (
                    selectedModel ? (
                        <ProviderIcon
                            provider={selectedModel.provider}
                            className="h-4 w-4 text-foreground/70"
                        />
                    ) : (
                        <Settings2 className="h-4 w-4 text-primary" />
                    )
                ) : (
                    <Sparkles className="h-4 w-4 text-foreground/40" />
                )}
            </button>

            {/* Popover Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div
                        className={cn(
                            "absolute bottom-12 right-0 z-50 w-72",
                            "rounded-2xl bg-white/90 backdrop-blur-xl",
                            "shadow-2xl ring-1 ring-black/5",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
                            "p-4"
                        )}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-medium text-foreground/80">
                                Advanced Settings
                            </h3>
                            <button
                                onClick={() => {
                                    onChange({
                                        modelId: null,
                                        temperature: null,
                                        reasoning: null,
                                    });
                                }}
                                className="text-xs text-foreground/50 hover:text-foreground/70"
                            >
                                Reset to Auto
                            </button>
                        </div>

                        {/* Model Selection */}
                        <div className="mb-4">
                            <label className="mb-2 block text-xs font-medium text-foreground/60">
                                Model
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {/* Auto option */}
                                <button
                                    onClick={() =>
                                        onChange({ ...overrides, modelId: null })
                                    }
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all",
                                        overrides.modelId === null
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-foreground/5 hover:bg-foreground/10"
                                    )}
                                >
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    <span className="font-medium">Auto</span>
                                </button>

                                {/* Model options */}
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
                                            "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all",
                                            overrides.modelId === model.id
                                                ? "bg-primary/10 ring-1 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                    >
                                        <ProviderIcon
                                            provider={model.provider}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate">
                                            {model.displayName}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Temperature */}
                        <div className="mb-4">
                            <label className="mb-2 block text-xs font-medium text-foreground/60">
                                Temperature
                            </label>
                            <div className="flex gap-1">
                                <button
                                    onClick={() =>
                                        onChange({ ...overrides, temperature: null })
                                    }
                                    className={cn(
                                        "flex-1 rounded-md px-2 py-1.5 text-xs transition-all",
                                        overrides.temperature === null
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-foreground/5 hover:bg-foreground/10"
                                    )}
                                >
                                    Auto
                                </button>
                                {TEMPERATURE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        onClick={() =>
                                            onChange({
                                                ...overrides,
                                                temperature: preset.value,
                                            })
                                        }
                                        className={cn(
                                            "flex-1 rounded-md px-2 py-1.5 text-xs transition-all",
                                            overrides.temperature === preset.value
                                                ? "bg-primary/10 ring-1 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                        title={preset.description}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reasoning */}
                        <div>
                            <label className="mb-2 block text-xs font-medium text-foreground/60">
                                Reasoning Depth
                            </label>
                            <div className="flex flex-wrap gap-1">
                                {REASONING_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() =>
                                            onChange({
                                                ...overrides,
                                                reasoning:
                                                    preset.id === "auto"
                                                        ? null
                                                        : preset.id,
                                            })
                                        }
                                        className={cn(
                                            "rounded-md px-2 py-1.5 text-xs transition-all",
                                            (preset.id === "auto" &&
                                                overrides.reasoning === null) ||
                                                overrides.reasoning === preset.id
                                                ? "bg-primary/10 ring-1 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                        title={preset.description}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
