/**
 * Flat Message Array for Code Mode
 *
 * Based on competitor analysis (claudecodeui, claude-code-webui, opcode),
 * all successful implementations use:
 * 1. Flat message array - no nested threading
 * 2. Tool result linking by ID - results update tool_use, not separate messages
 * 3. Append-only array - only mutation is adding tool results
 *
 * This replaces the complex contentOrder/textSegments approach with a
 * simpler flat array that's easier to reason about and render.
 */

import { logger } from "@/lib/logger";

/**
 * Tool lifecycle states for flat message array
 *
 * Simpler state names than the legacy format:
 * - streaming: Input arguments streaming
 * - running: Executing (input complete)
 * - complete: Success, result available
 * - error: Failed with error
 */
export type CodeToolState = "streaming" | "running" | "complete" | "error";

/**
 * Message types in the flat array
 */
export type CodeMessage = TextMessage | ToolMessage | UserMessage | SystemMessage;

/**
 * Text from the assistant (can be partial during streaming)
 */
export interface TextMessage {
    type: "text";
    id: string;
    content: string;
    isStreaming?: boolean;
}

/**
 * Tool invocation with optional result
 * Result updates this message in-place, not a separate message
 */
export interface ToolMessage {
    type: "tool";
    id: string; // toolCallId
    toolName: string;
    state: CodeToolState;
    input: Record<string, unknown>;
    result?: unknown;
    errorText?: string;
    elapsedSeconds?: number;
}

/**
 * User message (prompt)
 */
export interface UserMessage {
    type: "user";
    id: string;
    content: string;
}

/**
 * System message (errors, status)
 */
export interface SystemMessage {
    type: "system";
    id: string;
    content: string;
    isError?: boolean;
}

/**
 * Message processor that handles both streaming and batch modes
 * Inspired by claude-code-webui's UnifiedMessageProcessor
 */
export class MessageProcessor {
    private messages: CodeMessage[] = [];
    private currentTextId: string | null = null;
    private textIndex = 0;
    private messageIndex = 0; // Counter for unique message IDs
    private inputBuffers = new Map<string, string>();

    /**
     * Get all messages
     */
    getMessages(): CodeMessage[] {
        return [...this.messages];
    }

    /**
     * Clear all messages
     */
    clear(): void {
        this.messages = [];
        this.currentTextId = null;
        this.textIndex = 0;
        this.messageIndex = 0;
        this.inputBuffers.clear();
    }

    /**
     * Add a user message
     */
    addUserMessage(content: string): UserMessage {
        const message: UserMessage = {
            type: "user",
            id: `user-${this.messageIndex++}`,
            content,
        };
        this.messages.push(message);
        this.currentTextId = null; // User message interrupts text flow
        return message;
    }

    /**
     * Handle text delta during streaming
     * Accumulates into current text message or creates new one
     */
    onTextDelta(delta: string): TextMessage {
        // Find or create current text message
        if (this.currentTextId) {
            const textMsg = this.messages.find((m) => m.id === this.currentTextId) as
                | TextMessage
                | undefined;
            if (textMsg && textMsg.type === "text") {
                textMsg.content += delta;
                textMsg.isStreaming = true;
                return textMsg;
            }
        }

        // Create new text message
        const message: TextMessage = {
            type: "text",
            id: `text-${this.textIndex++}`,
            content: delta,
            isStreaming: true,
        };
        this.messages.push(message);
        this.currentTextId = message.id;
        return message;
    }

    /**
     * Mark current text as complete (no longer streaming)
     */
    finalizeText(): void {
        if (this.currentTextId) {
            const textMsg = this.messages.find((m) => m.id === this.currentTextId) as
                | TextMessage
                | undefined;
            if (textMsg) {
                textMsg.isStreaming = false;
            }
        }
    }

    /**
     * Handle tool input start
     * Creates tool message in streaming state
     */
    onToolInputStart(toolCallId: string, toolName: string): ToolMessage {
        // Finalize any pending text
        this.finalizeText();
        this.currentTextId = null;

        const message: ToolMessage = {
            type: "tool",
            id: toolCallId,
            toolName,
            state: "streaming",
            input: {},
        };
        this.messages.push(message);
        this.inputBuffers.set(toolCallId, "");

        logger.debug({ toolName, toolCallId }, "Tool input started");
        return message;
    }

    /**
     * Handle tool input delta (partial JSON)
     */
    onToolInputDelta(toolCallId: string, partialJson: string): ToolMessage | null {
        const tool = this.findTool(toolCallId);
        if (!tool) return null;

        // Accumulate partial JSON
        const buffer = (this.inputBuffers.get(toolCallId) ?? "") + partialJson;
        this.inputBuffers.set(toolCallId, buffer);

        // Try to parse accumulated JSON
        try {
            tool.input = JSON.parse(buffer);
        } catch {
            // Still incomplete, that's fine
        }

        return tool;
    }

    /**
     * Handle tool call complete (input finished, execution starting)
     */
    onToolCall(
        toolCallId: string,
        toolName: string,
        input: Record<string, unknown>
    ): ToolMessage {
        let tool = this.findTool(toolCallId);

        if (!tool) {
            // Handle late arrival - create tool if we missed input-start
            // First finalize any pending text
            this.finalizeText();
            this.currentTextId = null;

            tool = {
                type: "tool",
                id: toolCallId,
                toolName,
                state: "running",
                input,
            };
            this.messages.push(tool);
        } else {
            tool.state = "running";
            tool.toolName = toolName; // Update in case input-start had placeholder
            tool.input = input;
        }

        logger.debug({ toolName, toolCallId }, "Tool call complete");
        return tool;
    }

    /**
     * Handle tool progress (elapsed time update)
     */
    onToolProgress(toolCallId: string, elapsedSeconds: number): ToolMessage | null {
        const tool = this.findTool(toolCallId);
        if (!tool) return null;

        tool.elapsedSeconds = elapsedSeconds;
        return tool;
    }

    /**
     * Handle tool result
     * Updates existing tool message - NOT a separate message
     */
    onToolResult(
        toolCallId: string,
        result: unknown,
        isError: boolean,
        errorText?: string
    ): ToolMessage | null {
        const tool = this.findTool(toolCallId);
        if (!tool) {
            logger.warn({ toolCallId }, "Tool result for unknown tool");
            return null;
        }

        if (isError) {
            tool.state = "error";
            tool.errorText = errorText ?? String(result);
        } else {
            tool.state = "complete";
            tool.result = result;
        }

        // Clear elapsed time and input buffer on completion
        tool.elapsedSeconds = undefined;
        this.inputBuffers.delete(toolCallId);

        logger.debug(
            { toolCallId, state: tool.state, isError },
            "Tool result received"
        );
        return tool;
    }

    /**
     * Add a system message
     */
    addSystemMessage(content: string, isError = false): SystemMessage {
        const message: SystemMessage = {
            type: "system",
            id: `system-${this.messageIndex++}`,
            content,
            isError,
        };
        this.messages.push(message);
        return message;
    }

    /**
     * Find a tool message by ID
     */
    private findTool(toolCallId: string): ToolMessage | null {
        const msg = this.messages.find((m) => m.type === "tool" && m.id === toolCallId);
        return (msg as ToolMessage) ?? null;
    }

    /**
     * Serialize for data stream emission
     */
    toStreamData(): { type: "messages"; messages: CodeMessage[] } {
        return {
            type: "messages",
            messages: this.getMessages(),
        };
    }
}

/**
 * Type guards for message types
 */
export function isTextMessage(msg: CodeMessage): msg is TextMessage {
    return msg.type === "text";
}

export function isToolMessage(msg: CodeMessage): msg is ToolMessage {
    return msg.type === "tool";
}

export function isUserMessage(msg: CodeMessage): msg is UserMessage {
    return msg.type === "user";
}

export function isSystemMessage(msg: CodeMessage): msg is SystemMessage {
    return msg.type === "system";
}
