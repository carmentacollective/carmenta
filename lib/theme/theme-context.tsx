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
export type ThemeVariant =
    | "carmenta"
    | "warm-earth"
    | "arctic-clarity"
    | "forest-wisdom"
    | "monochrome"
    | "holiday"; // Meta-theme that resolves to seasonal themes

// CSS theme variants - what actually gets applied to data-theme attribute
type CssThemeVariant =
    | "carmenta"
    | "warm-earth"
    | "arctic-clarity"
    | "forest-wisdom"
    | "monochrome"
    | "christmas";

// Holiday configuration for seasonal themes
export interface HolidayConfig {
    cssTheme: CssThemeVariant;
    label: string;
    description: string;
    colors: [string, string, string]; // [primary, secondary, accent]
    startMonth: number; // 1-12
    startDay: number;
    endMonth: number; // 1-12
    endDay: number;
}

// Seasonal holiday themes with their active date ranges
export const HOLIDAYS: HolidayConfig[] = [
    {
        cssTheme: "christmas",
        label: "Christmas",
        description: "Festive warmth",
        colors: ["hsl(350 65% 45%)", "hsl(140 40% 88%)", "hsl(42 85% 55%)"],
        startMonth: 12,
        startDay: 1,
        endMonth: 1,
        endDay: 6, // Through Epiphany
    },
    // Future holidays: Valentine's, Halloween, etc.
];

// Default holiday config when no seasonal holiday is active
const DEFAULT_HOLIDAY: HolidayConfig = {
    cssTheme: "carmenta",
    label: "Seasonal",
    description: "Current season's theme",
    colors: ["hsl(270 40% 56%)", "hsl(280 20% 95%)", "hsl(280 30% 88%)"],
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
};

/**
 * Check if a date falls within a holiday's date range.
 * Handles year-spanning ranges (e.g., Dec 1 - Jan 6).
 */
function isDateInHolidayRange(
    month: number,
    day: number,
    holiday: HolidayConfig
): boolean {
    const { startMonth, startDay, endMonth, endDay } = holiday;

    // Year-spanning range (e.g., Dec 1 - Jan 6)
    if (startMonth > endMonth) {
        return (
            month > startMonth ||
            (month === startMonth && day >= startDay) ||
            month < endMonth ||
            (month === endMonth && day <= endDay)
        );
    }

    // Same-year range
    if (month < startMonth || month > endMonth) return false;
    if (month === startMonth && day < startDay) return false;
    if (month === endMonth && day > endDay) return false;
    return true;
}

/**
 * Get the currently active holiday based on today's date.
 */
export function getCurrentHoliday(): HolidayConfig {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();

    for (const holiday of HOLIDAYS) {
        if (isDateInHolidayRange(month, day, holiday)) {
            return holiday;
        }
    }

    return DEFAULT_HOLIDAY;
}

/**
 * Resolve a theme variant to the CSS theme that should be applied.
 * "holiday" resolves to the current seasonal theme.
 */
export function resolveToCssTheme(variant: ThemeVariant): CssThemeVariant {
    if (variant === "holiday") {
        return getCurrentHoliday().cssTheme;
    }
    return variant;
}

// Re-export CssThemeVariant for components that need palette lookup
export type { CssThemeVariant };

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
        // Apply the resolved CSS theme (holiday → christmas, etc.)
        document.documentElement.setAttribute("data-theme", resolveToCssTheme(variant));
    }, []);

    // Sync data-theme attribute with state (external system sync)
    // Resolves "holiday" to the appropriate seasonal theme
    useEffect(() => {
        document.documentElement.setAttribute(
            "data-theme",
            resolveToCssTheme(themeVariant)
        );
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
