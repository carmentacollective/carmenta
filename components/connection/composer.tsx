"use client";

/**
 * Composer - The glassmorphism input dock with model selector.
 *
 * Core behaviors:
 * - Enter = send, Shift+Enter = newline, Escape = stop
 * - IME composition detection (prevents sending mid-composition)
 * - Stop returns last message to input for quick correction
 * - Autofocus on mount (all devices), re-focus after send
 * - One-time Shift+Enter hint for new users
 */

import {
    useState,
    useRef,
    useEffect,
    useCallback,
    forwardRef,
    type FormEvent,
    type KeyboardEvent,
    type ComponentProps,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Square, ArrowElbowDownLeft } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { useConcierge } from "@/lib/concierge/context";
import { getModel } from "@/lib/model-config";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { useMessageEffects } from "@/lib/hooks/use-message-effects";
import { useDraftPersistence } from "@/lib/hooks/use-draft-persistence";
import { PASTE_THRESHOLD } from "@/lib/storage/file-config";
import { USER_ENGAGED_EVENT } from "@/components/ui/oracle-whisper";
import { VoiceInputButton, type VoiceInputButtonRef } from "@/components/voice";

import { useChatContext, useModelOverrides } from "./connect-runtime-provider";
import { ModelSelectorTrigger } from "./model-selector";
import { useFileAttachments } from "./file-attachment-context";
import { FilePickerButton } from "./file-picker-button";
import { useConnection } from "./connection-context";
import { DraftRecoveryBanner } from "./draft-recovery-banner";
import { UploadProgressDisplay } from "./upload-progress";

export interface ComposerProps {
    /** Callback to mark a message as stopped (for visual indicator) */
    onMarkMessageStopped: (messageId: string) => void;
}

const SHIFT_ENTER_HINT_KEY = "carmenta:shift-enter-hint-shown";

export function Composer({ onMarkMessageStopped }: ComposerProps) {
    const { overrides, setOverrides } = useModelOverrides();
    const { concierge, setConcierge } = useConcierge();
    const { messages, append, isLoading, stop, input, setInput, handleInputChange } =
        useChatContext();
    const {
        addFiles,
        isUploading,
        completedFiles,
        clearFiles,
        pendingFiles,
        removeFile,
        addPastedText,
        getNextPlaceholder,
        getTextContent,
    } = useFileAttachments();
    const { activeConnectionId } = useConnection();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const isMobile = useIsMobile();
    const { trigger: triggerHaptic } = useHapticFeedback();
    const { checkMessage } = useMessageEffects();

    // Draft persistence - saves unsent messages to localStorage
    const { hasRecoveredDraft, dismissRecovery, clearDraft, onMessageSent } =
        useDraftPersistence({
            connectionId: activeConnectionId,
            input,
            setInput,
        });

    // IME composition state
    const [isComposing, setIsComposing] = useState(false);

    // Track last sent message for stop-returns-message behavior
    const lastSentMessageRef = useRef<string | null>(null);

    // Prevent double-submit race condition - set synchronously before async append
    const isSubmittingRef = useRef(false);

    // Track if user manually stopped vs natural completion (for button animation)
    const wasStoppedRef = useRef(false);

    // Flash state for input when send clicked without text
    const [shouldFlash, setShouldFlash] = useState(false);

    // Shift+Enter hint: show once for new users, then never again
    const [showShiftEnterHint, setShowShiftEnterHint] = useState(false);

    // Track focus state for underbar styling and tip display
    const [isFocused, setIsFocused] = useState(false);

    const conciergeModel = concierge ? getModel(concierge.modelId) : null;

    // Track if initial autofocus has been applied (prevents re-focus on resize)
    const hasInitialFocusRef = useRef(false);

    // Track if we've emitted user engagement event this session
    // (once whisper is dismissed, no need to emit again)
    const hasEmittedEngagementRef = useRef(false);

    // Emit user engagement event (dismisses feature tips whisper)
    const emitUserEngaged = useCallback(() => {
        if (hasEmittedEngagementRef.current) return;
        hasEmittedEngagementRef.current = true;
        window.dispatchEvent(new CustomEvent(USER_ENGAGED_EVENT));
    }, []);

    // Wrap handleInputChange to detect first keystroke (dismisses feature tips)
    const handleInputChangeWithEngagement = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            // Emit engagement on first character typed
            if (e.target.value.length > 0) {
                emitUserEngaged();
            }
            handleInputChange(e);
        },
        [handleInputChange, emitUserEngaged]
    );

    // Voice input: track prefix text when session starts to preserve existing input
    const voicePrefixRef = useRef("");
    // Voice input: ref to stop recording on submit
    const voiceInputRef = useRef<VoiceInputButtonRef>(null);

    // Voice input: called when new session starts - preserve existing input as prefix
    const handleVoiceSessionStart = useCallback(() => {
        // If there's existing text when a new session starts, preserve it as prefix
        // This prevents accidental replacement if connection dropped mid-recording
        const currentInput = inputRef.current?.value || "";
        voicePrefixRef.current = currentInput ? currentInput + " " : "";
    }, []);

    // Voice input: update input field as user speaks
    const handleVoiceTranscript = useCallback(
        (transcript: string) => {
            // Append transcript to any preserved prefix from previous session
            const fullText = voicePrefixRef.current + transcript;
            setInput(fullText);
            emitUserEngaged();
        },
        [setInput, emitUserEngaged]
    );

    // Helper to insert text at cursor position and update input
    const insertAtCursor = useCallback(
        (text: string) => {
            if (!inputRef.current) return;

            const start = inputRef.current.selectionStart;
            const end = inputRef.current.selectionEnd;
            const currentValue = inputRef.current.value;

            const newValue =
                currentValue.substring(0, start) + text + currentValue.substring(end);

            setInput(newValue);

            // Position cursor after inserted text
            setTimeout(() => {
                const newPosition = start + text.length;
                inputRef.current?.setSelectionRange(newPosition, newPosition);
                inputRef.current?.focus();
            }, 0);
        },
        [setInput]
    );

    // Paste handler - detect images and large text from clipboard
    // Inserts Claude Code-style placeholders: [Pasted Text #1], [Pasted Image #1]
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // Priority 1: Handle images
            const imageFiles: File[] = [];
            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) imageFiles.push(file);
                }
            }

            // Priority 2: Handle text (large → attachment, small → inline)
            const plainText = e.clipboardData?.getData("text/plain");
            const hasLargeText = plainText && plainText.length > PASTE_THRESHOLD;

            // If we have images or large text, prevent default and handle ourselves
            if (imageFiles.length > 0 || hasLargeText) {
                e.preventDefault();

                // Collect placeholders to insert at cursor
                const placeholders: string[] = [];

                // Process images - each gets its own placeholder
                if (imageFiles.length > 0) {
                    for (const imageFile of imageFiles) {
                        const { placeholder, filename } = getNextPlaceholder(
                            "image",
                            imageFile.type
                        );
                        // Rename file to match placeholder naming
                        const renamedFile = new File([imageFile], filename, {
                            type: imageFile.type,
                        });
                        addFiles([renamedFile], placeholder);
                        placeholders.push(placeholder);
                    }
                }

                // Process large text as attachment
                if (hasLargeText) {
                    const { placeholder, filename } = getNextPlaceholder("text");
                    const blob = new Blob([plainText], { type: "text/plain" });
                    const file = new File([blob], filename, { type: "text/plain" });
                    addPastedText([file], plainText, placeholder);
                    placeholders.push(placeholder);
                }

                // Insert all placeholders at cursor position
                if (placeholders.length > 0) {
                    insertAtCursor(placeholders.join(" "));
                }

                return;
            }

            // Small text or no special content: let browser handle normally
        },
        [addFiles, addPastedText, getNextPlaceholder, insertAtCursor]
    );

    // Insert inline handler - converts file attachment back to textarea text
    // Uses inputRef.current.value to avoid depending on input state (keystroke changes)
    const handleInsertInline = useCallback(
        (fileId: string) => {
            const textContent = getTextContent(fileId);
            if (!textContent || !inputRef.current) return;

            // Insert into textarea at cursor position
            const start = inputRef.current.selectionStart;
            const end = inputRef.current.selectionEnd;
            const currentValue = inputRef.current.value;

            const newValue =
                currentValue.substring(0, start) +
                textContent +
                currentValue.substring(end);

            setInput(newValue);

            // Remove from attachments only after successful insertion
            removeFile(fileId);

            // Position cursor after inserted text
            setTimeout(() => {
                inputRef.current?.setSelectionRange(
                    start + textContent.length,
                    start + textContent.length
                );
                inputRef.current?.focus();
            }, 0);
        },
        [getTextContent, removeFile, setInput]
    );

    // Autofocus on mount (all devices)
    // User preference: keyboard should appear on mobile too
    useEffect(() => {
        if (hasInitialFocusRef.current) return;
        hasInitialFocusRef.current = true;

        if (inputRef.current) {
            // Use preventScroll on mobile to avoid keyboard-induced scroll jank
            inputRef.current.focus({ preventScroll: isMobile });
        }
    }, [isMobile]);

    // Show Shift+Enter hint on first focus (one-time, stored in localStorage)
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if hint was already shown
        const alreadyShown = localStorage.getItem(SHIFT_ENTER_HINT_KEY) === "true";
        if (alreadyShown) return;

        // Show the hint (will render when user focuses)
        setShowShiftEnterHint(true);

        // Auto-dismiss after 5 seconds
        const timer = setTimeout(() => {
            setShowShiftEnterHint(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    // Mark hint as shown only when user actually sees it (focused + visible)
    useEffect(() => {
        if (showShiftEnterHint && isFocused) {
            localStorage.setItem(SHIFT_ENTER_HINT_KEY, "true");
        }
    }, [showShiftEnterHint, isFocused]);

    // Auto-resize textarea as content grows
    // Pattern: reset to auto → measure scrollHeight → set explicit height
    useEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        // Reset height to auto so scrollHeight reflects actual content
        textarea.style.height = "auto";
        // Set to scrollHeight (clamped by max-height in CSS)
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [input]);

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();

            // Stop voice recording if active - submit should finalize the input
            voiceInputRef.current?.stop();
            // Clear voice prefix since we're submitting
            voicePrefixRef.current = "";

            // Auto-insert PASTED text file attachments inline (Anthropic doesn't support text files)
            // Only process text files that have pasted content stored (from large paste feature)
            // Text files from file picker don't have pasted content and should fail with clear error
            const TEXT_MIME_TYPES = [
                "text/plain",
                "text/markdown",
                "text/csv",
                "application/json",
            ];
            const isTextFile = (mimeType: string) => TEXT_MIME_TYPES.includes(mimeType);

            // Find pasted text files (have content in pastedTextContent Map)
            const pastedTextFiles = pendingFiles.filter(
                (p) => isTextFile(p.file.type) && getTextContent(p.id) !== undefined
            );

            if (pastedTextFiles.length > 0) {
                // Replace each placeholder with its actual content
                let newInput = input;
                for (const file of pastedTextFiles) {
                    const content = getTextContent(file.id);
                    if (content && file.placeholder) {
                        // Try to replace placeholder with actual content
                        const replacedInput = newInput.replace(
                            file.placeholder,
                            content
                        );
                        if (replacedInput === newInput) {
                            // Placeholder not found (user deleted it) - append content to preserve it
                            newInput = newInput ? `${newInput}\n\n${content}` : content;
                        } else {
                            newInput = replacedInput;
                        }
                    } else if (content) {
                        // No placeholder (shouldn't happen, but handle gracefully)
                        newInput = newInput ? `${newInput}\n\n${content}` : content;
                    }
                    removeFile(file.id);
                }

                // Re-submit with expanded content
                if (newInput !== input) {
                    setInput(newInput);
                    setTimeout(() => {
                        formRef.current?.requestSubmit();
                    }, 0);
                    return;
                }
            }

            // If no text and no non-text files, flash the input area and focus it
            const nonTextFiles = completedFiles.filter((f) => !isTextFile(f.mediaType));
            if (!input.trim() && nonTextFiles.length === 0) {
                setShouldFlash(true);
                setTimeout(() => setShouldFlash(false), 300); // Brief hint, not punitive
                inputRef.current?.focus();
                return;
            }

            // Prevent concurrent submits (double-click, rapid Enter)
            // Use ref for synchronous check before React state updates
            if (isSubmittingRef.current) return;

            // Don't send while uploading or already loading
            if (isLoading || isComposing || isUploading) return;

            // Signal user engagement (dismisses feature tips whisper)
            emitUserEngaged();

            // Haptic feedback on send
            triggerHaptic();

            const message = input.trim();
            lastSentMessageRef.current = message;
            wasStoppedRef.current = false; // Reset stop flag for new message
            isSubmittingRef.current = true; // Set synchronously before async
            setInput("");

            // Check for secret phrases (easter egg effects)
            checkMessage(message);

            try {
                await append({
                    role: "user",
                    content: message,
                    files: nonTextFiles.map((f) => ({
                        url: f.url,
                        mediaType: f.mediaType,
                        name: f.name,
                    })),
                });
                // Clear files and draft after successful send
                clearFiles();
                onMessageSent();
                // Re-focus input for quick follow-up messages
                // Use preventScroll on mobile to avoid keyboard-induced scroll jank
                inputRef.current?.focus({ preventScroll: isMobile });
            } catch (error) {
                logger.error(
                    { error: error instanceof Error ? error.message : String(error) },
                    "Failed to send message"
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
            isUploading,
            completedFiles,
            pendingFiles,
            getTextContent,
            removeFile,
            setInput,
            append,
            clearFiles,
            onMessageSent,
            emitUserEngaged,
            triggerHaptic,
            checkMessage,
            isMobile,
        ]
    );

    const handleStop = useCallback(() => {
        if (!isLoading) return;
        triggerHaptic();
        wasStoppedRef.current = true; // Mark as user-stopped (no success checkmark)
        stop();
        // Clear concierge state immediately for clean UI reset
        // The effect in runtime provider should also do this, but explicit is safer
        setConcierge(null);

        // Mark the last assistant message as stopped (for visual indicator)
        // Only if the last message is actually an assistant message (not during pending state)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === "assistant") {
            onMarkMessageStopped(lastMessage.id);
        }

        // Restore message for quick correction (only if user hasn't typed new content)
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

            // Enter sends if not loading and has content
            // During loading, let Enter insert newline naturally (user drafts next message)
            if (e.key === "Enter" && !e.shiftKey) {
                if (isLoading) {
                    // Let default behavior insert newline while streaming
                    return;
                }
                if (input.trim() || completedFiles.length > 0) {
                    e.preventDefault();
                    handleSubmit(e as unknown as FormEvent);
                }
            }
        },
        [isComposing, isLoading, input, completedFiles, handleStop, handleSubmit]
    );

    const showStop = isLoading;
    const hasPendingFiles = pendingFiles.length > 0;

    // Track "complete" state for exhale animation
    const wasLoadingRef = useRef(isLoading);
    const [showComplete, setShowComplete] = useState(false);

    // Detect loading → not loading transition and show complete briefly
    // Skip checkmark animation if user manually stopped (wasStoppedRef)
    useEffect(() => {
        const wasLoading = wasLoadingRef.current;
        wasLoadingRef.current = isLoading;

        if (wasLoading && !isLoading && !wasStoppedRef.current) {
            // Natural completion: show success checkmark
            // Duration (600ms) exceeds exhale animation (500ms) so success registers
            const startTimer = setTimeout(() => setShowComplete(true), 0);
            const endTimer = setTimeout(() => setShowComplete(false), 600);
            return () => {
                clearTimeout(startTimer);
                clearTimeout(endTimer);
            };
        }
        // If user stopped, wasStoppedRef is true so we skip the checkmark
    }, [isLoading]);

    // Track concierge selection phase explicitly
    // This is true ONLY when we're actively selecting a model (loading + no concierge data yet)
    // Using explicit state prevents the bug where sparkles persist after loading ends
    const [isConciergeSelecting, setIsConciergeSelecting] = useState(false);

    useEffect(() => {
        // Start selecting: loading just started and no concierge data yet
        if (isLoading && !concierge) {
            setIsConciergeSelecting(true);
        }
        // Stop selecting: either got concierge data OR loading stopped
        // This ensures sparkles ALWAYS stop when loading ends, regardless of concierge state
        else {
            setIsConciergeSelecting(false);
        }
    }, [isLoading, concierge]);

    // Compute pipeline state for button styling
    // Uses explicit isConciergeSelecting state rather than inferring from !concierge
    const pipelineState: PipelineState = showComplete
        ? "complete"
        : isConciergeSelecting
          ? "concierge"
          : isLoading
            ? "streaming"
            : "idle";

    return (
        <div className="flex w-full flex-col gap-2">
            {/* Upload progress display */}
            {hasPendingFiles && (
                <UploadProgressDisplay onInsertInline={handleInsertInline} />
            )}

            {/* Draft recovery banner - shows when we restored unsent text */}
            <DraftRecoveryBanner
                show={hasRecoveredDraft}
                onContinue={dismissRecovery}
                onStartFresh={clearDraft}
            />

            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className={cn(
                    "relative flex w-full flex-col transition-all sm:flex-row sm:items-center",
                    shouldFlash && "ring-primary/40 ring-2"
                )}
            >
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChangeWithEngagement}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => {
                        // IME composition ends before value updates, defer flag reset
                        setTimeout(() => setIsComposing(false), 0);
                    }}
                    placeholder="Message Carmenta..."
                    className={cn(
                        // Layout
                        "w-full flex-none resize-none sm:flex-1",
                        // Height - 44px mobile, 56px desktop
                        "max-h-48 min-h-11 md:max-h-60 md:min-h-14",
                        // Spacing - symmetric for centered placeholder
                        "px-4 py-2.5 sm:px-6 sm:py-4",
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
                        /\n/.test(input) && "bg-background/30"
                    )}
                    rows={1}
                    data-testid="composer-input"
                />

                {/* Action bar: responsive layout via CSS */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 sm:justify-end sm:gap-1.5 sm:py-0 sm:pr-4">
                    {/* Left group (mobile) / inline (desktop): Model + Attach */}
                    <div className="flex items-center gap-1 sm:order-last sm:gap-1.5">
                        <ModelSelectorTrigger
                            overrides={overrides}
                            onChange={setOverrides}
                            conciergeModel={conciergeModel}
                            showLabel={isMobile === true}
                            className={isMobile === true ? "h-11" : ""}
                        />
                        <FilePickerButton
                            className={isMobile === true ? "h-11 w-11" : ""}
                        />
                    </div>

                    {/* Right group: Send + Voice */}
                    <div className="flex items-center gap-2 sm:order-first sm:gap-1.5">
                        {showStop ? (
                            <ComposerButton
                                type="button"
                                variant="stop"
                                pipelineState={pipelineState}
                                aria-label="Stop generation"
                                onClick={handleStop}
                                data-testid="stop-button"
                                className={isMobile === true ? "h-11 w-11" : ""}
                            >
                                <Square className="h-4 w-4 sm:h-5 sm:w-5" />
                            </ComposerButton>
                        ) : (
                            <ComposerButton
                                type="submit"
                                variant="send"
                                aria-label="Send message"
                                disabled={isUploading}
                                data-testid="send-button"
                                className={isMobile === true ? "h-11 w-11" : ""}
                            >
                                <ArrowElbowDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                            </ComposerButton>
                        )}
                        <VoiceInputButton
                            ref={voiceInputRef}
                            onTranscriptUpdate={handleVoiceTranscript}
                            onSessionStart={handleVoiceSessionStart}
                            disabled={isLoading}
                            className={isMobile === true ? "h-11 w-11" : ""}
                        />
                    </div>
                </div>
            </form>

            {/* Tip zone - shows below input when focused (one-time hint for new users) */}
            <AnimatePresence>
                {showShiftEnterHint && isFocused && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="text-foreground/50 flex items-center justify-center gap-1.5 text-xs"
                    >
                        <kbd className="bg-foreground/10 rounded px-1.5 py-0.5 font-mono text-[10px]">
                            Shift
                        </kbd>
                        <span>+</span>
                        <kbd className="bg-foreground/10 rounded px-1.5 py-0.5 font-mono text-[10px]">
                            Enter
                        </kbd>
                        <span>for new line</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Composer button with breathing animation and pipeline state awareness.
 *
 * Design choices (from design lab iteration 8):
 * - Breathing: Inhale (scale 1.1) on click, exhale (scale 0.92→1) on return to ready
 * - Icons: CornerDownLeft → Sparkles (concierge) → PenLine (streaming) → Check → CornerDownLeft
 * - Sparkles: 3 cardinal points during concierge, button gradient colors
 *
 * Variants:
 * - ghost: Subtle background for secondary actions
 * - send: Vibrant Holo gradient (purple → cyan → pink) with breathing
 * - stop: Muted slate for stop generation
 */
type PipelineState = "idle" | "concierge" | "streaming" | "complete";

interface ComposerButtonProps extends ComponentProps<"button"> {
    variant?: "ghost" | "send" | "stop";
    pipelineState?: PipelineState;
    "data-testid"?: string;
}

// Breathing animation values (matching oracle pattern)
const INHALE_SCALE = 1.1;
const EXHALE_KEYFRAMES = [1, 0.92, 1];
const INHALE_DURATION = 0.15;
const EXHALE_DURATION = 0.5;

// Sparkle positions - 3 cardinal points (top, right, bottom-left)
const sparklePositions = [
    { top: "-8px", left: "50%", transform: "translateX(-50%)" }, // Top
    { top: "50%", right: "-8px", transform: "translateY(-50%)" }, // Right
    { bottom: "-6px", left: "25%", transform: "translateX(-50%)" }, // Bottom-left
];

// Sparkle colors matching the button gradient
const sparkleColors = [
    "bg-purple-400/60 shadow-purple-400/40", // Purple from gradient
    "bg-cyan-400/60 shadow-cyan-400/40", // Cyan from gradient
    "bg-pink-400/60 shadow-pink-400/40", // Pink from gradient
];

const ComposerButton = forwardRef<HTMLButtonElement, ComposerButtonProps>(
    (
        {
            className,
            variant = "ghost",
            pipelineState = "idle",
            disabled,
            children,
            "data-testid": dataTestId,
            ...props
        },
        ref
    ) => {
        // Track state transitions for breathing animation
        const [justCompleted, setJustCompleted] = useState(false);
        const [isInhaling, setIsInhaling] = useState(false);
        const prevStateRef = useRef<PipelineState>(pipelineState);

        // Detect transitions and trigger animations inside effect
        useEffect(() => {
            const prevState = prevStateRef.current;
            prevStateRef.current = pipelineState;

            // Inhale: idle → active state
            if (prevState === "idle" && pipelineState !== "idle") {
                // Defer to next tick to avoid synchronous setState in effect
                const startTimer = setTimeout(() => setIsInhaling(true), 0);
                const endTimer = setTimeout(
                    () => setIsInhaling(false),
                    INHALE_DURATION * 1000
                );
                return () => {
                    clearTimeout(startTimer);
                    clearTimeout(endTimer);
                };
            }

            // Exhale: complete → idle
            if (prevState === "complete" && pipelineState === "idle") {
                // Defer to next tick to avoid synchronous setState in effect
                const startTimer = setTimeout(() => setJustCompleted(true), 0);
                const endTimer = setTimeout(
                    () => setJustCompleted(false),
                    EXHALE_DURATION * 1000
                );
                return () => {
                    clearTimeout(startTimer);
                    clearTimeout(endTimer);
                };
            }
        }, [pipelineState]);

        // Determine which icon to show based on variant
        // Stop button always shows Square (universal stop symbol)
        // Ring color varies by state, but icon stays consistent for clear affordance
        const getIcon = () => {
            if (variant === "stop") {
                return <Square className="h-4 w-4 sm:h-5 sm:w-5" />;
            }
            // Send and ghost variants use children
            return children;
        };

        // Calculate scale for breathing animation
        const getScale = () => {
            if (isInhaling) return INHALE_SCALE;
            if (justCompleted) return EXHALE_KEYFRAMES;
            return 1;
        };

        // For ghost variant, use simple button without animations
        if (variant === "ghost") {
            return (
                <button
                    ref={ref}
                    disabled={disabled}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                        "shadow-xl ring-1 backdrop-blur-xl transition-all",
                        "hover:ring-primary/40 hover:scale-105 hover:shadow-2xl hover:ring-[3px]",
                        "active:translate-y-0.5 active:shadow-sm",
                        "focus:ring-primary/40 focus:scale-105 focus:shadow-2xl focus:ring-[3px] focus:outline-none",
                        "bg-background/50 text-foreground/60 ring-border/40 hover:bg-background/80 opacity-70 hover:opacity-100",
                        disabled && "btn-disabled",
                        className
                    )}
                    {...props}
                >
                    {children}
                </button>
            );
        }

        // Send and stop variants get the full animated treatment
        return (
            <div className="relative">
                {/* Sparkles during concierge - 3 cardinal points with button gradient colors */}
                <AnimatePresence mode="sync">
                    {variant === "stop" &&
                        pipelineState === "concierge" &&
                        sparklePositions.map((pos, i) => (
                            <motion.div
                                key={i}
                                className={cn(
                                    "absolute h-1.5 w-1.5 rounded-full shadow-[0_0_6px_2px]",
                                    sparkleColors[i]
                                )}
                                style={pos}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: [0.5, 1, 0.5],
                                    scale: [0.8, 1.2, 0.8],
                                    transition: {
                                        duration: 1.5,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: "easeInOut",
                                    },
                                }}
                                exit={{
                                    opacity: 0,
                                    scale: 0,
                                    transition: { duration: 0.15, ease: "easeOut" },
                                }}
                            />
                        ))}
                </AnimatePresence>

                <motion.button
                    ref={ref}
                    type={props.type}
                    disabled={disabled}
                    onClick={props.onClick}
                    aria-label={props["aria-label"]}
                    data-testid={dataTestId}
                    animate={{
                        scale: getScale(),
                    }}
                    transition={{
                        scale: isInhaling
                            ? { duration: INHALE_DURATION, ease: "easeOut" }
                            : justCompleted
                              ? { duration: EXHALE_DURATION, ease: "easeInOut" }
                              : { duration: 0.3 },
                    }}
                    className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                        "shadow-xl ring-1 backdrop-blur-xl transition-[box-shadow,ring-color]",
                        "hover:ring-primary/40 hover:shadow-2xl hover:ring-[3px]",
                        "active:translate-y-0.5 active:shadow-sm",
                        "focus:ring-primary/40 focus:shadow-2xl focus:ring-[3px] focus:outline-none",
                        // Send variant
                        variant === "send" && "btn-cta ring-transparent",
                        // Stop variant - base styles
                        variant === "stop" &&
                            "bg-muted text-muted-foreground ring-muted/20 hover:bg-muted/90",
                        // Stop + concierge: rainbow ring animation
                        variant === "stop" &&
                            pipelineState === "concierge" &&
                            "oracle-working-ring ring-primary/50 ring-2",
                        // Stop + streaming: subtle glow
                        variant === "stop" &&
                            pipelineState === "streaming" &&
                            "ring-2 ring-cyan-400/40",
                        // Stop + complete: success state
                        variant === "stop" &&
                            pipelineState === "complete" &&
                            "ring-2 ring-green-400/40",
                        // Stop + idle: default muted
                        variant === "stop" && pipelineState === "idle" && "opacity-60",
                        disabled && "btn-disabled",
                        className
                    )}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${variant}-${pipelineState}`}
                            initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                            transition={{ duration: 0.2 }}
                        >
                            {getIcon()}
                        </motion.div>
                    </AnimatePresence>
                </motion.button>
            </div>
        );
    }
);
ComposerButton.displayName = "ComposerButton";
