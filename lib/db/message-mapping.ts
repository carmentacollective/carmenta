/**
 * Message Mapping Utilities
 *
 * Converts between AI SDK UIMessage format and our database schema.
 * Handles the polymorphic message parts with type discrimination.
 *
 * Note: We use loose typing here to be compatible with any tool configuration.
 * The AI SDK's UIMessage/UIMessagePart are generic and we need to handle
 * arbitrary tool calls and data parts.
 */

import type {
    Message,
    NewMessage,
    MessagePart,
    NewMessagePart,
    ToolCallData,
    DataPartContent,
    ProviderMetadata,
} from "./schema";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Loose UI message part type - matches AI SDK structure without generics
 */
export interface UIMessagePartLike {
    type: string;
    [key: string]: unknown;
}

/**
 * Loose UI message type - matches AI SDK structure without generics
 */
export interface UIMessageLike {
    id: string;
    role: "user" | "assistant" | "system";
    parts: UIMessagePartLike[];
    createdAt?: Date;
}

/**
 * Our internal message type with parts loaded
 */
export interface MessageWithParts extends Message {
    parts: MessagePart[];
}

/**
 * Connection with all messages and parts loaded
 */
export interface ConnectionWithMessages {
    id: string;
    userId: string;
    title: string | null;
    status: "active" | "background" | "archived";
    streamingStatus: "idle" | "streaming" | "completed" | "failed";
    modelId: string | null;
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
    messages: MessageWithParts[];
}

// ============================================================================
// UI MESSAGE → DB MESSAGE MAPPING
// ============================================================================

/**
 * Maps a UI message part to database format
 */
export function mapUIPartToDBPart(
    part: UIMessagePartLike,
    messageId: string,
    order: number
): NewMessagePart {
    const basePart = {
        messageId,
        order,
    };

    // Handle each part type
    switch (part.type) {
        case "text":
            return {
                ...basePart,
                type: "text",
                textContent: part.text as string,
            };

        case "reasoning":
            return {
                ...basePart,
                type: "reasoning",
                reasoningContent: part.text as string,
                providerMetadata: part.providerMetadata as ProviderMetadata,
            };

        case "file":
            return {
                ...basePart,
                type: "file",
                fileMediaType: part.mediaType as string,
                fileName: part.filename as string,
                fileUrl: part.url as string,
            };

        case "step-start":
            return {
                ...basePart,
                type: "step_start",
            };

        default:
            // Handle tool calls and data parts
            if (part.type.startsWith("tool-")) {
                return mapToolPartToDBPart(part, messageId, order);
            }
            if (part.type.startsWith("data-")) {
                return mapDataPartToDBPart(part, messageId, order);
            }

            // Unknown part type - store as text representation
            return {
                ...basePart,
                type: "text",
                textContent: `[Unknown part type: ${part.type}]`,
            };
    }
}

/**
 * Maps a tool call part to database format
 */
function mapToolPartToDBPart(
    part: UIMessagePartLike,
    messageId: string,
    order: number
): NewMessagePart {
    // Extract tool name from type (e.g., "tool-getWeather" → "getWeather")
    const toolName = part.type.replace("tool-", "");

    const state = (part.state as string)?.replace("-", "_") as ToolCallData["state"];

    const toolCallData: ToolCallData = {
        toolName,
        toolCallId: part.toolCallId as string,
        state: state ?? "input_available",
        input: part.input as Record<string, unknown>,
        output: part.output as Record<string, unknown>,
        error: part.errorText as string,
    };

    return {
        messageId,
        order,
        type: "tool_call",
        toolCall: toolCallData,
    };
}

/**
 * Maps a data part (generative UI) to database format
 */
function mapDataPartToDBPart(
    part: UIMessagePartLike,
    messageId: string,
    order: number
): NewMessagePart {
    // Extract data type from type (e.g., "data-weather" → "weather")
    const dataType = part.type.replace("data-", "");

    const dataContent: DataPartContent = {
        type: dataType,
        data: {
            ...(part.data as Record<string, unknown>),
            id: part.id as string, // Preserve the ID if present
        },
        loading: false, // Always false when persisting (completed)
    };

    return {
        messageId,
        order,
        type: "data",
        dataContent,
    };
}

/**
 * Maps an entire UI message to database format
 * Returns the message and its parts separately for atomic insert
 */
export function mapUIMessageToDB(
    uiMessage: UIMessageLike,
    connectionId: string
): { message: NewMessage; parts: NewMessagePart[] } {
    const message: NewMessage = {
        id: uiMessage.id,
        connectionId,
        role: uiMessage.role,
    };

    const parts = uiMessage.parts.map((part, index) =>
        mapUIPartToDBPart(part, uiMessage.id, index)
    );

    return { message, parts };
}

// ============================================================================
// DB MESSAGE → UI MESSAGE MAPPING
// ============================================================================

/**
 * Maps a database part to UI message part format
 */
export function mapDBPartToUIPart(part: MessagePart): UIMessagePartLike {
    switch (part.type) {
        case "text":
            return {
                type: "text",
                text: part.textContent ?? "",
            };

        case "reasoning":
            return {
                type: "reasoning",
                text: part.reasoningContent ?? "",
                providerMetadata: part.providerMetadata ?? undefined,
            };

        case "file":
            return {
                type: "file",
                mediaType: part.fileMediaType ?? "",
                filename: part.fileName ?? "",
                url: part.fileUrl ?? "",
            };

        case "step_start":
            return {
                type: "step-start",
            };

        case "tool_call":
            return mapDBToolPartToUIPart(part);

        case "data":
            return mapDBDataPartToUIPart(part);

        default:
            // Fallback for unknown types
            return {
                type: "text",
                text: `[Unknown stored part type: ${part.type}]`,
            };
    }
}

/**
 * Maps a database tool call part back to UI format
 */
function mapDBToolPartToUIPart(part: MessagePart): UIMessagePartLike {
    const toolCall = part.toolCall;
    if (!toolCall) {
        return { type: "text", text: "[Missing tool call data]" };
    }

    const toolType = `tool-${toolCall.toolName}`;

    // Convert state back to AI SDK format (underscore → hyphen)
    const state = toolCall.state.replace("_", "-");

    // Build the tool part based on state
    const baseTool: UIMessagePartLike = {
        type: toolType,
        toolCallId: toolCall.toolCallId,
        state,
    };

    switch (state) {
        case "input-streaming":
            return {
                ...baseTool,
                input: toolCall.input,
            };

        case "input-available":
            return {
                ...baseTool,
                input: toolCall.input,
            };

        case "output-available":
            return {
                ...baseTool,
                input: toolCall.input,
                output: toolCall.output,
            };

        case "output-error":
            return {
                ...baseTool,
                input: toolCall.input,
                errorText: toolCall.error,
            };

        default:
            return {
                ...baseTool,
                input: toolCall.input,
            };
    }
}

/**
 * Maps a database data part back to UI format
 */
function mapDBDataPartToUIPart(part: MessagePart): UIMessagePartLike {
    const dataContent = part.dataContent;
    if (!dataContent) {
        return { type: "text", text: "[Missing data content]" };
    }

    const dataType = `data-${dataContent.type}`;

    // Extract ID from data if present
    const { id, ...restData } = dataContent.data as {
        id?: string;
        [key: string]: unknown;
    };

    return {
        type: dataType,
        id: id ?? part.id,
        data: {
            ...restData,
            loading: false, // Always false when loading from DB
        },
    };
}

/**
 * Maps a database message with parts back to UI message format
 */
export function mapDBMessageToUI(messageWithParts: MessageWithParts): UIMessageLike {
    // Sort parts by order
    const sortedParts = [...messageWithParts.parts].sort((a, b) => a.order - b.order);

    return {
        id: messageWithParts.id,
        role: messageWithParts.role,
        parts: sortedParts.map(mapDBPartToUIPart),
        createdAt: messageWithParts.createdAt,
    };
}

/**
 * Maps all messages from a connection to UI format
 */
export function mapConnectionMessagesToUI(
    connection: ConnectionWithMessages
): UIMessageLike[] {
    // Sort messages by creation time
    const sortedMessages = [...connection.messages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    return sortedMessages.map(mapDBMessageToUI);
}
