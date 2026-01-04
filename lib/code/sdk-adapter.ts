/**
 * Direct Claude Agent SDK Adapter
 *
 * Bypasses ai-sdk-provider-claude-code to get full streaming data including:
 * - tool_progress events with elapsed_time_seconds
 * - result messages with usage/timing/cost
 * - status messages
 *
 * The third-party provider abstracts away exactly the data we need for
 * a good streaming UX. This adapter uses the SDK directly.
 */

import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

/**
 * Our chunk types - everything the SDK provides, properly typed
 */
export type SDKChunk =
    | TextDeltaChunk
    | ToolInputStartChunk
    | ToolInputDeltaChunk
    | ToolCallChunk
    | ToolResultChunk
    | ToolProgressChunk
    | ResultChunk
    | StatusChunk
    | ErrorChunk;

export interface TextDeltaChunk {
    type: "text-delta";
    text: string;
}

export interface ToolInputStartChunk {
    type: "tool-input-start";
    id: string;
    toolName: string;
}

export interface ToolInputDeltaChunk {
    type: "tool-input-delta";
    id: string;
    delta: string;
}

export interface ToolCallChunk {
    type: "tool-call";
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
}

export interface ToolResultChunk {
    type: "tool-result";
    toolCallId: string;
    toolName: string;
    output: unknown;
    isError: boolean;
}

/**
 * Tool progress - the key data the provider was hiding from us!
 */
export interface ToolProgressChunk {
    type: "tool-progress";
    toolCallId: string;
    toolName: string;
    elapsedSeconds: number;
}

/**
 * Final result with timing and usage
 */
export interface ResultChunk {
    type: "result";
    success: boolean;
    durationMs: number;
    durationApiMs: number;
    numTurns: number;
    totalCostUsd: number;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
    };
}

export interface StatusChunk {
    type: "status";
    message: string;
}

export interface ErrorChunk {
    type: "error";
    error: Error | string;
}

/**
 * SDK adapter options
 */
export interface SDKAdapterOptions {
    /** Working directory for Claude Code */
    cwd: string;
    /** System prompt configuration */
    systemPrompt?:
        | string
        | {
              type: "preset";
              preset: "claude_code";
              append?: string;
          };
    /** Model to use: sonnet, opus, haiku */
    model?: "sonnet" | "opus" | "haiku";
    /** Max turns for the conversation */
    maxTurns?: number;
    /** Settings sources to load */
    settingSources?: Array<"user" | "project" | "local">;
    /** Abort signal for cancellation */
    abortSignal?: AbortSignal;
}

/**
 * Stream Claude Code responses directly from the SDK
 *
 * Unlike the AI SDK provider, this gives us:
 * - Real-time tool progress with elapsed times
 * - Final result with usage/cost metrics
 * - Status messages
 *
 * **SECURITY NOTE:** This function uses `permissionMode: "bypassPermissions"`.
 * Callers MUST validate project ownership and paths before calling this function.
 * See app/api/code/route.ts for proper validation patterns.
 *
 * @example
 * ```typescript
 * for await (const chunk of streamSDK(prompt, options)) {
 *   switch (chunk.type) {
 *     case 'tool-progress':
 *       console.log(`${chunk.toolName}: ${chunk.elapsedSeconds}s`);
 *       break;
 *     case 'result':
 *       console.log(`Done in ${chunk.durationMs}ms, cost: $${chunk.totalCostUsd}`);
 *       break;
 *   }
 * }
 * ```
 */
export async function* streamSDK(
    prompt: string,
    options: SDKAdapterOptions
): AsyncGenerator<SDKChunk> {
    const abortController = new AbortController();

    // Link external abort signal if provided
    if (options.abortSignal?.aborted) {
        // Already aborted, no need to add listener
        abortController.abort(options.abortSignal.reason);
    }

    // Track tool metadata for proper delta routing
    // These maps persist for the duration of this single request and are
    // automatically garbage collected when the generator completes.
    const toolNames = new Map<string, string>();
    // Map block index → tool ID for proper input_json_delta routing
    const blockIndexToToolId = new Map<number, string>();

    // Store abort handler for cleanup
    const abortHandler = options.abortSignal
        ? () => abortController.abort(options.abortSignal?.reason)
        : null;

    // Add abort listener if signal provided and not already aborted
    if (options.abortSignal && !options.abortSignal.aborted && abortHandler) {
        options.abortSignal.addEventListener("abort", abortHandler, { once: true });
    }

    try {
        const response = query({
            prompt,
            options: {
                cwd: options.cwd,
                systemPrompt: options.systemPrompt,
                model: options.model,
                maxTurns: options.maxTurns,
                settingSources: options.settingSources,
                permissionMode: "bypassPermissions",
                abortController,
                // Enable partial messages to get streaming deltas
                includePartialMessages: true,
            },
        });

        for await (const message of response) {
            // Handle each SDK message type with error handling
            try {
                for (const chunk of processSDKMessage(
                    message,
                    toolNames,
                    blockIndexToToolId
                )) {
                    yield chunk;
                }
            } catch (processingError) {
                logger.error(
                    { error: processingError, messageType: message?.type },
                    "SDK message processing error"
                );
                Sentry.captureException(processingError, {
                    level: "warning",
                    tags: { component: "code-mode", operation: "message_processing" },
                    extra: { messageType: message?.type },
                });
                yield {
                    type: "error",
                    error:
                        processingError instanceof Error
                            ? processingError
                            : String(processingError),
                };
                // Continue processing subsequent messages
            }
        }
    } catch (error) {
        logger.error(
            {
                error,
                cwd: options.cwd,
                model: options.model,
                wasAborted: abortController.signal.aborted,
            },
            "SDK streaming error"
        );
        // Don't report abort errors - those are user-initiated
        if (!abortController.signal.aborted) {
            Sentry.captureException(error, {
                tags: { component: "code-mode", operation: "sdk_streaming" },
                extra: { cwd: options.cwd, model: options.model },
            });
        }
        yield {
            type: "error",
            error: error instanceof Error ? error : String(error),
        };
    } finally {
        // Clean up abort listener to prevent memory leak
        if (options.abortSignal && abortHandler) {
            options.abortSignal.removeEventListener("abort", abortHandler);
        }
    }
}

/**
 * Process a single SDK message into our chunk types
 */
function* processSDKMessage(
    message: SDKMessage,
    toolNames: Map<string, string>,
    blockIndexToToolId: Map<number, string>
): Generator<SDKChunk> {
    switch (message.type) {
        case "stream_event": {
            // Partial streaming events (text deltas, input deltas)
            const event = (message as { event?: StreamEvent }).event;
            if (!event) {
                logger.warn({ message }, "SDK stream_event missing event property");
                break;
            }
            yield* processStreamEvent(event, toolNames, blockIndexToToolId);
            break;
        }

        case "assistant": {
            // Complete assistant message - extract tool calls
            const content = (message as AssistantMessage).message?.content;
            if (!content) break;

            for (const block of content) {
                if (block.type === "tool_use") {
                    const toolUse = block as ToolUseBlock;

                    // Emit tool-call for any tools we haven't seen via streaming
                    if (!toolNames.has(toolUse.id)) {
                        toolNames.set(toolUse.id, toolUse.name);
                        yield {
                            type: "tool-input-start",
                            id: toolUse.id,
                            toolName: toolUse.name,
                        };
                    }

                    yield {
                        type: "tool-call",
                        toolCallId: toolUse.id,
                        toolName: toolUse.name,
                        input: (toolUse.input as Record<string, unknown>) ?? {},
                    };
                }
            }
            break;
        }

        case "user": {
            // User message - check for tool results
            const userMsg = message as UserMessage;

            // SDK provides tool_use_result for convenience, but parent_tool_use_id
            // may be null. In that case, extract the tool_use_id from message.content.
            if (userMsg.tool_use_result !== undefined) {
                // Try parent_tool_use_id first, then fall back to message.content
                let toolCallId = userMsg.parent_tool_use_id;

                // If parent_tool_use_id is null, look in message.content for tool_result block
                if (!toolCallId) {
                    const msgContent = (
                        message as { message?: { content?: unknown[] } }
                    ).message?.content;
                    if (Array.isArray(msgContent)) {
                        const toolResultBlock = msgContent.find(
                            (
                                block
                            ): block is { type: "tool_result"; tool_use_id: string } =>
                                typeof block === "object" &&
                                block !== null &&
                                (block as { type?: string }).type === "tool_result" &&
                                typeof (block as { tool_use_id?: unknown })
                                    .tool_use_id === "string"
                        );
                        if (toolResultBlock) {
                            toolCallId = toolResultBlock.tool_use_id;
                        }
                    }
                }

                if (toolCallId) {
                    const toolName = toolNames.get(toolCallId) ?? "unknown";
                    logger.debug(
                        { toolCallId, toolName },
                        "SDK adapter: yielding tool-result"
                    );

                    // Detect errors from multiple formats:
                    // 1. String output starting with "Error:"
                    // 2. Object with non-zero exitCode (Bash tool)
                    // 3. Object with error field
                    let isError = false;
                    const result = userMsg.tool_use_result;

                    if (typeof result === "string") {
                        isError = result.startsWith("Error:");
                    } else if (typeof result === "object" && result !== null) {
                        const obj = result as Record<string, unknown>;
                        if (typeof obj.exitCode === "number" && obj.exitCode !== 0) {
                            isError = true;
                        } else if (obj.error !== undefined) {
                            isError = true;
                        }
                    }

                    yield {
                        type: "tool-result",
                        toolCallId,
                        toolName,
                        output: userMsg.tool_use_result,
                        isError,
                    };
                }
            }
            break;
        }

        case "tool_progress": {
            // The key event the provider was ignoring!
            const progress = message as ToolProgressMessage;
            yield {
                type: "tool-progress",
                toolCallId: progress.tool_use_id,
                toolName: progress.tool_name,
                elapsedSeconds: progress.elapsed_time_seconds,
            };
            break;
        }

        case "result": {
            // Final result with metrics
            const result = message as ResultMessage;
            yield {
                type: "result",
                success: result.subtype === "success",
                durationMs: result.duration_ms ?? 0,
                durationApiMs: result.duration_api_ms ?? 0,
                numTurns: result.num_turns ?? 0,
                totalCostUsd: result.total_cost_usd ?? 0,
                usage: {
                    inputTokens: result.usage?.input_tokens ?? 0,
                    outputTokens: result.usage?.output_tokens ?? 0,
                    cacheReadInputTokens: result.usage?.cache_read_input_tokens ?? 0,
                    cacheCreationInputTokens:
                        result.usage?.cache_creation_input_tokens ?? 0,
                },
            };
            break;
        }

        case "system": {
            // System messages (init, compact_boundary, etc.)
            const sysMsg = message as SystemMessage;
            if (sysMsg.subtype === "init") {
                yield {
                    type: "status",
                    message: "Session initialized",
                };
            }
            break;
        }
    }
}

/**
 * Process streaming events (partial assistant messages)
 */
function* processStreamEvent(
    event: StreamEvent,
    toolNames: Map<string, string>,
    blockIndexToToolId: Map<number, string>
): Generator<SDKChunk> {
    if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block?.type === "tool_use") {
            const toolUse = block as { id: string; name: string };
            toolNames.set(toolUse.id, toolUse.name);

            // Track block index → tool ID for proper delta routing
            if (event.index !== undefined) {
                blockIndexToToolId.set(event.index, toolUse.id);
            }

            yield {
                type: "tool-input-start",
                id: toolUse.id,
                toolName: toolUse.name,
            };
        }
    }

    if (event.type === "content_block_delta") {
        const delta = event.delta;

        // Text streaming
        if (delta?.type === "text_delta" && delta.text) {
            yield {
                type: "text-delta",
                text: delta.text,
            };
        }

        // Tool input streaming - route to correct tool using block index
        if (delta?.type === "input_json_delta" && delta.partial_json) {
            const toolId =
                event.index !== undefined
                    ? blockIndexToToolId.get(event.index)
                    : undefined;

            if (toolId) {
                yield {
                    type: "tool-input-delta",
                    id: toolId,
                    delta: delta.partial_json,
                };
            } else {
                // Fallback: Use first known tool when block index routing fails.
                // This happens when SDK doesn't provide event.index or when the index
                // hasn't been registered yet. With concurrent tools, this could misroute
                // deltas, but it's better than dropping them. The UI shows partial JSON
                // which degrades gracefully if misrouted (displays as incomplete string).
                logger.warn(
                    { index: event.index, toolCount: toolNames.size },
                    "Could not route input_json_delta to tool - using fallback"
                );
                const firstToolId = toolNames.keys().next().value as string | undefined;
                if (firstToolId) {
                    yield {
                        type: "tool-input-delta",
                        id: firstToolId,
                        delta: delta.partial_json,
                    };
                }
            }
        }
    }
}

// Type definitions for SDK messages (not fully exported by SDK)
interface StreamEvent {
    type: string;
    index?: number;
    content_block?: {
        type: string;
        id?: string;
        name?: string;
    };
    delta?: {
        type: string;
        text?: string;
        partial_json?: string;
    };
}

interface AssistantMessage {
    type: "assistant";
    message?: {
        content?: Array<{ type: string }>;
    };
}

interface ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: unknown;
}

interface UserMessage {
    type: "user";
    parent_tool_use_id: string | null;
    tool_use_result?: unknown;
}

interface ToolProgressMessage {
    type: "tool_progress";
    tool_use_id: string;
    tool_name: string;
    elapsed_time_seconds: number;
}

interface ResultMessage {
    type: "result";
    subtype?: string;
    duration_ms?: number;
    duration_api_ms?: number;
    num_turns?: number;
    total_cost_usd?: number;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
    };
}

interface SystemMessage {
    type: "system";
    subtype?: string;
}
