"use client";

/**
 * Voice Input Button
 *
 * Microphone button for real-time voice transcription.
 * Shows recording state with visual feedback, streams transcript
 * directly into the chat input.
 */

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";

export interface VoiceInputButtonRef {
    /** Stop recording if currently active */
    stop: () => void;
    /** Whether currently recording */
    isListening: boolean;
}

interface VoiceInputButtonProps {
    /** Callback when transcript is updated (real-time) */
    onTranscriptUpdate?: (transcript: string) => void;
    /** Callback when recording stops with final transcript */
    onTranscriptComplete?: (transcript: string) => void;
    /** Callback when a new recording session starts */
    onSessionStart?: () => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Additional class names */
    className?: string;
    /** Visual variant: "ghost" (default) toggles between ghost/active, "primary" always shows filled */
    variant?: "ghost" | "primary";
}

export const VoiceInputButton = forwardRef<VoiceInputButtonRef, VoiceInputButtonProps>(
    function VoiceInputButton(
        {
            onTranscriptUpdate,
            onTranscriptComplete,
            onSessionStart,
            disabled = false,
            className,
            variant = "ghost",
        },
        ref
    ) {
        const { trigger: triggerHaptic } = useHapticFeedback();

        // Track the transcript we've already sent to avoid duplicates
        const lastSentTranscriptRef = useRef("");

        // Define callbacks before passing to useVoiceInput (hooks can't be called inside other hooks)
        const handleTranscriptComplete = useCallback(
            (finalTranscript: string) => {
                onTranscriptComplete?.(finalTranscript);
                lastSentTranscriptRef.current = "";
            },
            [onTranscriptComplete]
        );

        const handleTranscriptUpdate = useCallback(
            (currentTranscript: string) => {
                // Only send the delta (new text since last update)
                // This prevents the full transcript from being re-sent on each update
                if (currentTranscript !== lastSentTranscriptRef.current) {
                    onTranscriptUpdate?.(currentTranscript);
                    lastSentTranscriptRef.current = currentTranscript;
                }
            },
            [onTranscriptUpdate]
        );

        const handleSessionStart = useCallback(() => {
            // Reset tracking ref when new session starts
            lastSentTranscriptRef.current = "";
            onSessionStart?.();
        }, [onSessionStart]);

        const {
            toggleListening,
            stopListening,
            isListening,
            isConnecting,
            isSupported,
            // transcript managed via onTranscriptUpdate callback
            transcript: _transcript,
            error,
        } = useVoiceInput({
            onTranscriptComplete: handleTranscriptComplete,
            onTranscriptUpdate: handleTranscriptUpdate,
            onSessionStart: handleSessionStart,
        });

        // Expose stop method via ref for parent to call (e.g., on form submit)
        useImperativeHandle(
            ref,
            () => ({
                stop: stopListening,
                isListening,
            }),
            [stopListening, isListening]
        );

        // Clear transcript ref when not listening
        useEffect(() => {
            if (!isListening) {
                lastSentTranscriptRef.current = "";
            }
        }, [isListening]);

        // Track recent click to suppress tooltip during state transitions
        const [justClicked, setJustClicked] = useState(false);
        const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        // Cleanup timeout on unmount
        useEffect(() => {
            return () => {
                if (clickTimeoutRef.current) {
                    clearTimeout(clickTimeoutRef.current);
                }
            };
        }, []);

        const handleClick = useCallback(async () => {
            triggerHaptic();

            // Suppress tooltip briefly to prevent it showing during state change
            setJustClicked(true);
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
            clickTimeoutRef.current = setTimeout(() => setJustClicked(false), 300);

            // toggleListening will call onTranscriptComplete when stopping
            // Hook clears transcript after completion
            await toggleListening();
        }, [toggleListening, triggerHaptic]);

        // Don't render if voice input is not supported
        if (!isSupported) {
            return null;
        }

        const isActive = isListening || isConnecting;
        const showError = error && !isActive;

        const tooltipContent = showError
            ? `Voice input error: ${error.message}`
            : isListening
              ? "Click to stop recording"
              : isConnecting
                ? "Click to cancel"
                : "Voice input";

        // Determine button style based on variant and state
        const buttonStyle =
            variant === "primary"
                ? "btn-cta" // Always filled for primary variant
                : isActive
                  ? "btn-cta"
                  : "btn-icon-glass";

        return (
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={cn(
                    "group relative flex shrink-0 items-center justify-center rounded-full",
                    variant === "primary" ? "h-11 w-11" : "h-10 w-10 sm:h-12 sm:w-12",
                    buttonStyle,
                    showError && "text-amber-500",
                    disabled && "pointer-events-none opacity-50",
                    className
                )}
                aria-label={
                    isListening
                        ? "Stop voice input"
                        : isConnecting
                          ? "Cancel connecting"
                          : "Start voice input"
                }
                data-testid="voice-input-button"
                data-tooltip-id={justClicked ? undefined : "tip"}
                data-tooltip-content={justClicked ? undefined : tooltipContent}
            >
                <AnimatePresence mode="wait">
                    {isConnecting ? (
                        <motion.div
                            key="connecting"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                        >
                            <Loader2 className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
                        </motion.div>
                    ) : isListening ? (
                        <motion.div
                            key="listening"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className="relative"
                        >
                            <Mic className="text-primary-foreground h-5 w-5 sm:h-6 sm:w-6" />
                            {/* Pulsing ring animation */}
                            <motion.div
                                className="border-primary-foreground/60 absolute inset-0 rounded-full border-2"
                                initial={{ scale: 1, opacity: 0.6 }}
                                animate={{ scale: 1.8, opacity: 0 }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                }}
                            />
                        </motion.div>
                    ) : showError ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                        >
                            <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                        >
                            <Mic
                                className={cn(
                                    "h-5 w-5 transition-colors sm:h-6 sm:w-6",
                                    variant === "primary"
                                        ? "text-primary-foreground"
                                        : "text-foreground/50 group-hover:text-foreground/80"
                                )}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
        );
    }
);
