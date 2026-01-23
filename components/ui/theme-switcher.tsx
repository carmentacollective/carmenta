"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { useIsClient } from "@/lib/hooks/use-is-client";

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
    const isClient = useIsClient();
    const { resolvedTheme, setTheme } = useTheme();
    const { trigger: triggerHaptic } = useHapticFeedback();

    const toggleTheme = () => {
        triggerHaptic();
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
                <SunIcon className="text-foreground/70 size-4" />
            </Button>
        );
    }

    const isDark = resolvedTheme === "dark";
    const Icon = isDark ? MoonIcon : SunIcon;

    return (
        <Button
            variant="ghost"
            size="icon-sm"
            className={cn("relative", enableViewTransition && "vt-theme-switcher")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
        >
            <Icon className="text-foreground/70 size-4" />
        </Button>
    );
}
