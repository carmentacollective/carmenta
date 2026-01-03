"use client";

/**
 * Simple composer for wizard-style chat flows.
 *
 * A lighter alternative to the main Composer that doesn't need:
 * - Model selection
 * - File attachments
 * - Voice input
 * - Draft persistence
 * - Pipeline state animations
 *
 * Uses the same styling (btn-cta gradient, CornerDownLeft icon) as the main composer.
 */

import { useRef, useEffect, useCallback } from "react";
import { CornerDownLeft, Square } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SimpleComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    isLoading?: boolean;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    className?: string;
}

export function SimpleComposer({
    value,
    onChange,
    onSubmit,
    isLoading = false,
    placeholder = "Type a message...",
    disabled = false,
    autoFocus = true,
    className,
}: SimpleComposerProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
        }
    }, [autoFocus]);

    // Auto-resize textarea as content grows
    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [value]);

    const handleSubmit = useCallback(() => {
        if (value.trim() && !isLoading && !disabled) {
            onSubmit();
        }
    }, [value, isLoading, disabled, onSubmit]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit]
    );

    const isDisabled = disabled || isLoading;
    const canSubmit = value.trim() && !isDisabled;

    return (
        <div className={cn("flex items-end gap-2", className)}>
            <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isDisabled}
                rows={1}
                className={cn(
                    // Layout
                    "w-full flex-1 resize-none",
                    "max-h-48 min-h-11",
                    // Spacing
                    "px-4 py-2.5",
                    // Typography
                    "text-base leading-5 outline-none",
                    "text-foreground/95 placeholder:text-foreground/40",
                    // Shape + transition (matching main Composer)
                    "rounded-xl transition-all",
                    // Sunken glass effect
                    "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                    // Border
                    "border-foreground/8 focus:border-foreground/35 border",
                    // Disabled state
                    isDisabled && "cursor-not-allowed opacity-50"
                )}
            />
            {/* Send/Stop button - matches main Composer styling */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit && !isLoading}
                className={cn(
                    // Base shape matching main Composer button
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                    // Shadow and ring
                    "shadow-xl ring-1 backdrop-blur-xl transition-all",
                    // Hover/focus states
                    "hover:ring-primary/40 hover:shadow-2xl hover:ring-[3px]",
                    "focus:ring-primary/40 focus:shadow-2xl focus:ring-[3px] focus:outline-none",
                    "active:translate-y-0.5 active:shadow-sm",
                    // Variant styling
                    isLoading
                        ? "bg-muted text-muted-foreground ring-muted/20 hover:bg-muted/90"
                        : "btn-cta ring-transparent",
                    // Disabled
                    !canSubmit && !isLoading && "cursor-not-allowed opacity-50"
                )}
                aria-label={isLoading ? "Stop" : "Send message"}
            >
                {isLoading ? (
                    <Square className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                    <CornerDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
            </button>
        </div>
    );
}
