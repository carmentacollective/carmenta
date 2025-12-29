"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Code2, Github, Heart, Moon, Monitor, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
    getCurrentHoliday,
    useThemeVariant,
    type ThemeVariant,
} from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

// Theme variants with primary color for swatch preview
const THEME_SWATCHES: Array<{
    value: ThemeVariant;
    label: string;
    color: string;
}> = [
    { value: "carmenta", label: "Carmenta", color: "hsl(270 40% 56%)" },
    { value: "warm-earth", label: "Warm Earth", color: "hsl(15 60% 60%)" },
    { value: "arctic-clarity", label: "Arctic Clarity", color: "hsl(200 70% 55%)" },
    { value: "forest-wisdom", label: "Forest Wisdom", color: "hsl(140 45% 45%)" },
    { value: "monochrome", label: "Monochrome", color: "hsl(0 0% 35%)" },
];

const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const;

function ThemePopover() {
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { theme, setTheme } = useTheme();
    const { themeVariant, setThemeVariant } = useThemeVariant();
    const [isOpen, setIsOpen] = useState(false);
    const [committedTheme, setCommittedTheme] = useState(themeVariant);

    // Get current holiday for the holiday swatch
    const currentHoliday = getCurrentHoliday();
    const holidaySwatch = {
        value: "holiday" as ThemeVariant,
        label: currentHoliday.label,
        color: currentHoliday.colors[0],
    };
    const allSwatches = [...THEME_SWATCHES, holidaySwatch];

    // Close on Escape key
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

    // Get current theme color for the trigger button
    const currentColor =
        allSwatches.find((s) => s.value === themeVariant)?.color ??
        allSwatches[0].color;

    // Show placeholder during SSR
    if (!isClient) {
        return (
            <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60"
                aria-label="Theme settings"
            >
                <Palette className="h-4 w-4" />
            </button>
        );
    }

    return (
        <div className="relative">
            {/* Trigger: Palette icon with current theme color indicator */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="group flex h-11 w-11 items-center justify-center rounded-full transition-all hover:scale-110"
                aria-label="Theme settings"
                data-tooltip-id="tip"
                data-tooltip-content="Appearance"
            >
                <div className="relative">
                    <Palette className="h-5 w-5 text-foreground/60 transition-colors group-hover:text-foreground/90" />
                    {/* Small color indicator dot */}
                    <div
                        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-background"
                        style={{ backgroundColor: currentColor }}
                    />
                </div>
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

                        {/* Popover - positioned above the trigger */}
                        <motion.div
                            className="absolute bottom-full right-0 z-modal mb-2"
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            transition={{
                                duration: 0.2,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            <div className="glass-container w-56 overflow-hidden rounded-xl p-3 shadow-xl">
                                {/* Light/Dark/System toggle */}
                                <div className="mb-3">
                                    <div className="mb-2 text-xs font-medium text-foreground/50">
                                        Mode
                                    </div>
                                    <div className="flex rounded-lg bg-foreground/5 p-0.5">
                                        {THEME_OPTIONS.map((option) => {
                                            const isSelected = theme === option.value;
                                            const Icon = option.icon;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() =>
                                                        setTheme(option.value)
                                                    }
                                                    className={cn(
                                                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-all",
                                                        isSelected
                                                            ? "bg-background text-foreground shadow-sm"
                                                            : "text-foreground/50 hover:text-foreground/70"
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    <span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Color swatches */}
                                <div>
                                    <div className="mb-2 text-xs font-medium text-foreground/50">
                                        Palette
                                    </div>
                                    <div
                                        className="flex flex-wrap gap-2"
                                        onMouseLeave={() => {
                                            setThemeVariant(committedTheme);
                                        }}
                                    >
                                        {allSwatches.map((swatch) => {
                                            const isCommitted =
                                                committedTheme === swatch.value;
                                            return (
                                                <button
                                                    key={swatch.value}
                                                    onClick={() => {
                                                        setCommittedTheme(swatch.value);
                                                        setThemeVariant(swatch.value);
                                                    }}
                                                    onMouseEnter={() => {
                                                        setThemeVariant(swatch.value);
                                                    }}
                                                    className={cn(
                                                        "h-7 w-7 rounded-full transition-all",
                                                        isCommitted
                                                            ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background"
                                                            : "opacity-70 hover:scale-110 hover:opacity-100"
                                                    )}
                                                    style={{
                                                        backgroundColor: swatch.color,
                                                    }}
                                                    aria-label={swatch.label}
                                                    data-tooltip-id="tip"
                                                    data-tooltip-content={swatch.label}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export function Footer() {
    return (
        <footer className="px-6 py-8 sm:py-10">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                {/* Links - grouped for visual hierarchy */}
                <nav className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-foreground/60">
                    {/* Primary links with icons */}
                    <Link
                        href="/heart-centered-ai"
                        className="flex items-center gap-2 transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        <Heart className="h-4 w-4 fill-primary text-primary" />
                        <span>Heart-Centered AI</span>
                    </Link>
                    <Link
                        href="/ai-first-development"
                        className="flex items-center gap-2 transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        <Code2 className="h-4 w-4" />
                        <span>How We Build</span>
                    </Link>
                    <Link
                        href="https://github.com/carmentacollective/carmenta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        <Github className="h-4 w-4" />
                        <span>Source</span>
                    </Link>

                    {/* Secondary links - legal */}
                    <Link
                        href="/privacy"
                        className="transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        Privacy
                    </Link>
                    <Link
                        href="/terms"
                        className="transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        Terms
                    </Link>
                    <Link
                        href="/security"
                        className="transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        Security
                    </Link>

                    {/* Theme controls */}
                    <ThemePopover />
                </nav>

                {/* Credits */}
                <div className="text-sm text-foreground/60">
                    <span>Built with </span>
                    <Heart className="inline h-3.5 w-3.5 fill-primary text-primary" />
                    <span> by </span>
                    <Link
                        href="https://technick.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        technick.ai
                    </Link>
                </div>
            </div>
        </footer>
    );
}
