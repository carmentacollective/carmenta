import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ui";

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
 * Maintains pixel-perfect alignment and spacing.
 */
export function SiteHeader({
    rightContent,
    bordered = false,
    showThemeSwitcher = true,
}: SiteHeaderProps) {
    return (
        <header
            className={cn(
                "flex items-center justify-between px-6 py-4",
                bordered &&
                    "border-b border-foreground/10 bg-white/80 backdrop-blur-sm dark:bg-background/80"
            )}
        >
            <Link
                href="/"
                className="flex items-center gap-3 transition-opacity hover:opacity-80"
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
                {showThemeSwitcher && <ThemeSwitcher />}
                {rightContent}
            </div>
        </header>
    );
}
