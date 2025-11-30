import Image from "next/image";
import Link from "next/link";

interface SiteHeaderProps {
    /**
     * Right-side content (e.g., Connect button, User button, version badge)
     */
    rightContent?: React.ReactNode;
    /**
     * Apply border and background for content pages (vs. landing page)
     */
    bordered?: boolean;
}

/**
 * Consistent site header across all pages.
 * Maintains pixel-perfect alignment and spacing.
 */
export function SiteHeader({ rightContent, bordered = false }: SiteHeaderProps) {
    const headerClasses = bordered
        ? "border-b border-foreground/10 bg-white/80 backdrop-blur-sm"
        : "";

    return (
        <header
            className={`flex items-center justify-between px-6 py-4 ${headerClasses}`}
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
            {rightContent && (
                <div className="flex items-center gap-4">{rightContent}</div>
            )}
        </header>
    );
}
