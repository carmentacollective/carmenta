/**
 * Mock stream utilities for tool integration tests.
 *
 * Provides chunk builders and scenario loading for testing tool rendering
 * as if invoked by an LLM via the AI SDK.
 *
 * Note: The current tests render tool components directly with mock data
 * rather than using streamText(). When full streaming tests are needed,
 * use MockLanguageModelV3 from "ai/test" with simulateReadableStream.
 */

import type { MockStreamChunk } from "./types";

/**
 * Build chunks for a simple tool call scenario.
 * Helper for common patterns.
 */
export function buildToolCallChunks(params: {
    toolName: string;
    toolCallId?: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    prefixText?: string;
}): MockStreamChunk[] {
    const toolCallId = params.toolCallId ?? `call-${params.toolName}-1`;
    const chunks: MockStreamChunk[] = [];

    // Optional prefix text
    if (params.prefixText) {
        chunks.push({ type: "text-start", id: "text-1" });
        chunks.push({ type: "text-delta", id: "text-1", delta: params.prefixText });
        chunks.push({ type: "text-end", id: "text-1" });
    }

    // Tool call
    chunks.push({
        type: "tool-call",
        toolCallId,
        toolName: params.toolName,
        input: params.input,
    });

    // Tool result (if provided)
    if (params.output) {
        chunks.push({
            type: "tool-result",
            toolCallId,
            toolName: params.toolName,
            output: params.output,
        });
    }

    // Finish
    chunks.push({
        type: "finish",
        finishReason: params.output ? "stop" : "tool-calls",
        usage: { inputTokens: 10, outputTokens: 20 },
    });

    return chunks;
}

/**
 * Build chunks for a parallel tool call scenario.
 * Simulates LLM calling multiple tools at once.
 */
export function buildParallelToolCallChunks(
    tools: Array<{
        toolName: string;
        toolCallId?: string;
        input: Record<string, unknown>;
        output?: Record<string, unknown>;
    }>
): MockStreamChunk[] {
    const chunks: MockStreamChunk[] = [];

    // All tool calls first
    tools.forEach((tool, index) => {
        const toolCallId = tool.toolCallId ?? `call-${tool.toolName}-${index + 1}`;
        chunks.push({
            type: "tool-call",
            toolCallId,
            toolName: tool.toolName,
            input: tool.input,
        });
    });

    // Then all results
    tools.forEach((tool, index) => {
        if (tool.output) {
            const toolCallId = tool.toolCallId ?? `call-${tool.toolName}-${index + 1}`;
            chunks.push({
                type: "tool-result",
                toolCallId,
                toolName: tool.toolName,
                output: tool.output,
            });
        }
    });

    // Finish - use "tool-calls" if any tool lacks output, "stop" if all complete
    const allHaveOutput = tools.every((t) => t.output !== undefined);
    chunks.push({
        type: "finish",
        finishReason: allHaveOutput ? "stop" : "tool-calls",
        usage: { inputTokens: 20, outputTokens: 40 },
    });

    return chunks;
}

/**
 * Build chunks for a reasoning + tool call scenario.
 * Simulates extended thinking before tool use.
 */
export function buildReasoningWithToolChunks(params: {
    reasoning: string;
    toolName: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
}): MockStreamChunk[] {
    const toolCallId = `call-${params.toolName}-1`;

    return [
        { type: "reasoning", text: params.reasoning },
        {
            type: "tool-call",
            toolCallId,
            toolName: params.toolName,
            input: params.input,
        },
        ...(params.output
            ? [
                  {
                      type: "tool-result" as const,
                      toolCallId,
                      toolName: params.toolName,
                      output: params.output,
                  },
              ]
            : []),
        {
            type: "finish",
            finishReason: params.output ? "stop" : ("tool-calls" as const),
            usage: { inputTokens: 15, outputTokens: 30 },
        },
    ];
}
