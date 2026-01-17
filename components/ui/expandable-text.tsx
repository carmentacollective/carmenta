"use client";

/**
 * ExpandableText - Standard drawer pattern for long text content
 *
 * Design decisions documented in knowledge/components/text-expansion.md:
 * - Uses blur gradient mask matching chat viewport fade
 * - Separate button avoids text selection conflicts
 * - 300ms height transition with ease-out easing
 * - Threshold: 4 lines (~120px) or semantic paragraph breaks
 */

import { useState, useRef, useLayoutEffect, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Height threshold in pixels (approximately 6 lines at 1.5 line-height with 16px font)
 * Increased to show more content before the blur fade (56px) takes effect.
 * With 240px total and 56px blur, we show ~184px of readable content (~5 lines).
 */
const COLLAPSE_HEIGHT_PX = 240;

/**
 * Large max-height for expanded state.
 * CSS transitions need numeric values on both ends - can't transition to "none".
 * This value accommodates any reasonable content length.
 */
const EXPANDED_MAX_HEIGHT_PX = 10000;

interface ExpandableTextProps {
    /** Content to render - can be text or any ReactNode */
    children: ReactNode;
    /** Optional threshold override in pixels */
    threshold?: number;
    /** Additional class name for the container */
    className?: string;
    /** Whether to show the dashed frame around content */
    showFrame?: boolean;
}

export function ExpandableText({
    children,
    threshold = COLLAPSE_HEIGHT_PX,
    className,
    showFrame = false,
}: ExpandableTextProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsExpansion, setNeedsExpansion] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Measure content height to determine if expansion is needed
    // useLayoutEffect prevents flash of uncollapsed content on initial render
    useLayoutEffect(() => {
        if (!contentRef.current) return;

        const checkHeight = () => {
            const scrollHeight = contentRef.current?.scrollHeight ?? 0;
            setNeedsExpansion(scrollHeight > threshold);
        };

        checkHeight();

        // Re-check on resize (content might reflow)
        const observer = new ResizeObserver(checkHeight);
        observer.observe(contentRef.current);

        return () => observer.disconnect();
    }, [threshold, children, needsExpansion]);

    // If content doesn't need expansion, render without any controls
    if (!needsExpansion) {
        return (
            <div className={cn(showFrame && "expandable-text-frame", className)}>
                <div ref={contentRef}>{children}</div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "relative pb-4",
                showFrame && "expandable-text-frame",
                className
            )}
        >
            {/* Content container with animated height */}
            <div
                ref={contentRef}
                className={cn(
                    "overflow-hidden transition-[max-height] duration-300 ease-out",
                    !isExpanded && "expandable-text-fade"
                )}
                style={{
                    maxHeight: isExpanded
                        ? `${EXPANDED_MAX_HEIGHT_PX}px`
                        : `${threshold}px`,
                }}
            >
                {children}
            </div>

            {/* Expand/collapse button - positioned at bottom edge */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse message" : "Expand message"}
                className={cn(
                    // Positioning - centered at bottom edge, overlapping content
                    "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
                    // Base sizing
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    // Theme-aware background with glass effect
                    "bg-primary/85 backdrop-blur-sm",
                    // Shadow - subtle depth with theme-tinted glow
                    "shadow-primary/25 shadow-lg",
                    // Ring for definition
                    "ring-1 ring-white/30 dark:ring-white/20",
                    // Transitions
                    "transition-all duration-200",
                    // Hover state - brighter and lifted
                    "hover:bg-primary/95 hover:shadow-primary/30 hover:scale-110 hover:shadow-xl",
                    // Active state - pressed feel
                    "active:shadow-primary/20 active:translate-y-1/2 active:scale-95 active:shadow-md",
                    // Focus state - prominent ring for keyboard nav
                    "focus-visible:ring-primary-foreground/60 focus-visible:ring-2 focus-visible:outline-none"
                )}
            >
                <CaretDownIcon
                    className={cn(
                        "text-primary-foreground h-4 w-4 transition-transform duration-300",
                        isExpanded && "rotate-180"
                    )}
                />
            </button>
        </div>
    );
}
