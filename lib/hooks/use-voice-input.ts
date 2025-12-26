"use client";

/**
 * useVoiceInput Hook
 *
 * React hook for real-time voice input with streaming transcription.
 * Manages microphone access, provider lifecycle, and transcript accumulation.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { logger } from "@/lib/client-logger";
import {
    createDeepgramProvider,
    type TranscriptResult,
    type VoiceConnectionState,
    type VoiceProvider,
    type VoiceProviderConfig,
} from "@/lib/voice";

export interface UseVoiceInputOptions {
    /** Language code for transcription (default: 'en') */
    language?: string;
    /** Called when transcription is complete (final result received) */
    onTranscriptComplete?: (transcript: string) => void;
    /** Called on each transcript update (interim and final) */
    onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
    /** Called when an error occurs */
    onError?: (error: Error) => void;
}

export interface UseVoiceInputResult {
    /** Start listening for voice input */
    startListening: () => Promise<void>;
    /** Stop listening and get final transcript */
    stopListening: () => void;
    /** Toggle listening state */
    toggleListening: () => Promise<void>;
    /** Current accumulated transcript (interim + final) */
    transcript: string;
    /** Clear the current transcript */
    clearTranscript: () => void;
    /** Whether currently listening for voice input */
    isListening: boolean;
    /** Whether currently connecting to the service */
    isConnecting: boolean;
    /** Whether voice input is available (browser supports it) */
    isSupported: boolean;
    /** Current connection state */
    connectionState: VoiceConnectionState;
    /** Current error, if any */
    error: Error | null;
}

/**
 * Check if the browser supports voice input
 */
function checkVoiceSupport(): boolean {
    if (typeof window === "undefined") return false;

    return !!(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        window.MediaRecorder &&
        window.WebSocket
    );
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
    const {
        language = "en",
        onTranscriptComplete,
        onTranscriptUpdate,
        onError,
    } = options;

    const [transcript, setTranscript] = useState("");
    const [connectionState, setConnectionState] =
        useState<VoiceConnectionState>("disconnected");
    const [error, setError] = useState<Error | null>(null);
    const [isSupported] = useState(() => checkVoiceSupport());

    // Use refs to avoid recreating provider on every render
    const providerRef = useRef<VoiceProvider | null>(null);
    const finalTranscriptRef = useRef("");
    const interimTranscriptRef = useRef("");

    // Memoized callbacks for provider
    const handleTranscript = useCallback(
        (result: TranscriptResult) => {
            if (result.isFinal) {
                // Append final result to accumulated transcript
                finalTranscriptRef.current +=
                    (finalTranscriptRef.current ? " " : "") + result.text;
                interimTranscriptRef.current = "";
            } else {
                // Update interim result
                interimTranscriptRef.current = result.text;
            }

            // Combine final + interim for display
            const combined =
                finalTranscriptRef.current +
                (interimTranscriptRef.current
                    ? " " + interimTranscriptRef.current
                    : "");

            setTranscript(combined);
            onTranscriptUpdate?.(combined, result.isFinal);

            if (result.isFinal) {
                logger.debug(
                    { text: result.text, confidence: result.confidence },
                    "Final transcript received"
                );
            }
        },
        [onTranscriptUpdate]
    );

    const handleConnectionChange = useCallback((state: VoiceConnectionState) => {
        setConnectionState(state);
        logger.debug({ state }, "Voice connection state changed");
    }, []);

    const handleError = useCallback(
        (err: Error) => {
            setError(err);
            onError?.(err);
        },
        [onError]
    );

    // Create provider instance
    const getOrCreateProvider = useCallback(() => {
        if (!providerRef.current) {
            const config: VoiceProviderConfig = {
                language,
                interimResults: true,
                punctuate: true,
                smartFormat: true,
            };

            providerRef.current = createDeepgramProvider(config, {
                onTranscript: handleTranscript,
                onConnectionChange: handleConnectionChange,
                onError: handleError,
                onSpeechStart: () => logger.debug({}, "Speech started"),
                onSpeechEnd: () => logger.debug({}, "Speech ended"),
            });
        }

        return providerRef.current;
    }, [language, handleTranscript, handleConnectionChange, handleError]);

    const startListening = useCallback(async () => {
        if (!isSupported) {
            const err = new Error("Voice input is not supported in this browser");
            handleError(err);
            return;
        }

        setError(null);

        try {
            const provider = getOrCreateProvider();
            await provider.connect();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            handleError(error);
        }
    }, [isSupported, getOrCreateProvider, handleError]);

    const stopListening = useCallback(() => {
        const provider = providerRef.current;
        if (provider) {
            provider.disconnect();

            // Deliver final transcript
            if (finalTranscriptRef.current) {
                onTranscriptComplete?.(finalTranscriptRef.current);
            }
        }
    }, [onTranscriptComplete]);

    const toggleListening = useCallback(async () => {
        if (connectionState === "connected") {
            stopListening();
        } else if (connectionState === "disconnected" || connectionState === "error") {
            await startListening();
        }
    }, [connectionState, startListening, stopListening]);

    const clearTranscript = useCallback(() => {
        setTranscript("");
        finalTranscriptRef.current = "";
        interimTranscriptRef.current = "";
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            providerRef.current?.disconnect();
            providerRef.current = null;
        };
    }, []);

    // Recreate provider when language changes
    useEffect(() => {
        // If provider exists and language changed, disconnect old provider
        if (providerRef.current) {
            providerRef.current.disconnect();
            providerRef.current = null;
        }
    }, [language]);

    return {
        startListening,
        stopListening,
        toggleListening,
        transcript,
        clearTranscript,
        isListening: connectionState === "connected",
        isConnecting: connectionState === "connecting",
        isSupported,
        connectionState,
        error,
    };
}
