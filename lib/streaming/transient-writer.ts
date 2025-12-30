/**
 * Server-Side Transient Message Writer
 *
 * Utilities for emitting transient status updates during streaming.
 * These messages appear in real-time on the client but aren't persisted
 * to message history.
 */

import type { UIMessageStreamWriter } from "ai";
import type { TransientDestination, TransientMessage, TransientType } from "./types";

/**
 * Options for writing a transient message.
 */
interface TransientOptions {
    /** Unique ID for reconciliation */
    id: string;
    /** The message text */
    text: string;
    /** Semantic type (defaults to "status") */
    type?: TransientType;
    /** Display destination (defaults to "chat") */
    destination?: TransientDestination;
    /** Optional emoji/icon */
    icon?: string;
    /** Progress percentage for progress type */
    progress?: number;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Write a transient message to the stream.
 *
 * Uses the AI SDK's data part format with `data-transient` type.
 * The `transient: true` flag ensures it's not persisted to message history.
 *
 * @example
 * ```ts
 * writeTransient(writer, {
 *   id: 'search-status',
 *   text: 'Searching 3 sources...',
 *   icon: '🔍',
 * });
 * ```
 */
export function writeTransient(
    writer: UIMessageStreamWriter,
    options: TransientOptions
): void {
    const message: TransientMessage = {
        id: options.id,
        type: options.type ?? "status",
        destination: options.destination ?? "chat",
        text: options.text,
        ...(options.icon && { icon: options.icon }),
        ...(options.progress !== undefined && { progress: options.progress }),
        ...(options.metadata && { metadata: options.metadata }),
    };

    // Use data-transient type (data-* pattern is allowed by AI SDK)
    writer.write({
        type: "data-transient",
        id: options.id,
        data: message,
        transient: true,
    });
}

/**
 * Write a status message to the chat stream.
 * Convenience wrapper for the most common use case.
 */
export function writeStatus(
    writer: UIMessageStreamWriter,
    id: string,
    text: string,
    icon?: string
): void {
    writeTransient(writer, { id, text, icon, type: "status", destination: "chat" });
}

/**
 * Write a thinking indicator to the chat stream.
 */
export function writeThinking(
    writer: UIMessageStreamWriter,
    id: string,
    text: string
): void {
    writeTransient(writer, {
        id,
        text,
        icon: "🧠",
        type: "thinking",
        destination: "chat",
    });
}

/**
 * Write an Oracle whisper - a notification from Carmenta herself.
 * These appear in the Oracle message center, not inline.
 */
export function writeOracleWhisper(
    writer: UIMessageStreamWriter,
    id: string,
    text: string,
    icon?: string
): void {
    writeTransient(writer, {
        id,
        text,
        icon: icon ?? "✨",
        type: "notification",
        destination: "oracle",
    });
}

/**
 * Write a progress update with percentage.
 */
export function writeProgress(
    writer: UIMessageStreamWriter,
    id: string,
    text: string,
    progress: number,
    icon?: string
): void {
    writeTransient(writer, {
        id,
        text,
        icon,
        type: "progress",
        progress: Math.min(100, Math.max(0, progress)),
        destination: "chat",
    });
}

/**
 * Write a celebration message.
 */
export function writeCelebration(
    writer: UIMessageStreamWriter,
    id: string,
    text: string
): void {
    writeTransient(writer, {
        id,
        text,
        icon: "🎉",
        type: "celebration",
        destination: "chat",
    });
}

/**
 * Clear a transient message by writing an empty update.
 * The client should remove messages with empty text.
 */
export function clearTransient(writer: UIMessageStreamWriter, id: string): void {
    writeTransient(writer, { id, text: "", type: "status", destination: "chat" });
}

/**
 * Write a title update event.
 * Used when a title is generated async (e.g., code mode).
 * The client should update the document title and URL slug.
 */
export function writeTitleUpdate(
    writer: UIMessageStreamWriter,
    title: string,
    slug: string,
    connectionId: string
): void {
    writeTransient(writer, {
        id: "title-update",
        text: title,
        type: "title-update",
        destination: "chat",
        metadata: {
            title,
            slug,
            connectionId,
        },
    });
}

/**
 * Helper to create a scoped transient writer for a specific operation.
 * Useful for tool implementations.
 *
 * @example
 * ```ts
 * const status = createScopedWriter(writer, 'web-search');
 * status.update('Searching...');
 * status.update('Reading 3 sources...');
 * status.clear();
 * ```
 */
export function createScopedWriter(writer: UIMessageStreamWriter, scope: string) {
    const id = `${scope}-${Date.now()}`;

    return {
        id,
        update: (text: string, icon?: string) => writeStatus(writer, id, text, icon),
        thinking: (text: string) => writeThinking(writer, id, text),
        progress: (text: string, progress: number, icon?: string) =>
            writeProgress(writer, id, text, progress, icon),
        celebrate: (text: string) => writeCelebration(writer, id, text),
        clear: () => clearTransient(writer, id),
    };
}
