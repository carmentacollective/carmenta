import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ThemeSwitcher, UserAuthButton } from "@/components/ui";

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
    bordered = false,
    showThemeSwitcher = false,
}: SiteHeaderProps) {
    return (
        <header className="flex items-center justify-between px-6 py-4">
            <Link
                href="/"
                className="vt-app-logo flex items-center gap-3 transition-opacity hover:opacity-80"
            >
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                    priority
                />
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
