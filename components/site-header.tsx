"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { PlusIcon } from "@phosphor-icons/react";

import {
    ThemeSwitcher,
    UserAuthButton,
    OracleMenu,
    ChatReturnNav,
} from "@/components/ui";
import { useWindowControlsOverlay } from "@/lib/hooks/use-window-controls-overlay";
import { useLastConnection } from "@/lib/hooks/use-last-connection";

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
 * Left side: Oracle menu (Carmenta - product, help, philosophy)
 * Center: Return-to-chat breadcrumb (when user has an active chat)
 * Right side: User menu (account, integrations, settings)
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
    const { isSignedIn } = useAuth();
    const { shouldShowReturn, isOnConnectionPage } = useLastConnection({});

    // Hide when WCO titlebar is shown to avoid duplicate controls
    if (isWcoActive) {
        return null;
    }

    // Show "New connection" when user is signed in, not on a connection page, and has no active session
    const showNewConnection = isSignedIn && !isOnConnectionPage && !shouldShowReturn;

    return (
        <header className="flex items-center justify-between px-6 py-4">
            {/* Left: Oracle menu with Carmenta label */}
            <OracleMenu showLabel />

            {/* Center: Return to chat OR new connection button */}
            {shouldShowReturn ? (
                <ChatReturnNav />
            ) : showNewConnection ? (
                <Link
                    href="/connection?new"
                    className="bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New connection</span>
                </Link>
            ) : null}

            {/* Right: User controls */}
            <div className="flex items-center gap-4">
                {showThemeSwitcher && <ThemeSwitcher enableViewTransition />}
                <UserAuthButton />
                {rightContent}
            </div>
        </header>
    );
}
