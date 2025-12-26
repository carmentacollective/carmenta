import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { HolographicBackground } from "@/components/ui/holographic-background";
import { cn } from "@/lib/utils";

interface StandardPageLayoutProps {
    children: React.ReactNode;
    /**
     * Maximum content width constraint
     * - 'narrow': 56rem (896px) — for text-heavy pages (terms, privacy)
     * - 'standard': 64rem (1024px) — for standard pages (security, knowledge-base)
     * - 'wide': 80rem (1280px) — for feature-rich pages (integrations)
     */
    maxWidth?: "narrow" | "standard" | "wide";
    /**
     * Vertical padding for the content area
     * - 'compact': py-8 sm:py-12 lg:py-16
     * - 'normal': py-12 sm:py-16 lg:py-20
     * - 'generous': py-16 sm:py-20 lg:py-24
     * - undefined: no padding (for pages with multiple sections managing their own spacing)
     */
    verticalPadding?: "compact" | "normal" | "generous";
    /**
     * Show footer at the bottom. Defaults to true.
     */
    showFooter?: boolean;
    /**
     * Show theme switcher in header. Defaults to false.
     */
    showThemeSwitcher?: boolean;
    /**
     * Additional classes for the content wrapper
     */
    contentClassName?: string;
}

const maxWidthClasses = {
    narrow: "max-w-4xl", // 56rem / 896px
    standard: "max-w-5xl", // 64rem / 1024px
    wide: "max-w-6xl", // 80rem / 1280px
};

const verticalPaddingClasses = {
    compact: "py-8 sm:py-12 lg:py-16",
    normal: "py-12 sm:py-16 lg:py-20",
    generous: "py-16 sm:py-20 lg:py-24",
};

/**
 * Standard page layout for content pages (security, terms, privacy, knowledge-base, etc.)
 *
 * Handles:
 * - Holographic background
 * - Site header with safe-area padding for iPhone PWA
 * - Content wrapper with responsive max-width and padding
 * - Footer
 *
 * Pages that should NOT use this:
 * - Homepage (custom hero layout with scroll-reveal header)
 * - Connection/Chat pages (custom full-screen layout)
 * - Auth pages (different visual treatment)
 */
export function StandardPageLayout({
    children,
    maxWidth = "narrow",
    verticalPadding,
    showFooter = true,
    showThemeSwitcher = false,
    contentClassName,
}: StandardPageLayoutProps) {
    return (
        <div className="relative min-h-screen bg-background">
            <HolographicBackground />
            <div className="relative z-content">
                {/* Header with safe-area padding for iPhone PWA */}
                <div className="pt-safe-top">
                    <SiteHeader bordered showThemeSwitcher={showThemeSwitcher} />
                </div>

                {/* Content area */}
                <main
                    className={cn(
                        "mx-auto w-full px-6 sm:px-8 lg:px-10",
                        maxWidthClasses[maxWidth],
                        verticalPadding && verticalPaddingClasses[verticalPadding],
                        contentClassName
                    )}
                >
                    {children}
                </main>

                {/* Footer with safe-area padding for iPhone PWA */}
                {showFooter && (
                    <div className="pb-safe-bottom">
                        <Footer />
                    </div>
                )}
            </div>
        </div>
    );
}
