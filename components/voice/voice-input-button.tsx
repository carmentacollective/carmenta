"use client";

/**
 * Voice Input Button
 *
 * Microphone button for real-time voice transcription.
 * Shows recording state with visual feedback, streams transcript
 * directly into the chat input.
 */

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { useHapticFeedback } from "@/lib/hooks/use-haptic-feedback";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceInputButtonProps {
    /** Callback when transcript is updated (real-time) */
    onTranscriptUpdate?: (transcript: string) => void;
    /** Callback when recording stops with final transcript */
    onTranscriptComplete?: (transcript: string) => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Additional class names */
    className?: string;
}

export function VoiceInputButton({
    onTranscriptUpdate,
    onTranscriptComplete,
    disabled = false,
    className,
}: VoiceInputButtonProps) {
    const { trigger: triggerHaptic } = useHapticFeedback();

    // Track the transcript we've already sent to avoid duplicates
    const lastSentTranscriptRef = useRef("");

    const {
        toggleListening,
        isListening,
        isConnecting,
        isSupported,
        // transcript managed via onTranscriptUpdate callback
        transcript: _transcript,
        error,
    } = useVoiceInput({
        onTranscriptComplete: useCallback(
            (finalTranscript: string) => {
                onTranscriptComplete?.(finalTranscript);
                lastSentTranscriptRef.current = "";
            },
            [onTranscriptComplete]
        ),
        onTranscriptUpdate: useCallback(
            (currentTranscript: string) => {
                // Only send the delta (new text since last update)
                // This prevents the full transcript from being re-sent on each update
                if (currentTranscript !== lastSentTranscriptRef.current) {
                    onTranscriptUpdate?.(currentTranscript);
                    lastSentTranscriptRef.current = currentTranscript;
                }
            },
            [onTranscriptUpdate]
        ),
    });

    // Clear transcript ref when not listening
    useEffect(() => {
        if (!isListening) {
            lastSentTranscriptRef.current = "";
        }
    }, [isListening]);

    const handleClick = useCallback(async () => {
        triggerHaptic();

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

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={disabled || isConnecting}
                    className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-full transition-all",
                        "text-foreground/40 hover:bg-foreground/5 hover:text-foreground/60",
                        isActive &&
                            "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-500",
                        showError && "text-amber-500",
                        disabled && "pointer-events-none opacity-50",
                        className
                    )}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    data-testid="voice-input-button"
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
                                <Loader2 className="h-4 w-4 animate-spin" />
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
                                <Mic className="h-4 w-4" />
                                {/* Pulsing ring animation */}
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-red-500"
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
                                <MicOff className="h-4 w-4" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="idle"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                            >
                                <Mic className="h-4 w-4" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </button>
            </TooltipTrigger>
            <TooltipContent className="z-tooltip">
                {showError
                    ? `Voice input error: ${error.message}`
                    : isListening
                      ? "Click to stop recording"
                      : isConnecting
                        ? "Connecting..."
                        : "Voice input"}
            </TooltipContent>
        </Tooltip>
    );
}
