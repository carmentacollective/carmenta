"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import {
    User,
    LogOut,
    Moon,
    Sun,
    UserCircle2,
    Monitor,
    Plug,
    Sparkles,
    BookOpen,
    Heart,
    Compass,
    Code2,
} from "lucide-react";

import { useMarker } from "@/components/feedback/marker-provider";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
    useThemeVariant,
    getCurrentHoliday,
    type ThemeVariant,
} from "@/lib/theme/theme-context";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface UserAuthButtonProps {
    /** Additional classes for the container */
    className?: string;
}

/**
 * Unified user authentication button used across all pages.
 *
 * When signed in: Shows user icon with dropdown (account, integrations, theme, sign out)
 * When signed out: Shows "Sign In" button linking to /sign-in
 *
 * Glass morphism design matching the holographic theme.
 */
export function UserAuthButton({ className }: UserAuthButtonProps) {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const { openUserProfile } = useClerk();
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredTheme, setHoveredTheme] = useState<ThemeVariant | null>(null);
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { theme, setTheme } = useTheme();
    const { themeVariant, setThemeVariant } = useThemeVariant();
    const { capture: captureMarker, isReady: isMarkerReady } = useMarker();
    // Track the "committed" theme (what user has actually selected, not just hovering)
    const [committedTheme, setCommittedTheme] = useState<ThemeVariant>(themeVariant);

    // Close menu on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    // Show nothing while loading to prevent flash
    if (!isLoaded) {
        return <div className={cn("h-10 w-10", className)} aria-hidden="true" />;
    }

    // Not signed in - show Enter button
    if (!isSignedIn || !user) {
        return (
            <Link
                href="/enter"
                className={cn("btn-cta rounded-full px-4 py-2 text-sm", className)}
            >
                Enter
            </Link>
        );
    }

    // Signed in - show user dropdown
    const profileImageUrl = user.imageUrl;
    const displayName = user.fullName || user.firstName || "User";
    const email = user.primaryEmailAddress?.emailAddress;

    const themeOptions = [
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "System", icon: Monitor },
    ] as const;

    // Theme variants with primary color for swatch preview
    // Colors derived from --primary HSL values in globals.css (light mode)
    const currentHoliday = getCurrentHoliday();
    const themeVariants: Array<{
        value: ThemeVariant;
        label: string;
        description: string;
        color: string; // Primary color for the swatch
    }> = [
        {
            value: "carmenta",
            label: "Carmenta",
            description: "Royal purple elegance",
            color: "hsl(270 40% 56%)",
        },
        {
            value: "warm-earth",
            label: "Warm Earth",
            description: "Grounded, organic",
            color: "hsl(15 60% 60%)",
        },
        {
            value: "arctic-clarity",
            label: "Arctic Clarity",
            description: "Crystalline precision",
            color: "hsl(200 70% 55%)",
        },
        {
            value: "forest-wisdom",
            label: "Forest Wisdom",
            description: "Natural intelligence",
            color: "hsl(140 45% 45%)",
        },
        {
            value: "monochrome",
            label: "Monochrome",
            description: "Minimal, precise",
            color: "hsl(0 0% 35%)",
        },
        {
            value: "holiday",
            label: currentHoliday.label,
            description: currentHoliday.description,
            color: currentHoliday.colors[0], // Primary color from current holiday
        },
    ];

    // Show hovered theme info when hovering, otherwise selected theme
    const displayTheme = themeVariants.find(
        (v) => v.value === (hoveredTheme ?? themeVariant)
    );

    return (
        <div className={cn("vt-user-auth relative", className)}>
            {/* Trigger button - UserCircle icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-icon-glass group relative"
                aria-label="User menu"
                data-tooltip-id="tip"
                data-tooltip-content="Settings & integrations"
            >
                <UserCircle2 className="h-6 w-6 text-foreground/50 transition-colors group-hover:text-foreground/80 sm:h-7 sm:w-7 md:h-8 md:w-8" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-backdrop"
                            onClick={() => setIsOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        />

                        {/* Dropdown menu */}
                        <motion.div
                            className="fixed right-6 top-16 z-modal"
                            initial={{ opacity: 0, y: -12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{
                                duration: 0.2,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            <div className="glass-container w-64 overflow-hidden rounded-2xl shadow-2xl">
                                {/* User info header */}
                                <div className="border-b border-foreground/10 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {profileImageUrl ? (
                                            <img
                                                src={profileImageUrl}
                                                alt={displayName}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                {displayName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate text-sm font-medium text-foreground">
                                                {displayName}
                                            </div>
                                            <div className="truncate text-xs text-foreground/60">
                                                {email}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div className="py-1">
                                    {/* Settings & Core Features */}
                                    <button
                                        onClick={() => {
                                            openUserProfile();
                                            setIsOpen(false);
                                        }}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <User className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Account</span>
                                    </button>

                                    <Link
                                        href="/integrations"
                                        onClick={() => setIsOpen(false)}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <Plug className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Integrations</span>
                                    </Link>

                                    {/* Learning & Content */}
                                    <div className="my-1 border-t border-foreground/10" />

                                    <Link
                                        href="/knowledge-base"
                                        onClick={() => setIsOpen(false)}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <BookOpen className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Knowledge Base</span>
                                    </Link>

                                    <Link
                                        href="/guide"
                                        onClick={() => setIsOpen(false)}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <Compass className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Guide</span>
                                    </Link>

                                    <Link
                                        href="/heart-centered-ai"
                                        onClick={() => setIsOpen(false)}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <Heart className="relative h-4 w-4 fill-primary text-primary" />
                                        <span className="relative">
                                            Heart-Centered AI
                                        </span>
                                    </Link>

                                    <Link
                                        href="/ai-first-development"
                                        onClick={() => setIsOpen(false)}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <Code2 className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">How We Build</span>
                                    </Link>

                                    {/* Appearance section - compact redesign */}
                                    {isClient && (
                                        <div className="border-t border-foreground/10 px-4 py-3">
                                            {/* Header row: "Theme" label + Light/Dark/System segmented control */}
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="text-xs font-medium text-foreground/50">
                                                    Theme
                                                </span>

                                                {/* Segmented control for light/dark/system */}
                                                <div className="flex rounded-lg bg-foreground/5 p-0.5">
                                                    {themeOptions.map((option) => {
                                                        const isSelected =
                                                            theme === option.value;
                                                        const Icon = option.icon;
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                onClick={() =>
                                                                    setTheme(
                                                                        option.value
                                                                    )
                                                                }
                                                                className={cn(
                                                                    "flex items-center justify-center rounded-md px-2 py-1 transition-all",
                                                                    isSelected
                                                                        ? "bg-background text-foreground shadow-sm"
                                                                        : "text-foreground/40 hover:text-foreground/70"
                                                                )}
                                                                data-tooltip-id="tip"
                                                                data-tooltip-content={
                                                                    option.label
                                                                }
                                                            >
                                                                <Icon className="h-3.5 w-3.5" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Theme swatches row */}
                                            <div
                                                className="flex items-center gap-2"
                                                onMouseLeave={() => {
                                                    // Restore to committed theme when leaving swatch area
                                                    setHoveredTheme(null);
                                                    setThemeVariant(committedTheme);
                                                }}
                                            >
                                                {themeVariants.map((variant) => {
                                                    const isCommitted =
                                                        committedTheme ===
                                                        variant.value;
                                                    return (
                                                        <button
                                                            key={variant.value}
                                                            onClick={() => {
                                                                setCommittedTheme(
                                                                    variant.value
                                                                );
                                                                setThemeVariant(
                                                                    variant.value
                                                                );
                                                            }}
                                                            onMouseEnter={() => {
                                                                setHoveredTheme(
                                                                    variant.value
                                                                );
                                                                setThemeVariant(
                                                                    variant.value
                                                                );
                                                            }}
                                                            className={cn(
                                                                "h-10 w-10 rounded-full transition-all",
                                                                isCommitted
                                                                    ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background"
                                                                    : "opacity-60 hover:scale-110 hover:opacity-100"
                                                            )}
                                                            style={{
                                                                backgroundColor:
                                                                    variant.color,
                                                            }}
                                                            data-tooltip-id="tip"
                                                            data-tooltip-content={
                                                                variant.label
                                                            }
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {/* Theme label + description (updates on hover) */}
                                            <div className="mt-3">
                                                <div className="text-sm font-medium text-foreground/80">
                                                    {displayTheme?.label}
                                                </div>
                                                <div className="text-xs text-foreground/50">
                                                    {displayTheme?.description}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Meta actions */}
                                    <div className="border-t border-foreground/10">
                                        <button
                                            onClick={() => {
                                                captureMarker();
                                                setIsOpen(false);
                                            }}
                                            disabled={!isMarkerReady}
                                            className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground disabled:opacity-50"
                                        >
                                            <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                            <Sparkles className="relative h-4 w-4 text-foreground/60" />
                                            <span className="relative">
                                                Improve Carmenta
                                            </span>
                                        </button>
                                    </div>

                                    <Link
                                        href="/exit"
                                        onClick={() => setIsOpen(false)}
                                        className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 transition-all hover:text-foreground"
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                        <LogOut className="relative h-4 w-4 text-foreground/60" />
                                        <span className="relative">Exit</span>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
