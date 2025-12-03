"use client";

/**
 * Variant 5: Command Palette Style
 *
 * A keyboard-friendly command palette triggered by clicking a subtle
 * indicator or pressing a keyboard shortcut. Very geeky.
 */

import { useState, useEffect, useCallback } from "react";
import { Command, Sparkles, Thermometer, Brain, Check, Search } from "lucide-react";

import { MODELS, TEMPERATURE_PRESETS, REASONING_PRESETS } from "@/lib/models";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { cn } from "@/lib/utils";

import type { ModelSelectorProps, ReasoningOverride } from "./types";

type Section = "all" | "model" | "temp" | "reasoning";

export function ModelSelectorCommand({
    overrides,
    onChange,
    disabled,
    className,
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [section, setSection] = useState<Section>("all");

    const hasOverrides =
        overrides.modelId !== null ||
        overrides.temperature !== null ||
        overrides.reasoning !== null;

    // Keyboard shortcut to open
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k" && !disabled) {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [disabled]);

    const handleSelect = useCallback(
        (type: "model" | "temp" | "reasoning", value: unknown) => {
            if (type === "model") {
                onChange({ ...overrides, modelId: value as string | null });
            } else if (type === "temp") {
                onChange({ ...overrides, temperature: value as number | null });
            } else if (type === "reasoning") {
                onChange({
                    ...overrides,
                    reasoning: value as ReasoningOverride | null,
                });
            }
            setIsOpen(false);
            setSearch("");
            setSection("all");
        },
        [overrides, onChange]
    );

    // Filter items based on search
    const filterMatch = (text: string) =>
        text.toLowerCase().includes(search.toLowerCase());

    const showModels =
        (section === "all" || section === "model") &&
        (search === "" ||
            filterMatch("model") ||
            MODELS.some((m) => filterMatch(m.displayName)));

    const showTemp =
        (section === "all" || section === "temp") &&
        (search === "" ||
            filterMatch("temperature") ||
            TEMPERATURE_PRESETS.some((p) => filterMatch(p.label)));

    const showReasoning =
        (section === "all" || section === "reasoning") &&
        (search === "" ||
            filterMatch("reasoning") ||
            filterMatch("thinking") ||
            REASONING_PRESETS.some((p) => filterMatch(p.label)));

    return (
        <>
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all",
                    "bg-white/40 backdrop-blur-sm",
                    "hover:bg-white/60",
                    hasOverrides && "ring-1 ring-primary/30",
                    disabled && "cursor-not-allowed opacity-50",
                    className
                )}
            >
                <Command className="h-3.5 w-3.5 text-foreground/50" />
                <span className="text-foreground/60">
                    {hasOverrides ? "Custom" : "Model Settings"}
                </span>
                <kbd className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/40">
                    K
                </kbd>
            </button>

            {/* Command Palette Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={() => {
                            setIsOpen(false);
                            setSearch("");
                            setSection("all");
                        }}
                    />

                    {/* Palette */}
                    <div
                        className={cn(
                            "relative w-full max-w-lg",
                            "rounded-2xl bg-white/95 backdrop-blur-xl",
                            "shadow-2xl ring-1 ring-black/10",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
                        )}
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
                            <Search className="h-5 w-5 text-foreground/40" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search settings..."
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/40"
                                autoFocus
                            />
                            {hasOverrides && (
                                <button
                                    onClick={() => {
                                        onChange({
                                            modelId: null,
                                            temperature: null,
                                            reasoning: null,
                                        });
                                        setIsOpen(false);
                                    }}
                                    className="text-xs text-foreground/50 hover:text-foreground/70"
                                >
                                    Reset
                                </button>
                            )}
                        </div>

                        {/* Section Tabs */}
                        <div className="flex gap-1 border-b border-foreground/10 px-4 py-2">
                            {(
                                [
                                    { id: "all", label: "All" },
                                    { id: "model", label: "Model" },
                                    { id: "temp", label: "Temperature" },
                                    { id: "reasoning", label: "Reasoning" },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSection(tab.id)}
                                    className={cn(
                                        "rounded-md px-2.5 py-1 text-xs transition-all",
                                        section === tab.id
                                            ? "bg-foreground/10 font-medium"
                                            : "text-foreground/50 hover:text-foreground/70"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Results */}
                        <div className="max-h-[40vh] overflow-y-auto p-2">
                            {/* Models Section */}
                            {showModels && (
                                <div className="mb-2">
                                    <div className="px-2 py-1 text-xs font-medium text-foreground/40">
                                        Model
                                    </div>
                                    <button
                                        onClick={() => handleSelect("model", null)}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all",
                                            overrides.modelId === null
                                                ? "bg-primary/10"
                                                : "hover:bg-foreground/5"
                                        )}
                                    >
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">
                                                Auto
                                            </div>
                                            <div className="text-xs text-foreground/50">
                                                Let Carmenta choose the best model
                                            </div>
                                        </div>
                                        {overrides.modelId === null && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </button>
                                    {MODELS.filter(
                                        (m) =>
                                            search === "" || filterMatch(m.displayName)
                                    ).map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() =>
                                                handleSelect("model", model.id)
                                            }
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all",
                                                overrides.modelId === model.id
                                                    ? "bg-primary/10"
                                                    : "hover:bg-foreground/5"
                                            )}
                                        >
                                            <ProviderIcon
                                                provider={model.provider}
                                                className="h-4 w-4"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">
                                                    {model.displayName}
                                                </div>
                                                <div className="text-xs text-foreground/50">
                                                    {model.description}
                                                </div>
                                            </div>
                                            {overrides.modelId === model.id && (
                                                <Check className="h-4 w-4 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Temperature Section */}
                            {showTemp && (
                                <div className="mb-2">
                                    <div className="px-2 py-1 text-xs font-medium text-foreground/40">
                                        Temperature
                                    </div>
                                    <button
                                        onClick={() => handleSelect("temp", null)}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all",
                                            overrides.temperature === null
                                                ? "bg-primary/10"
                                                : "hover:bg-foreground/5"
                                        )}
                                    >
                                        <Thermometer className="h-4 w-4 text-primary" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">
                                                Auto
                                            </div>
                                            <div className="text-xs text-foreground/50">
                                                Carmenta picks based on task
                                            </div>
                                        </div>
                                        {overrides.temperature === null && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </button>
                                    {TEMPERATURE_PRESETS.filter(
                                        (p) => search === "" || filterMatch(p.label)
                                    ).map((preset) => (
                                        <button
                                            key={preset.value}
                                            onClick={() =>
                                                handleSelect("temp", preset.value)
                                            }
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all",
                                                overrides.temperature === preset.value
                                                    ? "bg-primary/10"
                                                    : "hover:bg-foreground/5"
                                            )}
                                        >
                                            <Thermometer className="h-4 w-4 text-foreground/50" />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">
                                                    {preset.label}{" "}
                                                    <span className="text-foreground/40">
                                                        ({preset.value})
                                                    </span>
                                                </div>
                                                <div className="text-xs text-foreground/50">
                                                    {preset.description}
                                                </div>
                                            </div>
                                            {overrides.temperature === preset.value && (
                                                <Check className="h-4 w-4 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Reasoning Section */}
                            {showReasoning && (
                                <div>
                                    <div className="px-2 py-1 text-xs font-medium text-foreground/40">
                                        Reasoning Depth
                                    </div>
                                    {REASONING_PRESETS.filter(
                                        (p) => search === "" || filterMatch(p.label)
                                    ).map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() =>
                                                handleSelect(
                                                    "reasoning",
                                                    preset.id === "auto"
                                                        ? null
                                                        : preset.id
                                                )
                                            }
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all",
                                                (preset.id === "auto" &&
                                                    overrides.reasoning === null) ||
                                                    overrides.reasoning === preset.id
                                                    ? "bg-primary/10"
                                                    : "hover:bg-foreground/5"
                                            )}
                                        >
                                            <Brain
                                                className={cn(
                                                    "h-4 w-4",
                                                    preset.id === "auto"
                                                        ? "text-primary"
                                                        : "text-foreground/50"
                                                )}
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">
                                                    {preset.label}
                                                </div>
                                                <div className="text-xs text-foreground/50">
                                                    {preset.description}
                                                </div>
                                            </div>
                                            {((preset.id === "auto" &&
                                                overrides.reasoning === null) ||
                                                overrides.reasoning === preset.id) && (
                                                <Check className="h-4 w-4 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* No results */}
                            {!showModels && !showTemp && !showReasoning && (
                                <div className="py-8 text-center text-sm text-foreground/50">
                                    No matching settings found
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-foreground/10 px-4 py-2 text-xs text-foreground/40">
                            <div className="flex gap-2">
                                <kbd className="rounded bg-foreground/10 px-1.5 py-0.5">
                                    Esc
                                </kbd>
                                <span>to close</span>
                            </div>
                            <div className="flex gap-2">
                                <kbd className="rounded bg-foreground/10 px-1.5 py-0.5">
                                    Enter
                                </kbd>
                                <span>to select</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
