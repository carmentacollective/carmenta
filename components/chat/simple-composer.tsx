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
 * Uses ChatTextarea and ComposerButton for consistent styling with the main composer.
 */

import { useRef, useEffect, useCallback } from "react";
import { ArrowElbowDownLeftIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { ChatTextarea, type ChatTextareaRef } from "./chat-textarea";
import { ComposerButton } from "./composer-button";

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
    const isMobile = useIsMobile();

    // Auto-focus on mount (skip on mobile to avoid keyboard popup)
    useEffect(() => {
        if (autoFocus && isMobile === false) {
            inputRef.current?.focus();
        }
    }, [autoFocus, isMobile]);

    const handleSubmit = useCallback(() => {
        if (value.trim() && !isLoading && !disabled) {
            onSubmit();
        }
    }, [value, isLoading, disabled, onSubmit]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // On mobile, Enter should insert newline (native behavior), not submit
            if (isMobile === true) return;

            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit, isMobile]
    );

    const isDisabled = disabled || isLoading;
    const canSubmit = value.trim() && !isDisabled;

    return (
        <div className={cn("@container flex items-center gap-2", className)}>
            <ChatTextarea
                ref={inputRef}
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isDisabled}
            />
            {isLoading && onStop ? (
                <ComposerButton
                    type="button"
                    variant="stop"
                    onClick={onStop}
                    aria-label="Stop"
                />
            ) : (
                <ComposerButton
                    type="button"
                    variant="send"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    aria-label="Send message"
                >
                    <ArrowElbowDownLeftIcon className="h-5 w-5 @md:h-6 @md:w-6" />
                </ComposerButton>
            )}
        </div>
    );
}
