"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Theme Provider - Uses TWO nested next-themes providers for Carmenta.
 *
 * Outer Provider (Light/Dark Mode):
 * - Manages the "class" attribute for Tailwind dark mode
 * - Supports system preference detection
 * - Values: "light" | "dark" | "system"
 *
 * Inner Provider (Theme Variant):
 * - Manages the "data-theme" attribute for color variants
 * - Values: "carmenta" | "warm-earth" | "arctic-clarity" | etc.
 *
 * Both providers handle:
 * - Flash prevention via script injection
 * - localStorage persistence
 * - SSR support with proper hydration
 *
 * This approach uses next-themes for everything instead of custom DOM manipulation,
 * ensuring reliable theme switching with proper hydration.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <NextThemesProvider
                attribute="data-theme"
                defaultTheme="carmenta"
                storageKey="carmenta-theme-variant"
                themes={[
                    "carmenta",
                    "warm-earth",
                    "arctic-clarity",
                    "forest-wisdom",
                    "sunset-coral",
                    "deep-ocean",
                    "monochrome",
                    "rose-garden",
                    "golden-hour",
                ]}
                disableTransitionOnChange
            >
                {children}
            </NextThemesProvider>
        </NextThemesProvider>
    );
}

// Re-export useTheme from next-themes for convenience
export { useTheme } from "next-themes";
