"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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

interface ThemeVariantContextType {
    themeVariant: ThemeVariant;
    setThemeVariant: (variant: ThemeVariant) => void;
}

const ThemeVariantContext = createContext<ThemeVariantContextType | undefined>(
    undefined
);

export function ThemeVariantProvider({ children }: { children: ReactNode }) {
    const [themeVariant, setThemeVariantState] = useState<ThemeVariant>(() => {
        // Load theme variant from localStorage on initial render
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(
                "carmenta-theme-variant"
            ) as ThemeVariant | null;
            return stored || "carmenta";
        }
        return "carmenta";
    });

    const setThemeVariant = (newVariant: ThemeVariant) => {
        setThemeVariantState(newVariant);
        localStorage.setItem("carmenta-theme-variant", newVariant);

        // Update data-theme attribute on html element
        document.documentElement.setAttribute("data-theme", newVariant);
    };

    useEffect(() => {
        // Set initial theme variant
        document.documentElement.setAttribute("data-theme", themeVariant);
    }, [themeVariant]);

    return (
        <ThemeVariantContext.Provider value={{ themeVariant, setThemeVariant }}>
            {children}
        </ThemeVariantContext.Provider>
    );
}

export function useThemeVariant() {
    const context = useContext(ThemeVariantContext);
    if (context === undefined) {
        throw new Error("useThemeVariant must be used within a ThemeVariantProvider");
    }
    return context;
}
