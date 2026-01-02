"use client";

/**
 * Window Controls Overlay Titlebar
 *
 * Native-feeling titlebar for desktop PWA installations.
 * Only renders when WCO mode is active (Chrome/Edge desktop PWA).
 *
 * Features:
 * - App logo and wordmark
 * - Theme toggle
 * - User avatar/settings
 * - Draggable titlebar area for window movement
 *
 * @see https://web.dev/articles/window-controls-overlay
 */

import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { UserAuthButton } from "@/components/ui/user-auth-button";
import { useWindowControlsOverlay } from "@/lib/hooks/use-window-controls-overlay";

interface WcoTitlebarProps {
    className?: string;
}

export function WcoTitlebar({ className }: WcoTitlebarProps) {
    const isWcoActive = useWindowControlsOverlay();

    // Don't render anything if WCO is not active or still loading
    if (!isWcoActive) {
        return null;
    }

    return (
        <header
            className={cn(
                // Fixed to top, spans full width
                "fixed top-0 right-0 left-0",
                // Use titlebar height from CSS env vars with fallback
                "h-[env(titlebar-area-height,40px)]",
                // Background and styling
                "bg-background/80 backdrop-blur-lg",
                "border-foreground/10 border-b",
                // Z-index above content but below modals
                "z-sticky",
                // Layout
                "flex items-center justify-between",
                // Padding to respect window controls area
                // Left padding accounts for macOS traffic lights
                "pr-4 pl-[env(titlebar-area-x,16px)]",
                className
            )}
            style={
                {
                    // Make the entire header draggable for window movement
                    // Interactive elements will override this with no-drag
                    WebkitAppRegion: "drag",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            }
        >
            {/* Left section: Logo and wordmark */}
            <Link
                href="/home"
                className="group flex items-center gap-2"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={24}
                    height={24}
                    className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
                    priority
                />
                <span className="text-foreground/90 text-sm font-semibold tracking-tight">
                    Carmenta
                </span>
            </Link>

            {/* Right section: Theme toggle and user menu */}
            <div
                className="flex items-center gap-2"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
                <ThemeSwitcher />
                <UserAuthButton />
            </div>
        </header>
    );
}
