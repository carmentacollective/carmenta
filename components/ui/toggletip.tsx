"use client";

/**
 * Toggletip - Click-to-reveal contextual help
 *
 * Unlike tooltips (hover, brief labels), toggletips are for genuine explanations
 * that users might want to read. Click to open, click to close.
 *
 * Uses a subtle help icon (?) that becomes more visible on hover.
 * Designed to be present but not prominent - for users who need help,
 * invisible to those who don't.
 *
 * @example
 * ```tsx
 * <Toggletip>
 *   Creativity controls how adventurous we get with responses.
 *   Higher values mean more unexpected ideas.
 * </Toggletip>
 * ```
 */

import * as React from "react";
import { Question } from "@phosphor-icons/react";

import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { cn } from "@/lib/utils";

interface ToggletipProps {
    /** Help content to display - can be string or JSX */
    children: React.ReactNode;
    /** Additional classes for the trigger button */
    className?: string;
    /** Side to display popover (default: top) */
    side?: "top" | "right" | "bottom" | "left";
    /** Alignment of popover (default: center) */
    align?: "start" | "center" | "end";
    /** Icon size in pixels (default: 14) */
    iconSize?: number;
    /** Whether to show the icon at full opacity always */
    alwaysVisible?: boolean;
}

/**
 * Toggletip component for contextual help
 *
 * Click the (?) icon to reveal helpful information.
 * Designed for explaining complex concepts that need more than a brief tooltip.
 */
export function Toggletip({
    children,
    className,
    side = "top",
    align = "center",
    iconSize = 14,
    alwaysVisible = false,
}: ToggletipProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center justify-center rounded-full",
                        "text-foreground/40 hover:text-foreground/80",
                        "transition-all duration-200",
                        "hover:scale-110",
                        "focus-visible:ring-accent/50 focus:outline-none focus-visible:ring-2",
                        // Touch target minimum 44px, but visually smaller
                        "-m-[15px] min-h-[44px] min-w-[44px]",
                        // Override opacity if always visible
                        alwaysVisible && "text-foreground/60",
                        className
                    )}
                    aria-label="More information"
                >
                    <Question size={iconSize} weight="bold" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={side}
                align={align}
                sideOffset={8}
                className={cn(
                    "max-w-[280px] p-3",
                    "text-sm leading-relaxed",
                    "bg-background/95 dark:bg-background/90",
                    "border-foreground/10",
                    "shadow-lg"
                )}
            >
                {children}
            </PopoverContent>
        </Popover>
    );
}

/**
 * Inline toggletip for use within text or labels
 *
 * Smaller, designed to sit next to form labels or inline text.
 * When nested in interactive elements, use asChild to render as span.
 */
export function InlineToggletip({
    children,
    className,
    side = "top",
    align = "center",
    asChild = false,
}: Omit<ToggletipProps, "iconSize" | "alwaysVisible"> & {
    /** Render trigger as a span instead of button (for nesting in interactive elements) */
    asChild?: boolean;
}) {
    const Trigger = asChild ? "span" : "button";
    const triggerProps = asChild
        ? { role: "button", tabIndex: 0 }
        : { type: "button" as const };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Trigger
                    {...triggerProps}
                    className={cn(
                        "inline-flex items-center justify-center",
                        "text-foreground/30 hover:text-foreground/70",
                        "transition-all duration-200",
                        "hover:scale-110",
                        "focus-visible:ring-accent/50 focus:outline-none focus-visible:rounded-full focus-visible:ring-1",
                        "-mr-0.5 ml-1",
                        asChild && "cursor-pointer",
                        className
                    )}
                    aria-label="More information"
                >
                    <Question size={12} weight="bold" />
                </Trigger>
            </PopoverTrigger>
            <PopoverContent
                side={side}
                align={align}
                sideOffset={6}
                className={cn(
                    "max-w-[260px] p-2.5",
                    "text-xs leading-relaxed",
                    "bg-background/95 dark:bg-background/90",
                    "border-foreground/10",
                    "shadow-lg"
                )}
            >
                {children}
            </PopoverContent>
        </Popover>
    );
}
