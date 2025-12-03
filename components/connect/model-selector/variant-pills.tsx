"use client";

/**
 * Variant 4: Compact Pills/Chips
 *
 * Three horizontal pill-shaped buttons that expand into dropdowns.
 * Compact, always visible, quick to interact with.
 */

import { useState, useRef, useEffect } from "react";
import { Sparkles, ChevronDown, Check } from "lucide-react";

import { MODELS, TEMPERATURE_PRESETS, REASONING_PRESETS } from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";

import type { ModelSelectorProps } from "./types";

type DropdownType = "model" | "temp" | "reasoning" | null;

export function ModelSelectorPills({
    overrides,
    onChange,
    disabled,
    className,
}: ModelSelectorProps) {
    const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex items-center gap-2",
                disabled && "pointer-events-none opacity-50",
                className
            )}
        >
            {/* Model Pill */}
            <div className="relative">
                <button
                    onClick={() =>
                        setOpenDropdown(openDropdown === "model" ? null : "model")
                    }
                    className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
                        "bg-white/60 backdrop-blur-sm",
                        "hover:bg-white/80",
                        openDropdown === "model" && "ring-2 ring-primary/30",
                        selectedModel && "ring-1 ring-primary/20"
                    )}
                >
                    {selectedModel ? (
                        <>
                            <ProviderIcon
                                provider={selectedModel.provider}
                                className="h-3.5 w-3.5"
                            />
                            <span className="font-medium">
                                {selectedModel.displayName.split(" ").pop()}
                            </span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                            <span className="text-foreground/60">Model</span>
                        </>
                    )}
                    <ChevronDown
                        className={cn(
                            "h-3 w-3 text-foreground/40 transition-transform",
                            openDropdown === "model" && "rotate-180"
                        )}
                    />
                </button>

                {openDropdown === "model" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl bg-white/95 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur-xl">
                        <button
                            onClick={() => {
                                onChange({ ...overrides, modelId: null });
                                setOpenDropdown(null);
                            }}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                overrides.modelId === null
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-foreground/5"
                            )}
                        >
                            <Sparkles className="h-4 w-4" />
                            <span className="flex-1">Auto</span>
                            {overrides.modelId === null && (
                                <Check className="h-4 w-4" />
                            )}
                        </button>
                        <div className="my-1 h-px bg-foreground/10" />
                        {MODELS.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => {
                                    onChange({
                                        ...overrides,
                                        modelId: model.id,
                                    });
                                    setOpenDropdown(null);
                                }}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                    overrides.modelId === model.id
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-foreground/5"
                                )}
                            >
                                <ProviderIcon
                                    provider={model.provider}
                                    className="h-4 w-4"
                                />
                                <span className="flex-1">{model.displayName}</span>
                                {overrides.modelId === model.id && (
                                    <Check className="h-4 w-4" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Temperature Pill */}
            <div className="relative">
                <button
                    onClick={() =>
                        setOpenDropdown(openDropdown === "temp" ? null : "temp")
                    }
                    className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
                        "bg-white/60 backdrop-blur-sm",
                        "hover:bg-white/80",
                        openDropdown === "temp" && "ring-2 ring-primary/30",
                        selectedTemp && "ring-1 ring-primary/20"
                    )}
                >
                    <span
                        className={cn(
                            "font-medium",
                            selectedTemp ? "text-foreground/80" : "text-foreground/60"
                        )}
                    >
                        {selectedTemp?.label ?? "Temp"}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-3 w-3 text-foreground/40 transition-transform",
                            openDropdown === "temp" && "rotate-180"
                        )}
                    />
                </button>

                {openDropdown === "temp" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl bg-white/95 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur-xl">
                        <button
                            onClick={() => {
                                onChange({ ...overrides, temperature: null });
                                setOpenDropdown(null);
                            }}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                overrides.temperature === null
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-foreground/5"
                            )}
                        >
                            <span className="flex-1">Auto</span>
                            {overrides.temperature === null && (
                                <Check className="h-4 w-4" />
                            )}
                        </button>
                        <div className="my-1 h-px bg-foreground/10" />
                        {TEMPERATURE_PRESETS.map((preset) => (
                            <button
                                key={preset.value}
                                onClick={() => {
                                    onChange({
                                        ...overrides,
                                        temperature: preset.value,
                                    });
                                    setOpenDropdown(null);
                                }}
                                className={cn(
                                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all",
                                    overrides.temperature === preset.value
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-foreground/5"
                                )}
                            >
                                <span>{preset.label}</span>
                                <span className="text-foreground/40">
                                    {preset.value}
                                </span>
                                {overrides.temperature === preset.value && (
                                    <Check className="h-4 w-4" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Reasoning Pill */}
            <div className="relative">
                <button
                    onClick={() =>
                        setOpenDropdown(
                            openDropdown === "reasoning" ? null : "reasoning"
                        )
                    }
                    className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
                        "bg-white/60 backdrop-blur-sm",
                        "hover:bg-white/80",
                        openDropdown === "reasoning" && "ring-2 ring-primary/30",
                        selectedReasoning && "ring-1 ring-primary/20"
                    )}
                >
                    <span
                        className={cn(
                            "font-medium",
                            selectedReasoning
                                ? "text-foreground/80"
                                : "text-foreground/60"
                        )}
                    >
                        {selectedReasoning?.label ?? "Thinking"}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-3 w-3 text-foreground/40 transition-transform",
                            openDropdown === "reasoning" && "rotate-180"
                        )}
                    />
                </button>

                {openDropdown === "reasoning" && (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl bg-white/95 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur-xl">
                        {REASONING_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    onChange({
                                        ...overrides,
                                        reasoning:
                                            preset.id === "auto" ? null : preset.id,
                                    });
                                    setOpenDropdown(null);
                                }}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                    (preset.id === "auto" &&
                                        overrides.reasoning === null) ||
                                        overrides.reasoning === preset.id
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-foreground/5"
                                )}
                            >
                                <span className="flex-1">{preset.label}</span>
                                {((preset.id === "auto" &&
                                    overrides.reasoning === null) ||
                                    overrides.reasoning === preset.id) && (
                                    <Check className="h-4 w-4" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
