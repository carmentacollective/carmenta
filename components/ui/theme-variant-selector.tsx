"use client";

import { Check, Palette } from "lucide-react";
import { useThemeVariant, type ThemeVariant } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";
import * as Popover from "@radix-ui/react-popover";

const THEMES: Array<{ value: ThemeVariant; label: string; description: string }> = [
    { value: "carmenta", label: "Carmenta", description: "Royal purple elegance" },
    {
        value: "warm-earth",
        label: "Warm Earth",
        description: "Terracotta, sage & gold",
    },
    {
        value: "arctic-clarity",
        label: "Arctic Clarity",
        description: "Ice blue precision",
    },
    {
        value: "forest-wisdom",
        label: "Forest Wisdom",
        description: "Natural green & amber",
    },
    {
        value: "sunset-coral",
        label: "Sunset Coral",
        description: "Warm, inviting, energetic",
    },
    {
        value: "deep-ocean",
        label: "Deep Ocean",
        description: "Sophisticated, deep, calm",
    },
    {
        value: "monochrome",
        label: "Monochrome",
        description: "Minimal, precise, professional",
    },
    {
        value: "rose-garden",
        label: "Rose Garden",
        description: "Elegant, soft, refined",
    },
    {
        value: "golden-hour",
        label: "Golden Hour",
        description: "Luxurious, warm, radiant",
    },
];

export function ThemeVariantSelector() {
    const { themeVariant, setThemeVariant } = useThemeVariant();

    const currentTheme = THEMES.find((t) => t.value === themeVariant);

    return (
        <Popover.Root>
            <Popover.Trigger
                className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                )}
            >
                <Palette className="h-4 w-4 text-foreground/60" />
                <span className="text-foreground/90">{currentTheme?.label}</span>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="glass-container z-50 w-64 rounded-xl p-2 shadow-2xl"
                    sideOffset={8}
                    align="end"
                >
                    <div className="space-y-1">
                        {THEMES.map((theme) => (
                            <button
                                key={theme.value}
                                onClick={() => setThemeVariant(theme.value)}
                                className={cn(
                                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                    themeVariant === theme.value
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground/90"
                                )}
                            >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                                    {themeVariant === theme.value && (
                                        <Check className="h-4 w-4" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    <div className="font-medium">{theme.label}</div>
                                    <div className="text-xs opacity-70">
                                        {theme.description}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
