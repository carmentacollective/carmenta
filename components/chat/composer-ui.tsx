"use client";

/**
 * ComposerUI - Reusable chat input component with consistent styling.
 *
 * A props-driven composer that can be used across different chat interfaces:
 * - Main chat (/connection) - with model selector, file attachments, voice
 * - Hire page (/ai-team/hire) - with file attachments, voice
 * - Carmenta panel - lightweight usage
 *
 * All features are optional and controlled via props. The component handles:
 * - Auto-resizing textarea with consistent styling
 * - Responsive layout (stacked mobile, inline desktop)
 * - IME composition handling
 * - Keyboard shortcuts (Enter to send, Escape to stop)
 */

import {
    useRef,
    useEffect,
    useCallback,
    useState,
    type ReactNode,
    type KeyboardEvent,
    type FormEvent,
} from "react";
import { ArrowElbowDownLeftIcon, SquareIcon, PlusIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/use-mobile";

import { ComposerButton, type PipelineState } from "./composer-button";

export interface ComposerUIProps {
    // Core state
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onStop?: () => void;
    isLoading?: boolean;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    className?: string;

    // Pipeline state for button animations
    pipelineState?: PipelineState;

    // Optional action slots - rendered in the action bar
    /** Render file picker button (left side on desktop) */
    renderFilePicker?: () => ReactNode;
    /** Render voice input button (right side with send) */
    renderVoiceInput?: () => ReactNode;
    /** Render model selector (left side on desktop) */
    renderModelSelector?: () => ReactNode;
    /** Content to render above the composer (upload progress, banners) */
    renderAbove?: () => ReactNode;
    /** Content to render below the composer (message queue, hints) */
    renderBelow?: () => ReactNode;

    // Queue functionality (optional - for streaming interruption)
    onQueue?: () => void;
    canQueue?: boolean;
    isQueueFull?: boolean;

    // Event handlers
    onFocus?: () => void;
    onBlur?: () => void;
    onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;

    // Visual feedback
    shouldFlash?: boolean;
}

export function ComposerUI({
    value,
    onChange,
    onSubmit,
    onStop,
    isLoading = false,
    placeholder = "Message Carmenta...",
    disabled = false,
    autoFocus = true,
    className,
    pipelineState = "idle",
    renderFilePicker,
    renderVoiceInput,
    renderModelSelector,
    renderAbove,
    renderBelow,
    onQueue,
    canQueue = false,
    isQueueFull = false,
    onFocus,
    onBlur,
    onPaste,
    shouldFlash = false,
}: ComposerUIProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const isMobile = useIsMobile();

    // IME composition state (prevents sending during IME input)
    const [isComposing, setIsComposing] = useState(false);

    // Track focus state for border styling
    const [isFocused, setIsFocused] = useState(false);

    // Auto-focus on mount (desktop only)
    useEffect(() => {
        if (autoFocus && !isMobile) {
            inputRef.current?.focus();
        }
    }, [autoFocus, isMobile]);

    // Auto-resize textarea as content grows
    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [value]);

    const handleSubmit = useCallback(
        (e?: FormEvent) => {
            e?.preventDefault();
            if (value.trim() && !isLoading && !disabled && !isComposing) {
                onSubmit();
            }
        },
        [value, isLoading, disabled, isComposing, onSubmit]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            // Don't process keys during IME composition
            if (isComposing) return;

            // Escape to stop
            if (e.key === "Escape" && isLoading && onStop) {
                e.preventDefault();
                onStop();
                return;
            }

            // Mobile: Enter creates newlines, use button to send
            if (isMobile) return;

            // Desktop keyboard behavior: Enter = send, Shift+Enter = newline
            if (e.key === "Enter" && !e.shiftKey) {
                // If streaming and has input, queue instead
                if (isLoading && canQueue && value.trim() && onQueue) {
                    e.preventDefault();
                    if (!isQueueFull) {
                        onQueue();
                    }
                    return;
                }

                // Normal send
                if (value.trim() && !isLoading) {
                    e.preventDefault();
                    handleSubmit();
                }
            }
        },
        [
            isComposing,
            isLoading,
            isMobile,
            canQueue,
            value,
            isQueueFull,
            onStop,
            onQueue,
            handleSubmit,
        ]
    );

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onBlur?.();
    }, [onBlur]);

    const isDisabled = disabled || isLoading;
    const hasLeftActions = renderModelSelector || renderFilePicker;
    const hasRightActions = renderVoiceInput || true; // Always have send button

    // Determine button to show
    const renderPrimaryButton = () => {
        const buttonSizeClass = isMobile === true ? "h-11 w-11" : "";

        if (!isLoading) {
            return (
                <ComposerButton
                    type="submit"
                    variant="send"
                    aria-label="Send message"
                    disabled={disabled}
                    data-testid="send-button"
                    className={buttonSizeClass}
                >
                    <ArrowElbowDownLeftIcon className="h-5 w-5 @md:h-6 @md:w-6" />
                </ComposerButton>
            );
        }

        // Streaming + has input = Queue button
        if (value.trim() && canQueue && onQueue) {
            return (
                <ComposerButton
                    type="button"
                    variant="queue"
                    pipelineState={pipelineState}
                    aria-label="Queue message"
                    onClick={() => !isQueueFull && onQueue()}
                    disabled={isQueueFull}
                    data-testid="queue-button"
                    className={buttonSizeClass}
                >
                    <PlusIcon className="h-5 w-5 @md:h-6 @md:w-6" weight="bold" />
                </ComposerButton>
            );
        }

        // Streaming + no input = Stop button
        return (
            <ComposerButton
                type="button"
                variant="stop"
                pipelineState={pipelineState}
                aria-label="Stop generation"
                onClick={onStop}
                data-testid="stop-button"
                className={buttonSizeClass}
            >
                <SquareIcon className="h-4 w-4 @md:h-5 @md:w-5" />
            </ComposerButton>
        );
    };

    return (
        <div className={cn("flex w-full flex-col gap-2", className)}>
            {/* Content above composer (upload progress, banners) */}
            {renderAbove?.()}

            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className={cn(
                    "relative flex w-full flex-col transition-all @md:flex-row @md:items-center",
                    shouldFlash && "ring-primary/40 ring-2"
                )}
            >
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={onPaste}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => {
                        // IME composition ends before value updates, defer flag reset
                        setTimeout(() => setIsComposing(false), 0);
                    }}
                    placeholder={placeholder}
                    // Mobile: enterKeyHint="enter" shows "return" key (creates newlines)
                    // Desktop: enterKeyHint="send" shows "send" key
                    enterKeyHint={isMobile ? "enter" : "send"}
                    autoCapitalize="sentences"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={isDisabled}
                    className={cn(
                        // Layout - use container queries for width responsiveness
                        "w-full flex-none resize-none @md:flex-1",
                        // Height - 44px mobile, 56px desktop
                        "max-h-48 min-h-11 md:max-h-60 md:min-h-14",
                        // Spacing - symmetric for centered placeholder
                        "px-4 py-2.5 @md:px-6 @md:py-4",
                        // Typography
                        "text-base leading-5 outline-none",
                        "text-foreground/95 placeholder:text-foreground/40",
                        // Shape + transition
                        "rounded-2xl transition-all",
                        // Sunken glass effect
                        "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                        // Border - darker on focus
                        "border",
                        isFocused ? "border-foreground/35" : "border-foreground/8",
                        // Multi-line gets slightly darker bg
                        /\n/.test(value) && "bg-background/30",
                        // Disabled state
                        isDisabled && "cursor-not-allowed opacity-50"
                    )}
                    rows={1}
                    data-testid="composer-input"
                />

                {/* Action bar: responsive layout via container width */}
                <div className="flex items-center justify-between gap-2 px-4 py-3.5 @md:justify-end @md:gap-3 @md:py-0 @md:pr-4">
                    {/* Left group (mobile) / inline (desktop): Model + Attach */}
                    {hasLeftActions && (
                        <div className="flex items-center gap-2 @md:order-last @md:gap-3">
                            {renderModelSelector?.()}
                            {renderFilePicker?.()}
                        </div>
                    )}

                    {/* Right group: Send/Queue/Stop + Voice */}
                    <div
                        className={cn(
                            "flex items-center gap-2 @md:order-first @md:gap-3",
                            !hasLeftActions && "ml-auto"
                        )}
                    >
                        {renderPrimaryButton()}
                        {renderVoiceInput?.()}
                    </div>
                </div>
            </form>

            {/* Content below composer (message queue, hints) */}
            {renderBelow?.()}
        </div>
    );
}
