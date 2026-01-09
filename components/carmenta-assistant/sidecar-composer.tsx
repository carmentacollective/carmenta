"use client";

/**
 * SidecarComposer
 *
 * Simplified composer for the sidecar context. Supports:
 * - Custom placeholder text (context-aware)
 * - Basic text input with auto-resize
 * - Send/stop functionality
 * - Voice input
 *
 * This is a slimmed-down version of the main Composer without model selection
 * or file attachments (those are handled by the main chat interface).
 */

import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type FormEvent,
    type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SquareIcon, ArrowElbowDownLeftIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { useConcierge } from "@/lib/concierge/context";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { useMessageEffects } from "@/lib/hooks/use-message-effects";
import { VoiceInputButton, type VoiceInputButtonRef } from "@/components/voice";
import { useChatContext } from "@/components/connection";

interface SidecarComposerProps {
    /** Callback to mark a message as stopped */
    onMarkMessageStopped: (messageId: string) => void;
    /** Placeholder text for the input */
    placeholder?: string;
}

export function SidecarComposer({
    onMarkMessageStopped,
    placeholder = "Message Carmenta...",
}: SidecarComposerProps) {
    const { setConcierge } = useConcierge();
    const { messages, append, isLoading, stop, input, setInput, handleInputChange } =
        useChatContext();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const isMobile = useIsMobile();
    const { trigger: triggerHaptic } = useHapticFeedback();
    const { checkMessage } = useMessageEffects();

    // IME composition state
    const [isComposing, setIsComposing] = useState(false);

    // Track last sent message for stop-returns-message behavior
    const lastSentMessageRef = useRef<string | null>(null);

    // Prevent double-submit
    const isSubmittingRef = useRef(false);

    // Track if user manually stopped
    const wasStoppedRef = useRef(false);

    // Track focus state
    const [isFocused, setIsFocused] = useState(false);

    // Track initial focus
    const hasInitialFocusRef = useRef(false);

    // Voice input refs
    const voicePrefixRef = useRef("");
    const voiceInputRef = useRef<VoiceInputButtonRef>(null);

    // Voice input handlers
    const handleVoiceSessionStart = useCallback(() => {
        const currentInput = inputRef.current?.value || "";
        voicePrefixRef.current = currentInput ? currentInput + " " : "";
    }, []);

    const handleVoiceTranscript = useCallback(
        (transcript: string) => {
            const fullText = voicePrefixRef.current + transcript;
            setInput(fullText);
        },
        [setInput]
    );

    // Autofocus on mount - desktop only
    useEffect(() => {
        if (hasInitialFocusRef.current) return;
        hasInitialFocusRef.current = true;

        if (isMobile !== false) return;

        if (inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
        }
    }, [isMobile]);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [input]);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();

            // Stop voice recording if active
            voiceInputRef.current?.stop();
            voicePrefixRef.current = "";

            // Validate input
            if (!input.trim()) {
                inputRef.current?.focus();
                return;
            }

            // Prevent concurrent submits
            if (isSubmittingRef.current) return;
            if (isLoading || isComposing) return;

            // Haptic feedback
            triggerHaptic();

            const message = input.trim();
            lastSentMessageRef.current = message;
            wasStoppedRef.current = false;
            isSubmittingRef.current = true;
            setInput("");

            // Check for easter eggs
            checkMessage(message);

            try {
                await append({
                    role: "user",
                    content: message,
                });
                inputRef.current?.focus({ preventScroll: isMobile });
            } catch (error) {
                logger.error(
                    { error: error instanceof Error ? error.message : String(error) },
                    "Failed to send message in sidecar"
                );
                setInput(message);
            } finally {
                isSubmittingRef.current = false;
            }
        },
        [
            input,
            isLoading,
            isComposing,
            setInput,
            append,
            triggerHaptic,
            checkMessage,
            isMobile,
        ]
    );

    const handleStop = useCallback(() => {
        if (!isLoading) return;
        triggerHaptic();
        wasStoppedRef.current = true;
        stop();
        setConcierge(null);

        // Mark last assistant message as stopped
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "assistant") {
            onMarkMessageStopped(lastMessage.id);
        }

        // Restore message for quick correction
        if (lastSentMessageRef.current && !input.trim()) {
            setInput(lastSentMessageRef.current);
        }
        lastSentMessageRef.current = null;
    }, [
        isLoading,
        triggerHaptic,
        stop,
        setConcierge,
        messages,
        onMarkMessageStopped,
        input,
        setInput,
    ]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (isComposing) return;

            // Escape stops generation
            if (e.key === "Escape" && isLoading) {
                e.preventDefault();
                handleStop();
                return;
            }

            // Mobile: Enter = newline
            if (isMobile === true && e.key === "Enter") {
                if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    if (input.trim()) {
                        handleSubmit(e as unknown as FormEvent);
                    }
                }
                return;
            }

            // Desktop: Enter = send, Shift+Enter = newline
            if (e.key === "Enter" && !e.shiftKey) {
                if (input.trim()) {
                    e.preventDefault();
                    handleSubmit(e as unknown as FormEvent);
                }
            }
        },
        [isComposing, isLoading, isMobile, input, handleStop, handleSubmit]
    );

    // Track "complete" state for animation
    const wasLoadingRef = useRef(isLoading);
    const [showComplete, setShowComplete] = useState(false);

    useEffect(() => {
        const wasLoading = wasLoadingRef.current;
        wasLoadingRef.current = isLoading;

        if (wasLoading && !isLoading && !wasStoppedRef.current) {
            const startTimer = setTimeout(() => setShowComplete(true), 0);
            const endTimer = setTimeout(() => setShowComplete(false), 600);
            return () => {
                clearTimeout(startTimer);
                clearTimeout(endTimer);
            };
        }
    }, [isLoading]);

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex w-full items-end gap-2"
        >
            <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => {
                    setTimeout(() => setIsComposing(false), 0);
                }}
                placeholder={placeholder}
                enterKeyHint={isMobile ? "enter" : "send"}
                autoCapitalize="sentences"
                autoCorrect="off"
                spellCheck={false}
                className={cn(
                    "w-full flex-1 resize-none",
                    "max-h-32 min-h-11",
                    "px-4 py-3",
                    "text-sm leading-5 outline-none",
                    "text-foreground/95 placeholder:text-foreground/40",
                    "rounded-xl transition-all",
                    "bg-foreground/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                    "border",
                    isFocused ? "border-foreground/35" : "border-foreground/8"
                )}
                rows={1}
            />

            <div className="flex shrink-0 items-center gap-1.5">
                {isLoading ? (
                    <button
                        type="button"
                        onClick={handleStop}
                        className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-full",
                            "bg-muted text-muted-foreground",
                            "hover:bg-muted/90 transition-all",
                            "ring-muted/20 ring-1"
                        )}
                        aria-label="Stop generation"
                    >
                        <SquareIcon className="h-4 w-4" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        className="btn-cta flex h-11 w-11 items-center justify-center rounded-full ring-transparent"
                        aria-label="Send message"
                    >
                        <ArrowElbowDownLeftIcon className="h-5 w-5" />
                    </button>
                )}
                <VoiceInputButton
                    ref={voiceInputRef}
                    onTranscriptUpdate={handleVoiceTranscript}
                    onSessionStart={handleVoiceSessionStart}
                    disabled={isLoading}
                    className="h-11 w-11"
                />
            </div>
        </form>
    );
}
