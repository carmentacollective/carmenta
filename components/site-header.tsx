import Link from "next/link";

import { ThemeSwitcher, UserAuthButton } from "@/components/ui";
import { InteractiveLogo } from "@/components/delight/interactive-logo";

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
 */
export function SiteHeader({
    rightContent,
    bordered: _bordered = false,
    showThemeSwitcher = false,
}: SiteHeaderProps) {
    return (
        <header className="flex items-center justify-between px-6 py-4">
            <Link
                href="/"
                className="vt-app-logo group flex items-center gap-3 transition-all duration-300"
            >
                <InteractiveLogo />
                <span className="text-xl font-semibold tracking-tight text-foreground/90">
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
