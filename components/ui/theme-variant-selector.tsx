"use client";

import { CheckIcon, PaletteIcon } from "@phosphor-icons/react";
import {
    useThemeVariant,
    getCurrentHoliday,
    type ThemeVariant,
} from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";
import * as Popover from "@radix-ui/react-popover";

interface ThemeConfig {
    value: ThemeVariant;
    label: string;
    description: string;
    colors: [string, string, string]; // [primary, secondary, accent]
}

// Static theme configurations
const STATIC_THEMES: ThemeConfig[] = [
    {
        value: "carmenta",
        label: "Carmenta",
        description: "Royal purple elegance",
        colors: ["hsl(270 40% 56%)", "hsl(280 20% 95%)", "hsl(280 30% 88%)"],
    },
    {
        value: "warm-earth",
        label: "Warm Earth",
        description: "Terracotta, sage & gold",
        colors: ["hsl(15 60% 60%)", "hsl(80 30% 85%)", "hsl(40 50% 65%)"],
    },
    {
        value: "arctic-clarity",
        label: "Arctic Clarity",
        description: "Ice blue precision",
        colors: ["hsl(200 70% 55%)", "hsl(200 25% 90%)", "hsl(190 60% 65%)"],
    },
    {
        value: "forest-wisdom",
        label: "Forest Wisdom",
        description: "Natural green & amber",
        colors: ["hsl(140 45% 45%)", "hsl(80 25% 88%)", "hsl(35 60% 60%)"],
    },
    {
        value: "monochrome",
        label: "Monochrome",
        description: "Minimal & precise",
        colors: ["hsl(0 0% 35%)", "hsl(0 0% 88%)", "hsl(190 100% 50%)"],
    },
];

/**
 * Build themes list with dynamic Holiday option based on current date.
 * The Holiday option shows the currently active seasonal theme's info.
 */
function getThemes(): ThemeConfig[] {
    const currentHoliday = getCurrentHoliday();

    const holidayTheme: ThemeConfig = {
        value: "holiday",
        label: `Holiday: ${currentHoliday.label}`,
        description: currentHoliday.description,
        colors: currentHoliday.colors,
    };

    return [...STATIC_THEMES, holidayTheme];
}

export function ThemeVariantSelector() {
    const { themeVariant, setThemeVariant } = useThemeVariant();

    const themes = getThemes();
    const currentTheme = themes.find((t) => t.value === themeVariant);

    return (
        <Popover.Root>
            <Popover.Trigger
                className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-foreground/5 focus:ring-primary/40 focus:ring-2 focus:outline-none"
                )}
            >
                <PaletteIcon className="text-foreground/60 h-4 w-4" />
                <span className="text-foreground/90">{currentTheme?.label}</span>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="glass-container z-modal w-64 rounded-xl p-2 shadow-2xl"
                    sideOffset={8}
                    align="end"
                >
                    <div className="space-y-1">
                        {themes.map((theme) => (
                            <button
                                key={theme.value}
                                onClick={() => setThemeVariant(theme.value)}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                    themeVariant === theme.value
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground/90"
                                )}
                            >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                                    {themeVariant === theme.value && (
                                        <CheckIcon className="h-4 w-4" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    <div className="font-medium">{theme.label}</div>
                                    <div className="text-xs opacity-70">
                                        {theme.description}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-0.5">
                                    {theme.colors.map((color, i) => (
                                        <div
                                            key={i}
                                            className="border-foreground/10 h-4 w-4 rounded-full border"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
