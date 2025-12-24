"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

// Theme variant types
export type ThemeVariant =
    | "carmenta"
    | "warm-earth"
    | "arctic-clarity"
    | "forest-wisdom"
    | "monochrome"
    | "christmas";

const STORAGE_KEY = "carmenta-theme-variant";
const DEFAULT_THEME: ThemeVariant = "carmenta";

// Theme variant context
interface ThemeVariantContextValue {
    themeVariant: ThemeVariant;
    setThemeVariant: (variant: ThemeVariant) => void;
}

const ThemeVariantContext = createContext<ThemeVariantContextValue | null>(null);

/**
 * Hook for managing theme variant selection.
 */
export function useThemeVariant() {
    const context = useContext(ThemeVariantContext);
    if (!context) {
        throw new Error("useThemeVariant must be used within ThemeProvider");
    }
    return context;
}

interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Get initial theme from localStorage (client-side only)
 */
function getInitialTheme(): ThemeVariant {
    if (typeof window === "undefined") return DEFAULT_THEME;
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeVariant | null;
    return saved || DEFAULT_THEME;
}

/**
 * Theme Provider - Combines next-themes for light/dark with simple context for theme variants.
 *
 * - next-themes: Manages "class" attribute for Tailwind dark mode
 * - ThemeVariantContext: Manages "data-theme" attribute for color variants
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
    // Use lazy initializer to read from localStorage without triggering effect setState
    const [themeVariant, setThemeVariantState] =
        useState<ThemeVariant>(getInitialTheme);

    const setThemeVariant = useCallback((variant: ThemeVariant) => {
        setThemeVariantState(variant);
        localStorage.setItem(STORAGE_KEY, variant);
        document.documentElement.setAttribute("data-theme", variant);
    }, []);

    // Sync data-theme attribute with state (external system sync)
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", themeVariant);
    }, [themeVariant]);

    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <ThemeVariantContext.Provider value={{ themeVariant, setThemeVariant }}>
                {children}
            </ThemeVariantContext.Provider>
        </NextThemesProvider>
    );
}

// Re-export useTheme from next-themes for light/dark mode
export { useTheme } from "next-themes";
