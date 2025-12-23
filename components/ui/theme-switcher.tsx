"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "./button";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface ThemeSwitcherProps {
    /**
     * Apply view transition name for persistent animation across pages.
     * Only use this for the primary theme switcher (e.g., in header).
     * Don't use for secondary instances (e.g., footer) to avoid duplicate view-transition-name values.
     */
    enableViewTransition?: boolean;
}

/**
 * Theme Switcher - Simple toggle between light and dark mode.
 *
 * Uses next-themes for robust theme switching.
 * Light mode: soft pastel holographic
 * Dark mode: warm deeper holographic
 */
export function ThemeSwitcher({
    enableViewTransition = false,
}: ThemeSwitcherProps = {}) {
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
            className={cn("relative", enableViewTransition && "vt-theme-switcher")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
        >
            <Icon className="size-4 text-foreground/70" />
        </Button>
    );
}
