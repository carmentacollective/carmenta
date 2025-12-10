"use client";

import { useTheme } from "next-themes";

export type ThemeVariant =
    | "carmenta"
    | "warm-earth"
    | "arctic-clarity"
    | "forest-wisdom"
    | "sunset-coral"
    | "deep-ocean"
    | "monochrome"
    | "rose-garden"
    | "golden-hour";

/**
 * Hook for managing theme variant selection.
 *
 * Uses next-themes internally to handle the data-theme attribute,
 * localStorage persistence, and SSR hydration automatically.
 *
 * This is used in conjunction with a separate next-themes provider
 * that manages the data-theme attribute (while the main one manages class for light/dark).
 */
export function useThemeVariant() {
    const { theme, setTheme } = useTheme();

    return {
        themeVariant: (theme as ThemeVariant) || "carmenta",
        setThemeVariant: setTheme as (variant: ThemeVariant) => void,
    };
}
