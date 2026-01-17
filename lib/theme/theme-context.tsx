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

// Theme variant types - what users select and what gets stored
const VALID_THEMES = [
    "carmenta",
    "warm-earth",
    "arctic-clarity",
    "forest-wisdom",
    "monochrome",
] as const;
export type ThemeVariant = (typeof VALID_THEMES)[number];

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
 * Theme Provider - Combines next-themes for light/dark with simple context for theme variants.
 *
 * - next-themes: Manages "class" attribute for Tailwind dark mode
 * - ThemeVariantContext: Manages "data-theme" attribute for color variants
 *
 * Hydration note: We initialize with DEFAULT_THEME to match SSR, then read
 * from localStorage in useEffect to avoid React hydration mismatch errors.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
    // Initialize with default to match SSR - we'll sync from localStorage in useEffect
    const [themeVariant, setThemeVariantState] = useState<ThemeVariant>(DEFAULT_THEME);

    const setThemeVariant = useCallback((variant: ThemeVariant) => {
        setThemeVariantState(variant);
        localStorage.setItem(STORAGE_KEY, variant);
        document.documentElement.setAttribute("data-theme", variant);
    }, []);

    // Hydrate from localStorage after mount (avoids SSR mismatch)
    // Migrates deprecated themes (christmas, holiday) to carmenta
    // Note: setState in effect is intentional here - we need to sync external
    // storage state after hydration completes to avoid React Error #418
    /* eslint-disable react-hooks/set-state-in-effect -- Hydration sync from external storage */
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            if (isValidTheme(saved)) {
                setThemeVariantState(saved);
            } else {
                // Migrate deprecated or invalid themes to default
                localStorage.setItem(STORAGE_KEY, DEFAULT_THEME);
                setThemeVariantState(DEFAULT_THEME);
            }
        }
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

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

// Type guard for valid themes
function isValidTheme(value: string): value is ThemeVariant {
    return VALID_THEMES.includes(value as ThemeVariant);
}

// Re-export useTheme from next-themes for light/dark mode
export { useTheme } from "next-themes";
