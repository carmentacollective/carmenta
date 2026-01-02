"use client";

import Link from "next/link";

import { ThemeSwitcher, UserAuthButton } from "@/components/ui";
import { InteractiveLogo } from "@/components/delight/interactive-logo";
import { useWindowControlsOverlay } from "@/lib/hooks/use-window-controls-overlay";

interface SiteHeaderProps {
    /**
     * Right-side content (e.g., Connect button, User button, version badge)
     */
    rightContent?: React.ReactNode;
    /**
     * Apply border and background for content pages (vs. landing page)
     */
    bordered?: boolean;
    /**
     * Show theme switcher. Defaults to true.
     */
    showThemeSwitcher?: boolean;
}

/**
 * Consistent site header across all pages.
 * Transparent header with glassmorphism effect.
 * Maintains pixel-perfect alignment and spacing.
 *
 * When WCO (Window Controls Overlay) is active, this header is hidden
 * to avoid duplication with the WcoTitlebar component.
 */
export function SiteHeader({
    rightContent,
    bordered: _bordered = false,
    showThemeSwitcher = false,
}: SiteHeaderProps) {
    const isWcoActive = useWindowControlsOverlay();

    // Hide when WCO titlebar is shown to avoid duplicate controls
    if (isWcoActive) {
        return null;
    }

    return (
        <header className="flex items-center justify-between px-6 py-4">
            <Link
                href="/home"
                className="vt-app-logo interactive-focus group flex items-center gap-3 rounded-lg transition-all duration-300"
            >
                <InteractiveLogo />
                <span className="text-foreground/90 text-xl font-semibold tracking-tight">
                    Carmenta
                </span>
            </Link>
            <div className="flex items-center gap-4">
                {showThemeSwitcher && <ThemeSwitcher enableViewTransition />}
                <UserAuthButton />
                {rightContent}
            </div>
        </header>
    );
}
