/**
 * Deepgram Voice Provider
 *
 * Real-time streaming speech-to-text using Deepgram's WebSocket API.
 * Sub-300ms latency with interim results for responsive UX.
 */

import { logger } from "@/lib/client-logger";

import type {
    TranscriptResult,
    VoiceConnectionState,
    VoiceProvider,
    VoiceProviderCallbacks,
    VoiceProviderConfig,
} from "./types";

/** Deepgram WebSocket response types */
interface DeepgramWord {
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word?: string;
}

interface DeepgramAlternative {
    transcript: string;
    confidence: number;
    words: DeepgramWord[];
}

interface DeepgramChannel {
    alternatives: DeepgramAlternative[];
}

interface DeepgramResponse {
    type: "Results" | "Metadata" | "SpeechStarted" | "UtteranceEnd";
    channel_index?: [number, number];
    duration?: number;
    start?: number;
    is_final?: boolean;
    speech_final?: boolean;
    channel?: DeepgramChannel;
}

/** Audio recording configuration */
const AUDIO_CONFIG = {
    /** Audio chunk interval in milliseconds */
    timeslice: 100,
    /** Preferred MIME type for recording */
    mimeType: "audio/webm;codecs=opus",
    /** Fallback MIME types */
    fallbackMimeTypes: ["audio/webm", "audio/ogg;codecs=opus", "audio/mp4"],
} as const;

export class DeepgramProvider implements VoiceProvider {
    readonly name = "deepgram";

    private _state: VoiceConnectionState = "disconnected";
    private _isStreaming = false;

    private socket: WebSocket | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioStream: MediaStream | null = null;

    private readonly config: VoiceProviderConfig;
    private readonly callbacks: VoiceProviderCallbacks;
    private readonly tokenEndpoint: string;

    constructor(
        config: VoiceProviderConfig,
        callbacks: VoiceProviderCallbacks,
        tokenEndpoint: string = "/api/voice/token"
    ) {
        this.config = config;
        this.callbacks = callbacks;
        this.tokenEndpoint = tokenEndpoint;
    }

    get state(): VoiceConnectionState {
        return this._state;
    }

    get isStreaming(): boolean {
        return this._isStreaming;
    }

    private setState(state: VoiceConnectionState): void {
        this._state = state;
        this.callbacks.onConnectionChange?.(state);
    }

    async connect(): Promise<void> {
        if (this._state === "connected" || this._state === "connecting") {
            logger.warn({}, "Already connected or connecting");
            return;
        }

        this.setState("connecting");

        try {
            // Get temporary token from our API
            const tokenResponse = await fetch(this.tokenEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language: this.config.language }),
            });

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get voice token: ${tokenResponse.status}`);
            }

            const { url } = await tokenResponse.json();
            if (!url) {
                throw new Error("No WebSocket URL returned from token endpoint");
            }

            // Request microphone access with helpful error messages
            try {
                this.audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
            } catch (micError) {
                if (micError instanceof DOMException) {
                    if (micError.name === "NotAllowedError") {
                        throw new Error(
                            "Microphone permission denied. Please allow microphone access to use voice input."
                        );
                    }
                    if (micError.name === "NotFoundError") {
                        throw new Error(
                            "No microphone found. Please connect a microphone and try again."
                        );
                    }
                    if (micError.name === "NotReadableError") {
                        throw new Error(
                            "Microphone is in use by another application. Please close other apps using the mic."
                        );
                    }
                }
                throw micError;
            }

            // Connect to Deepgram WebSocket
            await this.connectWebSocket(url);

            // Start recording
            this.startRecording();

            this.setState("connected");
            logger.info({}, "Voice input connected");
        } catch (error) {
            this.setState("error");
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error({ error: err }, "Failed to connect voice input");
            this.callbacks.onError?.(err);
            this.cleanup();
            throw err;
        }
    }

    private connectWebSocket(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(url);

            const timeout = setTimeout(() => {
                reject(new Error("WebSocket connection timeout"));
                this.socket?.close();
            }, 10000);

            this.socket.onopen = () => {
                clearTimeout(timeout);
                logger.debug({}, "Deepgram WebSocket connected");
                resolve();
            };

            this.socket.onclose = (event) => {
                clearTimeout(timeout);
                logger.info(
                    { code: event.code, reason: event.reason },
                    "WebSocket closed"
                );
                if (this._state !== "disconnected") {
                    this.setState("disconnected");
                    this.cleanup();
                }
            };

            this.socket.onerror = (event) => {
                clearTimeout(timeout);
                const error = new Error("WebSocket error");
                logger.error({ event }, "WebSocket error");
                // Don't call onError here - let the catch block handle it to avoid duplicates
                reject(error);
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
        });
    }

    private handleMessage(data: string): void {
        try {
            const response: DeepgramResponse = JSON.parse(data);

            switch (response.type) {
                case "SpeechStarted":
                    this.callbacks.onSpeechStart?.();
                    break;

                case "Results":
                    this.handleTranscriptResult(response);
                    break;

                case "UtteranceEnd":
                    this.callbacks.onSpeechEnd?.();
                    break;

                case "Metadata":
                    // Connection metadata, can be logged for debugging
                    logger.debug({ metadata: response }, "Received metadata");
                    break;
            }
        } catch (error) {
            logger.error({ error, data }, "Failed to parse Deepgram message");
        }
    }

    private handleTranscriptResult(response: DeepgramResponse): void {
        const alternative = response.channel?.alternatives[0];
        if (!alternative) return;

        const transcript = alternative.transcript.trim();
        if (!transcript) return;

        const result: TranscriptResult = {
            text: transcript,
            isFinal: response.is_final ?? false,
            confidence: alternative.confidence,
            startTime: response.start,
            endTime:
                response.start !== undefined && response.duration !== undefined
                    ? response.start + response.duration
                    : undefined,
        };

        this.callbacks.onTranscript(result);
    }

    private startRecording(): void {
        if (!this.audioStream) {
            throw new Error("No audio stream available");
        }

        // Find supported MIME type
        const mimeType = this.getSupportedMimeType();
        logger.debug({ mimeType }, "Starting recording");

        this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType,
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(event.data);
            }
        };

        this.mediaRecorder.onerror = (event) => {
            logger.error({ event }, "MediaRecorder error");
            this.callbacks.onError?.(new Error("Recording error"));
        };

        this.mediaRecorder.start(AUDIO_CONFIG.timeslice);
        this._isStreaming = true;
    }

    private getSupportedMimeType(): string {
        if (MediaRecorder.isTypeSupported(AUDIO_CONFIG.mimeType)) {
            return AUDIO_CONFIG.mimeType;
        }

        for (const type of AUDIO_CONFIG.fallbackMimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        // Let browser choose
        return "";
    }

    disconnect(): void {
        logger.info({}, "Disconnecting voice input");
        this.cleanup();
        this.setState("disconnected");
    }

    pause(): void {
        if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.pause();
            this._isStreaming = false;
            logger.debug({}, "Voice input paused");
        }
    }

    resume(): void {
        if (this.mediaRecorder?.state === "paused") {
            this.mediaRecorder.resume();
            this._isStreaming = true;
            logger.debug({}, "Voice input resumed");
        }
    }

    private cleanup(): void {
        // Stop and close MediaRecorder
        if (this.mediaRecorder) {
            if (this.mediaRecorder.state !== "inactive") {
                this.mediaRecorder.stop();
            }
            this.mediaRecorder = null;
        }

        // Stop all audio tracks
        if (this.audioStream) {
            this.audioStream.getTracks().forEach((track) => track.stop());
            this.audioStream = null;
        }

        // Close WebSocket
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.close(1000, "Client disconnect");
            }
            this.socket = null;
        }

        this._isStreaming = false;
    }
}

/** Factory function for creating Deepgram provider */
export function createDeepgramProvider(
    config: VoiceProviderConfig,
    callbacks: VoiceProviderCallbacks,
    tokenEndpoint?: string
): DeepgramProvider {
    return new DeepgramProvider(config, callbacks, tokenEndpoint);
}
