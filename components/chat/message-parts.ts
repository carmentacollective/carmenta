/**
 * Message Part Utilities
 *
 * Shared helpers for extracting content from UIMessage objects.
 * Used by both regular chat (HoloThread) and Carmenta assistant interfaces.
 */

import type { UIMessage, DataPart } from "ai";

/**
 * Tool state from AI SDK
 *
 * - input-streaming: Arguments being streamed (in progress)
 * - input-available: Tool has input, waiting to execute
 * - output-available: Tool completed successfully
 * - output-error: Tool failed with error
 */
export interface ToolPart {
    type: `tool-${string}`;
    toolCallId: string;
    state: "input-streaming" | "input-available" | "output-available" | "output-error";
    input: unknown;
    output?: unknown;
    /** Error text for output-error state (AI SDK pattern) */
    errorText?: string;
}

/**
 * File attachment part from message
 */
export interface FilePart {
    type: "file";
    mimeType: string;
    data: string;
    filename?: string;
}

/**
 * Data part for generative UI and transient status
 */
export interface DataPartInfo {
    type: "data";
    data: unknown;
}

/**
 * Type guard for tool parts
 */
export function isToolPart(part: unknown): part is ToolPart {
    return (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        typeof (part as ToolPart).type === "string" &&
        (part as ToolPart).type.startsWith("tool-") &&
        "toolCallId" in part &&
        "state" in part &&
        "input" in part
    );
}

/**
 * Type guard for file parts
 */
export function isFilePart(part: unknown): part is FilePart {
    return (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part as FilePart).type === "file" &&
        "mimeType" in part &&
        "data" in part
    );
}

/**
 * Type guard for data parts
 */
export function isDataPart(part: unknown): part is DataPartInfo {
    return (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part as DataPartInfo).type === "data" &&
        "data" in part
    );
}

/**
 * Extract plain text content from a message
 */
export function getMessageContent(message: UIMessage): string {
    if (!message.parts) return "";
    const textParts = message.parts
        .filter(
            (part): part is { type: "text"; text: string } =>
                part.type === "text" && typeof part.text === "string"
        )
        .map((part) => part.text);

    return textParts.join("");
}

/**
 * Extract reasoning/thinking content from a message
 */
export function getReasoningContent(message: UIMessage): string | null {
    if (!message.parts) return null;
    const reasoningParts = message.parts
        .filter(
            (part): part is { type: "reasoning"; text: string } =>
                part.type === "reasoning" && typeof part.text === "string"
        )
        .map((part) => part.text);

    return reasoningParts.length > 0 ? reasoningParts.join("\n") : null;
}

/**
 * Extract tool parts from a message
 */
export function getToolParts(message: UIMessage): ToolPart[] {
    if (!message.parts) return [];
    return message.parts.filter(isToolPart);
}

/**
 * Extract file parts from a message
 */
export function getFileParts(message: UIMessage): FilePart[] {
    if (!message.parts) return [];
    return message.parts.filter(isFilePart);
}

/**
 * Extract data parts from a message (for generative UI)
 *
 * Handles both generic "data" type and specific "data-*" types
 * (e.g., data-askUserInput, data-showReferences) emitted by streaming API
 */
export function getDataParts(message: UIMessage): DataPart[] {
    if (!message.parts) return [];
    return message.parts.filter(
        (part): part is DataPart =>
            part.type === "data" ||
            (typeof part.type === "string" && part.type.startsWith("data-"))
    ) as DataPart[];
}

/**
 * Get display name from tool type
 * tool-webSearch -> webSearch
 */
export function getToolName(type: string): string {
    return type.replace(/^tool-/, "");
}

/**
 * Simplified tool status for UI rendering
 */
export type ToolStatus = "pending" | "running" | "completed" | "error";

/**
 * Map tool state to simplified status
 */
export function getToolStatus(state: ToolPart["state"]): ToolStatus {
    switch (state) {
        case "input-streaming":
        case "input-available":
            return "running";
        case "output-available":
            return "completed";
        case "output-error":
            return "error";
        default:
            return "running";
    }
}

/**
 * Extract error message from tool part.
 *
 * Checks error patterns:
 * 1. AI SDK pattern: errorText field on the part itself
 * 2. SubagentResult pattern: success=false with error.message
 * 3. Simple error pattern: error as string (ai-chatbot pattern)
 */
export function getToolError(
    part: ToolPart,
    output: Record<string, unknown> | undefined,
    fallbackMessage = "Operation failed"
): string | undefined {
    // AI SDK pattern: errorText field on the part itself
    if (part.errorText) return part.errorText;

    if (!output) return undefined;

    // SubagentResult pattern: { success: false, error: { message: "..." } }
    if ("success" in output && output.success === false) {
        const error = output.error as { message?: string } | undefined;
        return error?.message ?? fallbackMessage;
    }

    // Simple error pattern: { error: "message string" } (ai-chatbot pattern)
    if ("error" in output && typeof output.error === "string") {
        return output.error;
    }

    return undefined;
}
