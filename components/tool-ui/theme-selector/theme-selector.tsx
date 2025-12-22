"use client";

/**
 * Theme Selector - Inline chat component for choosing visual theme
 *
 * Used during onboarding to let users pick their preferred visual theme.
 * Shows all available themes as cards with live preview on hover.
 * Follows the tool-ui patterns for consistent styling.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Palette } from "lucide-react";

import { cn } from "@/lib/utils";
import { useThemeVariant, type ThemeVariant } from "@/lib/theme/theme-context";
import type { ThemeSelectorProps, ThemeOption } from "./schema";
import { Button } from "@/components/ui/button";

/**
 * Theme definitions with labels and descriptions
 */
const THEMES: ThemeOption[] = [
    {
        value: "carmenta",
        label: "Carmenta",
        description: "Royal purple elegance",
    },
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
        value: "monochrome",
        label: "Monochrome",
        description: "Minimal, precise, professional",
    },
];

/**
 * Theme card with color preview
 */
function ThemeCard({
    theme,
    isSelected,
    onSelect,
    onHover,
}: {
    theme: ThemeOption;
    isSelected: boolean;
    onSelect: () => void;
    onHover: (theme: ThemeVariant | null) => void;
}) {
    return (
        <motion.button
            onClick={onSelect}
            onMouseEnter={() => onHover(theme.value)}
            onMouseLeave={() => onHover(null)}
            className={cn(
                "group relative flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-all",
                "border-2 bg-card/60 backdrop-blur-sm",
                isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/50 hover:border-foreground/20 hover:bg-foreground/5"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {/* Selection indicator */}
            <div
                className={cn(
                    "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full transition-all",
                    isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border-2 border-muted-foreground/30"
                )}
            >
                {isSelected && <Check className="h-3 w-3" />}
            </div>

            {/* Theme color preview dots */}
            <div className="flex gap-1.5">
                <ThemeColorDot theme={theme.value} variant="primary" />
                <ThemeColorDot theme={theme.value} variant="secondary" />
                <ThemeColorDot theme={theme.value} variant="accent" />
            </div>

            {/* Theme info */}
            <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{theme.label}</span>
                <span className="text-sm text-muted-foreground">
                    {theme.description}
                </span>
            </div>
        </motion.button>
    );
}

/**
 * Color dot preview for a theme
 */
function ThemeColorDot({
    theme,
    variant,
}: {
    theme: ThemeVariant;
    variant: "primary" | "secondary" | "accent";
}) {
    // Map theme + variant to actual colors
    // These match the CSS variables from globals.css
    const colorMap: Record<ThemeVariant, Record<string, string>> = {
        carmenta: {
            primary: "bg-purple-500",
            secondary: "bg-violet-400",
            accent: "bg-fuchsia-400",
        },
        "warm-earth": {
            primary: "bg-orange-600",
            secondary: "bg-amber-500",
            accent: "bg-emerald-600",
        },
        "arctic-clarity": {
            primary: "bg-cyan-500",
            secondary: "bg-blue-400",
            accent: "bg-slate-400",
        },
        "forest-wisdom": {
            primary: "bg-green-600",
            secondary: "bg-emerald-500",
            accent: "bg-amber-500",
        },
        monochrome: {
            primary: "bg-neutral-700",
            secondary: "bg-neutral-500",
            accent: "bg-neutral-400",
        },
    };

    return (
        <div
            className={cn(
                "h-4 w-4 rounded-full shadow-sm",
                colorMap[theme]?.[variant] ?? "bg-muted"
            )}
        />
    );
}

/**
 * Confirmed state - shows the selected theme as a receipt
 */
function ThemeSelectorConfirmation({
    id,
    theme,
    className,
}: {
    id: string;
    theme: ThemeVariant;
    className?: string;
}) {
    const selectedTheme = THEMES.find((t) => t.value === theme);

    return (
        <div
            className={cn("flex w-full max-w-md flex-col text-foreground", className)}
            data-slot="theme-selector"
            data-tool-ui-id={id}
            data-receipt="true"
        >
            <div className="flex items-center gap-3 rounded-2xl border bg-card/60 px-5 py-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Palette className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                    <span className="font-medium">{selectedTheme?.label ?? theme}</span>
                    <span className="text-sm text-muted-foreground">
                        Your workspace, ready
                    </span>
                </div>
                <Check className="ml-auto h-5 w-5 text-primary" />
            </div>
        </div>
    );
}

/**
 * Main theme selector component
 */
export function ThemeSelector({
    id,
    value,
    defaultValue = "carmenta",
    confirmed,
    onChange,
    onConfirm,
    className,
}: ThemeSelectorProps) {
    const { themeVariant, setThemeVariant } = useThemeVariant();
    // Initialize to user's current theme, not defaultValue, to avoid overriding on mount
    const [selected, setSelected] = useState<ThemeVariant>(value ?? themeVariant);
    const [hoveredTheme, setHoveredTheme] = useState<ThemeVariant | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    // Track original theme for preview restoration
    const [originalTheme] = useState<ThemeVariant>(themeVariant);

    // Track confirmed state in a ref to avoid stale closure in cleanup
    const confirmedRef = useRef(confirmed);
    useEffect(() => {
        confirmedRef.current = confirmed;
    }, [confirmed]);

    // Sync with controlled value
    useEffect(() => {
        if (value !== undefined) {
            setSelected(value);
        }
    }, [value]);

    // Live preview on hover
    useEffect(() => {
        if (hoveredTheme) {
            setThemeVariant(hoveredTheme);
        } else {
            // Restore to selected (or original if nothing selected yet)
            setThemeVariant(selected);
        }
    }, [hoveredTheme, selected, setThemeVariant]);

    // Cleanup: restore original theme if component unmounts without confirming
    useEffect(() => {
        return () => {
            // Only restore if not confirmed (use ref to get current value)
            if (confirmedRef.current === undefined || confirmedRef.current === null) {
                setThemeVariant(originalTheme);
            }
        };
    }, [originalTheme, setThemeVariant]);

    const handleSelect = useCallback(
        (theme: ThemeVariant) => {
            setSelected(theme);
            setThemeVariant(theme);
            onChange?.(theme);
        },
        [onChange, setThemeVariant]
    );

    const handleConfirm = useCallback(async () => {
        if (isConfirming) return;
        setIsConfirming(true);

        try {
            // Apply the theme permanently
            setThemeVariant(selected);
            await onConfirm?.(selected);
        } finally {
            setIsConfirming(false);
        }
    }, [isConfirming, onConfirm, selected, setThemeVariant]);

    // Show confirmation receipt if confirmed
    if (confirmed !== undefined && confirmed !== null) {
        return (
            <ThemeSelectorConfirmation
                id={id}
                theme={confirmed}
                className={className}
            />
        );
    }

    return (
        <div
            className={cn(
                "flex w-full max-w-2xl flex-col gap-4 text-foreground",
                className
            )}
            data-slot="theme-selector"
            data-tool-ui-id={id}
        >
            {/* Theme grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((theme) => (
                    <ThemeCard
                        key={theme.value}
                        theme={theme}
                        isSelected={selected === theme.value}
                        onSelect={() => handleSelect(theme.value)}
                        onHover={setHoveredTheme}
                    />
                ))}
            </div>

            {/* Confirm button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="min-w-[120px]"
                >
                    {isConfirming ? "Setting up..." : "This feels right"}
                </Button>
            </div>
        </div>
    );
}
