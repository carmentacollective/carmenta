/**
 * Transient Message Types
 *
 * Transient messages are ephemeral status updates sent during streaming that:
 * - Show progress in real-time (e.g., "Searching 3 sources...")
 * - Don't pollute the message history (they're not persisted)
 * - Auto-reconcile when updated with the same ID
 *
 * This enables rich feedback during long-running operations without
 * cluttering the conversation.
 */

/**
 * Where the transient message should be displayed.
 *
 * - chat: Inline within the message stream (below concierge, above response)
 * - oracle: In the Oracle message center (Carmenta's notifications)
 * - toast: As a toast notification (for important alerts)
 */
export type TransientDestination = "chat" | "oracle" | "toast";

/**
 * The semantic type of transient message.
 *
 * - status: Progress status (e.g., "Searching...", "Reading 5 pages...")
 * - thinking: Extended reasoning indicator (e.g., "Deep thinking...")
 * - notification: Carmenta notification (wisdom, tips, encouragement)
 * - progress: Operation with percentage (e.g., "Uploading 45%...")
 * - celebration: Success celebration (e.g., "Found what we needed!")
 */
export type TransientType =
    | "status"
    | "thinking"
    | "notification"
    | "progress"
    | "celebration";

/**
 * A transient message payload.
 */
export interface TransientMessage {
    /** Unique ID for reconciliation - same ID updates existing message */
    id: string;
    /** Semantic type of the message */
    type: TransientType;
    /** Where to display the message */
    destination: TransientDestination;
    /** The message text */
    text: string;
    /** Optional emoji/icon for visual context */
    icon?: string;
    /** Progress percentage (0-100) for progress type */
    progress?: number;
    /** Optional metadata for rich rendering */
    metadata?: Record<string, unknown>;
}

/**
 * Wire format for transient data parts sent over the stream.
 * Uses `data-transient` type to match AI SDK's data-* pattern.
 * The `transient: true` flag tells AI SDK not to persist this.
 */
export interface TransientDataPart {
    type: "data-transient";
    id: string;
    data: TransientMessage;
    transient: true;
}

/**
 * Type guard for transient data parts.
 */
export function isTransientDataPart(part: unknown): part is TransientDataPart {
    return (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part as { type: unknown }).type === "data-transient" &&
        "transient" in part &&
        (part as { transient: unknown }).transient === true
    );
}

/**
 * Predefined status messages for common operations.
 * Using "we" language throughout per Carmenta's voice.
 */
export const STATUS_MESSAGES = {
    // Web search
    webSearch: {
        starting: "Searching the web...",
        reading: (count: number) =>
            `Reading ${count} source${count === 1 ? "" : "s"}...`,
        analyzing: "Analyzing what we found...",
    },
    // Deep research
    deepResearch: {
        starting: "Beginning deep research...",
        searching: (query: string) => `Researching: ${query}`,
        reading: (count: number) => `Reading ${count} page${count === 1 ? "" : "s"}...`,
        synthesizing: "Synthesizing findings...",
    },
    // Knowledge base
    knowledgeBase: {
        searching: "Searching our knowledge...",
        found: (count: number) =>
            `Found ${count} relevant item${count === 1 ? "" : "s"}`,
    },
    // MCP integrations
    integration: {
        connecting: (service: string) => `Connecting to ${service}...`,
        fetching: (service: string) => `Fetching from ${service}...`,
        processing: "Processing results...",
    },
    // Reasoning
    reasoning: {
        thinking: "Thinking deeply...",
        considering: "Considering approaches...",
        analyzing: "Analyzing the problem...",
    },
} as const;
