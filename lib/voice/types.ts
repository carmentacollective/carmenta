/**
 * Voice Input Provider Types
 *
 * Abstraction layer for speech-to-text providers (Deepgram, OpenAI Whisper, Gladia, etc.)
 * Designed for real-time streaming transcription with interim results.
 */

/** Transcription result from the provider */
export interface TranscriptResult {
    /** The transcribed text */
    text: string;
    /** Whether this is a final result (utterance complete) or interim (still speaking) */
    isFinal: boolean;
    /** Confidence score from 0-1, if available */
    confidence?: number;
    /** Timestamp when the speech started, if available */
    startTime?: number;
    /** Timestamp when the speech ended, if available */
    endTime?: number;
}

/** Connection state for the voice provider */
export type VoiceConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";

/** Provider configuration */
export interface VoiceProviderConfig {
    /** Language code for transcription (e.g., 'en-US', 'es', 'fr') */
    language?: string;
    /** Enable interim/partial results during speech */
    interimResults?: boolean;
    /** Enable automatic punctuation */
    punctuate?: boolean;
    /** Enable smart formatting (numbers, dates, etc.) */
    smartFormat?: boolean;
    /** Custom vocabulary words */
    keywords?: string[];
}

/** Callbacks for voice provider events */
export interface VoiceProviderCallbacks {
    /** Called when a transcript is received (interim or final) */
    onTranscript: (result: TranscriptResult) => void;
    /** Called when connection state changes */
    onConnectionChange?: (state: VoiceConnectionState) => void;
    /** Called when speech starts (voice activity detected) */
    onSpeechStart?: () => void;
    /** Called when speech ends (silence detected) */
    onSpeechEnd?: () => void;
    /** Called on error */
    onError?: (error: Error) => void;
}

/** Voice input provider interface */
export interface VoiceProvider {
    /** Provider name for logging/debugging */
    readonly name: string;

    /** Current connection state */
    readonly state: VoiceConnectionState;

    /**
     * Connect to the transcription service and start streaming audio.
     * Requests microphone permission if not already granted.
     */
    connect(): Promise<void>;

    /**
     * Disconnect from the service and stop streaming.
     * Releases microphone access.
     */
    disconnect(): void;

    /**
     * Pause audio streaming without disconnecting.
     * Useful for muting during tool execution.
     */
    pause(): void;

    /**
     * Resume audio streaming after pause.
     */
    resume(): void;

    /** Whether the provider is currently streaming audio */
    readonly isStreaming: boolean;
}

/** Factory function type for creating providers */
export type VoiceProviderFactory = (
    config: VoiceProviderConfig,
    callbacks: VoiceProviderCallbacks
) => VoiceProvider;
