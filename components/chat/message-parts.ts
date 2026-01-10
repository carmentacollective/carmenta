/**
 * Message Part Utilities
 *
 * Shared utilities for extracting and working with UIMessage parts.
 * Used by both HoloThread and SidecarThread for consistent message parsing.
 */

import type { UIMessage } from "@ai-sdk/react";
import type { ToolStatus } from "@/lib/tools/tool-config";

/**
 * Shape of a tool part stored in messages.
 * The API stores these with type: "tool-{toolName}" pattern.
 *
 * States (per Vercel AI SDK):
 * - input-streaming: Tool is receiving input
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
 * File part type from AI SDK
 */
export interface FilePart {
    type: "file";
    url: string;
    mediaType: string;
    name?: string;
}

/**
 * Data part type for generative UI data (e.g., data-askUserInput)
 * These are streamed by the server using createUIMessageStream's data format.
 */
export interface DataPart {
    type: `data-${string}`;
    id?: string;
    data: Record<string, unknown>;
}

/**
 * Extract text content from UIMessage parts
 * Defensive checks handle malformed messages gracefully
 */
export function getMessageContent(message: UIMessage): string {
    if (!message?.parts) return "";
    return message.parts
        .filter((part) => part?.type === "text")
        .map((part) => {
            const textPart = part as { type: "text"; text?: string };
            return textPart?.text ?? "";
        })
        .join("");
}

/**
 * Extract reasoning content from UIMessage parts
 * Defensive checks handle malformed messages gracefully
 */
export function getReasoningContent(message: UIMessage): string | null {
    if (!message?.parts) return null;
    const reasoningPart = message.parts.find((part) => part?.type === "reasoning");
    if (reasoningPart && reasoningPart.type === "reasoning") {
        const typedPart = reasoningPart as { type: "reasoning"; text?: string };
        return typedPart?.text ?? null;
    }
    return null;
}

/**
 * Type guard for tool parts
 */
export function isToolPart(part: unknown): part is ToolPart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        typeof (part as { type: unknown }).type === "string" &&
        (part as { type: string }).type.startsWith("tool-") &&
        "toolCallId" in part &&
        "state" in part &&
        "input" in part
    );
}

/**
 * Extract tool parts from UIMessage
 * Tool parts have type starting with "tool-" (e.g., "tool-getWeather")
 */
export function getToolParts(message: UIMessage): ToolPart[] {
    if (!message?.parts) return [];
    // Cast needed because UIMessage.parts has a complex union type
    // that TypeScript can't narrow through the filter type guard
    return (message.parts as unknown[]).filter(isToolPart);
}

/**
 * Type guard for file parts
 */
export function isFilePart(part: unknown): part is FilePart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type: unknown }).type === "file" &&
        "url" in part &&
        "mediaType" in part
    );
}

/**
 * Extract file parts from UIMessage
 */
export function getFileParts(message: UIMessage): FilePart[] {
    if (!message?.parts) return [];
    return (message.parts as unknown[]).filter(isFilePart);
}

/**
 * Type guard for data parts
 */
export function isDataPart(part: unknown): part is DataPart {
    return (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        typeof (part as { type: unknown }).type === "string" &&
        (part as { type: string }).type.startsWith("data-") &&
        "data" in part
    );
}

/**
 * Extract data parts from UIMessage
 * Data parts have type starting with "data-" (e.g., "data-askUserInput")
 */
export function getDataParts(message: UIMessage): DataPart[] {
    if (!message?.parts) return [];
    return (message.parts as unknown[]).filter(isDataPart);
}

/**
 * Map tool part state to ToolStatus
 */
export function getToolStatus(state: ToolPart["state"]): ToolStatus {
    switch (state) {
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
 * Checks both AI SDK pattern (errorText) and our API pattern (output.error + output.message)
 */
export function getToolError(
    part: ToolPart,
    output: Record<string, unknown> | undefined,
    fallbackMessage = "Operation failed"
): string | undefined {
    // AI SDK pattern: errorText field on the part itself
    if (part.errorText) return part.errorText;
    // Our API pattern: error flag in output with message
    if (output?.error) return String(output.message ?? fallbackMessage);
    return undefined;
}
