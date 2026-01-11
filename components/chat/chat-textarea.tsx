"use client";

/**
 * ChatTextarea - Shared textarea component for all chat inputs.
 *
 * Provides consistent styling, auto-resize, and focus state handling.
 * Used by SimpleComposer, ComposerUI, and informs SyntaxHighlightInput styling.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  VERTICAL ALIGNMENT: This component centers placeholder text.   │
 * │                                                                 │
 * │  If you modify height/padding values, verify in Playwright:     │
 * │  1. Desktop (1280px viewport)                                   │
 * │  2. Mobile (390px viewport)                                     │
 * │  3. CarmentaSheet (400px container in wide viewport)            │
 * │                                                                 │
 * │  MUST use container queries (@md:) for padding/layout so this   │
 * │  works correctly in narrow containers on wide viewports.        │
 * └─────────────────────────────────────────────────────────────────┘
 */

import {
    forwardRef,
    useRef,
    useEffect,
    useImperativeHandle,
    useState,
    type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Shared textarea styles as a constant for cases where ChatTextarea
 * can't be used directly (e.g., RichTextarea in SyntaxHighlightInput).
 *
 * Import this and spread/merge with any component-specific overrides.
 */
export const CHAT_TEXTAREA_BASE_STYLES = {
    // Layout - container query responsive
    layout: "w-full flex-none resize-none @md:flex-1",
    // ┌─────────────────────────────────────────────────────────────────┐
    // │  HEIGHT: Must EXACTLY match padding + line-height for centering │
    // │                                                                 │
    // │  Mobile:  py-3 (12+12=24) + leading-5 (20) = 44px = min-h-11   │
    // │  Desktop: py-4 (16+16=32) + leading-5 (20) = 52px              │
    // │                                                                 │
    // │  MUST use @md: (container query) NOT md: (media query)         │
    // │  so CarmentaSheet (400px in wide viewport) gets mobile styles  │
    // └─────────────────────────────────────────────────────────────────┘
    height: "max-h-48 min-h-11 @md:max-h-60 @md:min-h-[52px]",
    // Padding - symmetric with container queries for CarmentaSheet compatibility
    padding: "px-4 py-3 @md:px-6 @md:py-4",
    // Typography
    typography: "text-base leading-5 outline-none",
    colors: "text-foreground/95 placeholder:text-foreground/40",
    // Shape
    shape: "rounded-2xl transition-all",
    // Sunken glass effect
    glass: "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
    // Border (focus state handled separately)
    border: "border",
} as const;

/** Combined base styles as a single string */
export const CHAT_TEXTAREA_CLASSES = Object.values(CHAT_TEXTAREA_BASE_STYLES).join(" ");

export interface ChatTextareaProps extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "onChange"
> {
    /** Controlled value */
    value: string;
    /** Change handler - receives string directly, not event */
    onChange: (value: string) => void;
    /** Additional className to merge */
    className?: string;
    /** Whether the textarea is disabled */
    disabled?: boolean;
    /** Callback when focus state changes */
    onFocusChange?: (focused: boolean) => void;
}

export interface ChatTextareaRef {
    focus: () => void;
    blur: () => void;
    element: HTMLTextAreaElement | null;
}

/**
 * Shared chat textarea with consistent styling and behavior.
 */
export const ChatTextarea = forwardRef<ChatTextareaRef, ChatTextareaProps>(
    function ChatTextarea(
        {
            value,
            onChange,
            className,
            disabled,
            onFocusChange,
            onFocus,
            onBlur,
            ...props
        },
        ref
    ) {
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [isFocused, setIsFocused] = useState(false);

        // Expose ref methods
        useImperativeHandle(ref, () => ({
            focus: () => textareaRef.current?.focus(),
            blur: () => textareaRef.current?.blur(),
            element: textareaRef.current,
        }));

        // Auto-resize ONLY for multi-line content
        // Single-line: let CSS min-height control size for proper vertical centering
        useEffect(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            // Only auto-resize if content has newlines (multi-line)
            if (value.includes("\n")) {
                textarea.style.height = "auto";
                textarea.style.height = `${textarea.scrollHeight}px`;
            } else {
                // Single-line: remove explicit height, let CSS handle it
                textarea.style.height = "";
            }
        }, [value]);

        const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
            setIsFocused(true);
            onFocusChange?.(true);
            onFocus?.(e);
        };

        const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
            setIsFocused(false);
            onFocusChange?.(false);
            onBlur?.(e);
        };

        return (
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                rows={1}
                className={cn(
                    CHAT_TEXTAREA_CLASSES,
                    // Focus-dependent border color
                    isFocused ? "border-foreground/35" : "border-foreground/8",
                    // Multi-line gets slightly darker bg
                    /\n/.test(value) && "bg-background/30",
                    // Disabled state
                    disabled && "cursor-not-allowed opacity-50",
                    className
                )}
                {...props}
            />
        );
    }
);
