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
    /** Called when a new recording session starts (useful for clearing UI state) */
    onSessionStart?: () => void;
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
        onSessionStart,
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
    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const keepaliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isCancelledRef = useRef(false); // Track if connection was cancelled

    // Connection timeout duration (10 seconds)
    const CONNECTION_TIMEOUT_MS = 10000;
    // Keepalive interval (8 seconds - Deepgram recommends < 12s to prevent timeout)
    const KEEPALIVE_INTERVAL_MS = 8000;

    // Store callbacks in refs to avoid stale closures
    const onTranscriptCompleteRef = useRef(onTranscriptComplete);
    const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
    const onSessionStartRef = useRef(onSessionStart);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onTranscriptCompleteRef.current = onTranscriptComplete;
        onTranscriptUpdateRef.current = onTranscriptUpdate;
        onSessionStartRef.current = onSessionStart;
        onErrorRef.current = onError;
    }, [onTranscriptComplete, onTranscriptUpdate, onSessionStart, onError]);

    const handleError = useCallback((err: Error) => {
        setError(err);
        setConnectionState("error");
        onErrorRef.current?.(err);
        logger.error({ error: err }, "Voice input error");
    }, []);

    const stopListening = useCallback(() => {
        // Mark as cancelled to prevent race with Open event handler
        isCancelledRef.current = true;

        // Clear connection timeout
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        // Clear keepalive interval
        if (keepaliveIntervalRef.current) {
            clearInterval(keepaliveIntervalRef.current);
            keepaliveIntervalRef.current = null;
        }

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

        // Deliver combined transcript including any pending interim text
        // This ensures partial speech isn't lost if user stops mid-utterance
        const finalText = finalTranscriptRef.current;
        const interimText = interimTranscriptRef.current;
        const combinedTranscript =
            finalText + (interimText ? (finalText ? " " : "") + interimText : "");

        if (combinedTranscript) {
            onTranscriptCompleteRef.current?.(combinedTranscript);
        }

        // Clear refs after delivery to prevent duplicate callbacks on Close event
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

        // Reset cancelled flag for new session
        isCancelledRef.current = false;

        // Clear refs at the start of a new session
        // This ensures fresh transcription without lingering text from previous sessions
        finalTranscriptRef.current = "";
        interimTranscriptRef.current = "";
        setTranscript("");

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

            // Set connection timeout - if connection doesn't open in time, give up
            connectionTimeoutRef.current = setTimeout(() => {
                logger.warn({}, "Voice connection timed out");
                handleError(
                    new Error("Connection timed out. Check your network and try again.")
                );
                stopListening();
            }, CONNECTION_TIMEOUT_MS);

            // Handle connection open
            connection.on(LiveTranscriptionEvents.Open, () => {
                // Check if connection was cancelled before this event fired (race condition)
                if (isCancelledRef.current) {
                    logger.debug({}, "Connection opened but was cancelled, ignoring");
                    return;
                }

                // Clear the connection timeout - we connected successfully
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }

                logger.debug({}, "Deepgram connection opened");
                setConnectionState("connected");

                // Notify parent now that connection is actually established
                // This ensures parent only clears input after successful setup
                onSessionStartRef.current?.();

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

                // Start keepalive interval to prevent connection timeout on long recordings
                keepaliveIntervalRef.current = setInterval(() => {
                    if (connectionRef.current?.getReadyState() === 1) {
                        connectionRef.current.keepAlive();
                        logger.debug({}, "Sent keepalive");
                    }
                }, KEEPALIVE_INTERVAL_MS);

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
        if (connectionState === "connected" || connectionState === "connecting") {
            // Allow stopping during connecting state (user changed their mind)
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
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
            }
            if (keepaliveIntervalRef.current) {
                clearInterval(keepaliveIntervalRef.current);
            }
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
