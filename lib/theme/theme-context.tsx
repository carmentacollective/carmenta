"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Theme Provider - Wraps next-themes for Carmenta.
 *
 * Uses next-themes for robust theme switching with:
 * - Flash prevention via script injection
 * - System preference detection
 * - localStorage persistence
 * - SSR support
 *
 * Themes are defined in globals.css using CSS custom properties.
 * The "dark" class triggers dark mode styles via Tailwind convention.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </NextThemesProvider>
    );
}

// Re-export useTheme from next-themes for convenience
export { useTheme } from "next-themes";
