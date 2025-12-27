"use client";

/**
 * useVoiceInput Hook
 *
 * React hook for real-time voice input with streaming transcription.
 * Uses the official @deepgram/sdk for browser-based speech-to-text.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { LiveClient, LiveTranscriptionEvent } from "@deepgram/sdk";

import { logger } from "@/lib/client-logger";

export type VoiceConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";

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

    // Refs to manage connection and recording state
    const connectionRef = useRef<LiveClient | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const finalTranscriptRef = useRef("");
    const interimTranscriptRef = useRef("");

    // Store callbacks in refs to avoid stale closures
    const onTranscriptCompleteRef = useRef(onTranscriptComplete);
    const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onTranscriptCompleteRef.current = onTranscriptComplete;
        onTranscriptUpdateRef.current = onTranscriptUpdate;
        onErrorRef.current = onError;
    }, [onTranscriptComplete, onTranscriptUpdate, onError]);

    const handleError = useCallback((err: Error) => {
        setError(err);
        setConnectionState("error");
        onErrorRef.current?.(err);
        logger.error({ error: err }, "Voice input error");
    }, []);

    const stopListening = useCallback(() => {
        // Stop media recorder
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;

        // Stop all audio tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        // Close Deepgram connection
        if (connectionRef.current) {
            connectionRef.current.finish();
            connectionRef.current = null;
        }

        // Deliver final transcript before clearing
        if (finalTranscriptRef.current) {
            onTranscriptCompleteRef.current?.(finalTranscriptRef.current);
        }

        // Clear transcript refs for next session
        finalTranscriptRef.current = "";
        interimTranscriptRef.current = "";

        setConnectionState("disconnected");
        logger.debug({}, "Voice input stopped");
    }, []);

    const startListening = useCallback(async () => {
        if (!isSupported) {
            handleError(new Error("Voice input is not supported in this browser"));
            return;
        }

        // Get API key from environment
        const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
        if (!apiKey) {
            handleError(
                new Error(
                    "Deepgram API key not configured. Set NEXT_PUBLIC_DEEPGRAM_API_KEY."
                )
            );
            return;
        }

        // Check microphone permission state first
        try {
            const permissionStatus = await navigator.permissions.query({
                name: "microphone" as PermissionName,
            });

            if (permissionStatus.state === "denied") {
                handleError(
                    new Error(
                        "Microphone access is blocked. Click the lock icon in your browser's address bar, find 'Microphone', and change it to 'Allow'. Then refresh the page."
                    )
                );
                return;
            }
        } catch {
            // Permissions API not supported, continue with getUserMedia
            logger.debug(
                {},
                "Permissions API not available, trying getUserMedia directly"
            );
        }

        setError(null);
        setConnectionState("connecting");

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });
            mediaStreamRef.current = stream;

            // Create Deepgram client and connection
            const deepgram = createClient(apiKey);
            const connection = deepgram.listen.live({
                model: "nova-3",
                language,
                smart_format: true,
                punctuate: true,
                interim_results: true,
                utterance_end_ms: 1000,
                vad_events: true,
            });

            connectionRef.current = connection;

            // Handle connection open
            connection.on(LiveTranscriptionEvents.Open, () => {
                logger.debug({}, "Deepgram connection opened");
                setConnectionState("connected");

                // Start recording and sending audio
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                        ? "audio/webm;codecs=opus"
                        : "audio/webm",
                });

                mediaRecorder.ondataavailable = (event) => {
                    if (
                        event.data.size > 0 &&
                        connectionRef.current?.getReadyState() === 1
                    ) {
                        connectionRef.current.send(event.data);
                    }
                };

                mediaRecorder.start(250); // Send audio every 250ms
                mediaRecorderRef.current = mediaRecorder;

                logger.debug({}, "MediaRecorder started");
            });

            // Handle transcription results
            connection.on(
                LiveTranscriptionEvents.Transcript,
                (data: LiveTranscriptionEvent) => {
                    const text = data.channel?.alternatives?.[0]?.transcript || "";
                    if (!text) return;

                    const isFinal = data.is_final ?? false;

                    if (isFinal) {
                        // Append to final transcript
                        finalTranscriptRef.current +=
                            (finalTranscriptRef.current ? " " : "") + text;
                        interimTranscriptRef.current = "";

                        logger.debug(
                            {
                                text,
                                confidence: data.channel?.alternatives?.[0]?.confidence,
                            },
                            "Final transcript"
                        );
                    } else {
                        // Update interim transcript
                        interimTranscriptRef.current = text;
                    }

                    // Combine for display (add space only if final transcript exists)
                    const combined =
                        finalTranscriptRef.current +
                        (interimTranscriptRef.current
                            ? (finalTranscriptRef.current ? " " : "") +
                              interimTranscriptRef.current
                            : "");

                    setTranscript(combined);
                    onTranscriptUpdateRef.current?.(combined, isFinal);
                }
            );

            // Handle connection close
            connection.on(LiveTranscriptionEvents.Close, () => {
                logger.debug({}, "Deepgram connection closed");
                // stopListening is idempotent, safe to call unconditionally
                stopListening();
            });

            // Handle errors
            connection.on(LiveTranscriptionEvents.Error, (err) => {
                handleError(err instanceof Error ? err : new Error(String(err)));
                stopListening();
            });
        } catch (err) {
            const error =
                err instanceof Error ? err : new Error("Failed to start voice input");

            // Provide helpful error messages - be direct about what action is needed
            if (error.name === "NotAllowedError") {
                handleError(
                    new Error(
                        "Microphone access denied. Allow microphone access in your browser settings to continue."
                    )
                );
            } else if (error.name === "NotFoundError") {
                handleError(
                    new Error("No microphone found. Connect a microphone to use voice.")
                );
            } else {
                handleError(error);
            }

            stopListening();
        }
    }, [isSupported, language, handleError, stopListening, connectionState]);

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
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            connectionRef.current?.finish();
        };
    }, []);

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
