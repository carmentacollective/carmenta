"use client";

/**
 * Variant 3: Bottom Drawer (Mobile-First)
 *
 * A bottom sheet drawer that slides up with a drag handle.
 * Great for mobile and touch interactions.
 */

import { useState } from "react";
import { Settings2, Sparkles, X, Check, Zap, Clock, DollarSign } from "lucide-react";

import { MODELS, TEMPERATURE_PRESETS, REASONING_PRESETS } from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";

import type { ModelSelectorProps } from "./types";

export function ModelSelectorDrawer({
    overrides,
    onChange,
    disabled,
    className,
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"model" | "temp" | "reasoning">("model");

    const hasOverrides =
        overrides.modelId !== null ||
        overrides.temperature !== null ||
        overrides.reasoning !== null;

    const selectedModel = overrides.modelId
        ? MODELS.find((m) => m.id === overrides.modelId)
        : null;

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-all",
                    "bg-white/50 backdrop-blur-sm",
                    hasOverrides ? "ring-1 ring-primary/30" : "ring-1 ring-white/40",
                    "hover:bg-white/70",
                    disabled && "cursor-not-allowed opacity-50",
                    className
                )}
            >
                {selectedModel ? (
                    <ProviderIcon
                        provider={selectedModel.provider}
                        className="h-3.5 w-3.5"
                    />
                ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                )}
                <span className="text-foreground/70">
                    {hasOverrides ? "Custom" : "Auto"}
                </span>
                <Settings2 className="h-3 w-3 text-foreground/40" />
            </button>

            {/* Drawer Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Drawer */}
                    <div
                        className={cn(
                            "absolute inset-x-0 bottom-0",
                            "rounded-t-3xl bg-white/95 backdrop-blur-xl",
                            "shadow-2xl",
                            "duration-300 animate-in slide-in-from-bottom"
                        )}
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center py-3">
                            <div className="h-1 w-12 rounded-full bg-foreground/20" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pb-4">
                            <h2 className="text-lg font-semibold text-foreground/90">
                                Model Settings
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-2 hover:bg-foreground/5"
                            >
                                <X className="h-5 w-5 text-foreground/50" />
                            </button>
                        </div>

                        {/* Tab Bar */}
                        <div className="flex gap-1 px-6 pb-4">
                            {(
                                [
                                    { id: "model", label: "Model" },
                                    { id: "temp", label: "Temperature" },
                                    { id: "reasoning", label: "Reasoning" },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex-1 rounded-lg py-2.5 text-sm font-medium transition-all",
                                        activeTab === tab.id
                                            ? "bg-primary text-white"
                                            : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="max-h-[50vh] overflow-y-auto px-6 pb-8">
                            {activeTab === "model" && (
                                <div className="space-y-3">
                                    {/* Auto Option */}
                                    <button
                                        onClick={() =>
                                            onChange({
                                                ...overrides,
                                                modelId: null,
                                            })
                                        }
                                        className={cn(
                                            "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all",
                                            overrides.modelId === null
                                                ? "bg-primary/10 ring-2 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/10">
                                            <Sparkles className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-foreground/90">
                                                Let Carmenta Choose
                                            </div>
                                            <div className="text-sm text-foreground/50">
                                                Automatic model selection based on your
                                                query
                                            </div>
                                        </div>
                                        {overrides.modelId === null && (
                                            <Check className="h-5 w-5 text-primary" />
                                        )}
                                    </button>

                                    {/* Model Options */}
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
                                                "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all",
                                                overrides.modelId === model.id
                                                    ? "bg-primary/10 ring-2 ring-primary/30"
                                                    : "bg-foreground/5 hover:bg-foreground/10"
                                            )}
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/10">
                                                <ProviderIcon
                                                    provider={model.provider}
                                                    className="h-6 w-6"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-foreground/90">
                                                    {model.displayName}
                                                </div>
                                                <div className="text-sm text-foreground/50">
                                                    {model.description}
                                                </div>
                                                <div className="mt-1 flex items-center gap-3 text-xs text-foreground/40">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {(
                                                            model.contextWindow / 1000
                                                        ).toFixed(0)}
                                                        K ctx
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="h-3 w-3" />
                                                        ${model.inputCostPerMillion}
                                                        /M in
                                                    </span>
                                                </div>
                                            </div>
                                            {overrides.modelId === model.id && (
                                                <Check className="h-5 w-5 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeTab === "temp" && (
                                <div className="space-y-3">
                                    <button
                                        onClick={() =>
                                            onChange({
                                                ...overrides,
                                                temperature: null,
                                            })
                                        }
                                        className={cn(
                                            "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all",
                                            overrides.temperature === null
                                                ? "bg-primary/10 ring-2 ring-primary/30"
                                                : "bg-foreground/5 hover:bg-foreground/10"
                                        )}
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/10">
                                            <Sparkles className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium">Auto</div>
                                            <div className="text-sm text-foreground/50">
                                                Carmenta picks based on task type
                                            </div>
                                        </div>
                                        {overrides.temperature === null && (
                                            <Check className="h-5 w-5 text-primary" />
                                        )}
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
                                                "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all",
                                                overrides.temperature === preset.value
                                                    ? "bg-primary/10 ring-2 ring-primary/30"
                                                    : "bg-foreground/5 hover:bg-foreground/10"
                                            )}
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/10">
                                                <Zap className="h-6 w-6 text-foreground/60" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium">
                                                    {preset.label}{" "}
                                                    <span className="text-foreground/40">
                                                        ({preset.value})
                                                    </span>
                                                </div>
                                                <div className="text-sm text-foreground/50">
                                                    {preset.description}
                                                </div>
                                            </div>
                                            {overrides.temperature === preset.value && (
                                                <Check className="h-5 w-5 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeTab === "reasoning" && (
                                <div className="space-y-3">
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
                                                "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all",
                                                (preset.id === "auto" &&
                                                    overrides.reasoning === null) ||
                                                    overrides.reasoning === preset.id
                                                    ? "bg-primary/10 ring-2 ring-primary/30"
                                                    : "bg-foreground/5 hover:bg-foreground/10"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "flex h-12 w-12 items-center justify-center rounded-xl",
                                                    preset.id === "auto"
                                                        ? "bg-gradient-to-br from-primary/30 to-primary/10"
                                                        : "bg-foreground/10"
                                                )}
                                            >
                                                {preset.id === "auto" ? (
                                                    <Sparkles className="h-6 w-6 text-primary" />
                                                ) : (
                                                    <span className="text-lg">
                                                        {preset.id === "none"
                                                            ? "⚡"
                                                            : preset.id === "quick"
                                                              ? "1"
                                                              : preset.id === "balanced"
                                                                ? "2"
                                                                : preset.id ===
                                                                    "thorough"
                                                                  ? "3"
                                                                  : "4"}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium">
                                                    {preset.label}
                                                </div>
                                                <div className="text-sm text-foreground/50">
                                                    {preset.description}
                                                </div>
                                            </div>
                                            {((preset.id === "auto" &&
                                                overrides.reasoning === null) ||
                                                overrides.reasoning === preset.id) && (
                                                <Check className="h-5 w-5 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
