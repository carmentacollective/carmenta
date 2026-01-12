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
 * Uses ChatTextarea for consistent styling with the main composer.
 */

import { useRef, useEffect, useCallback } from "react";
import { ArrowElbowDownLeftIcon, SquareIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ChatTextarea, type ChatTextareaRef } from "./chat-textarea";

export interface SimpleComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    /** Stop the current streaming response */
    onStop?: () => void;
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
    onStop,
    isLoading = false,
    placeholder = "Type a message...",
    disabled = false,
    autoFocus = true,
    className,
}: SimpleComposerProps) {
    const inputRef = useRef<ChatTextareaRef>(null);

    // Auto-focus on mount
    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
        }
    }, [autoFocus]);

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
            <ChatTextarea
                ref={inputRef}
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isDisabled}
            />
            {/* Send/Stop button - matches main Composer styling */}
            <button
                type="button"
                onClick={isLoading && onStop ? onStop : handleSubmit}
                disabled={!canSubmit && !isLoading}
                className={cn(
                    // Base shape matching main Composer button
                    "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full @md:h-12 @md:w-12",
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
                    <SquareIcon className="h-4 w-4 @md:h-5 @md:w-5" />
                ) : (
                    <ArrowElbowDownLeftIcon className="h-5 w-5 @md:h-6 @md:w-6" />
                )}
            </button>
        </div>
    );
}
