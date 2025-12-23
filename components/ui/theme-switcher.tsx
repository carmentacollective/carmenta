"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "./button";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Theme Switcher - Simple toggle between light and dark mode.
 *
 * Uses next-themes for robust theme switching.
 * Light mode: soft pastel holographic
 * Dark mode: warm deeper holographic
 */
export function ThemeSwitcher() {
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { resolvedTheme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    // Show placeholder during SSR to avoid hydration mismatch
    if (!isClient) {
        return (
            <Button
                variant="ghost"
                size="icon-sm"
                className="relative"
                aria-label="Toggle theme"
            >
                <Sun className="size-4 text-foreground/70" />
            </Button>
        );
    }

    const isDark = resolvedTheme === "dark";
    const Icon = isDark ? Moon : Sun;

    return (
        <Button
            variant="ghost"
            size="icon-sm"
            className="vt-theme-switcher relative"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
        >
            <Icon className="size-4 text-foreground/70" />
        </Button>
    );
}
