/**
 * Tests for Claude Code chunk handling
 *
 * Based on captured real SDK output to ensure we handle all chunk types correctly.
 * See scripts/claude-code-chunks-capture.json for sample data.
 */

import { describe, it, expect } from "vitest";
import { ToolStateAccumulator } from "@/lib/code/transform";

/**
 * Real chunk data captured from Claude Code SDK
 */
const CAPTURED_CHUNKS = {
    toolInputStart: {
        type: "tool-input-start",
        id: "toolu_01J7GScy5WfRy1YEPmEfEcKd",
        toolName: "Read",
        providerExecuted: true,
        dynamic: true,
    },
    toolInputDelta: {
        type: "tool-input-delta",
        id: "toolu_01J7GScy5WfRy1YEPmEfEcKd",
        delta: '{"file_path":"/Users/nick/src/carmenta-code/package.json"}',
    },
    toolCall: {
        type: "tool-call",
        toolCallId: "toolu_01J7GScy5WfRy1YEPmEfEcKd",
        toolName: "Read",
        input: {
            file_path: "/Users/nick/src/carmenta-code/package.json",
        },
        providerExecuted: true,
        dynamic: true,
        providerMetadata: {
            "claude-code": {
                rawInput: '{"file_path":"/Users/nick/src/carmenta-code/package.json"}',
            },
        },
    },
    toolResult: {
        type: "tool-result",
        toolCallId: "toolu_01J7GScy5WfRy1YEPmEfEcKd",
        toolName: "Read",
        output: '     1→{\n     2→  "name": "carmenta"...',
        providerExecuted: true,
        dynamic: true,
    },
    textDelta: {
        type: "text-delta",
        id: "3p7tDHLakOKVXioa",
        text: "Project",
    },
    finish: {
        type: "finish",
        finishReason: "stop",
        usage: {
            inputTokens: 88651,
            outputTokens: 206,
            totalTokens: 88857,
        },
    },
};

describe("Claude Code chunk handling", () => {
    describe("ToolStateAccumulator with real chunk data", () => {
        it("should handle tool-input-start: tool appears immediately with name", () => {
            const accumulator = new ToolStateAccumulator();
            const chunk = CAPTURED_CHUNKS.toolInputStart;

            accumulator.onInputStart(chunk.id, chunk.toolName);

            const tools = accumulator.getAllTools();
            expect(tools).toHaveLength(1);
            expect(tools[0].toolName).toBe("Read");
            expect(tools[0].toolCallId).toBe(chunk.id);
            expect(tools[0].state).toBe("input-streaming");
        });

        it("should handle tool-input-delta: input available for display", () => {
            const accumulator = new ToolStateAccumulator();
            const startChunk = CAPTURED_CHUNKS.toolInputStart;
            const deltaChunk = CAPTURED_CHUNKS.toolInputDelta;

            accumulator.onInputStart(startChunk.id, startChunk.toolName);

            // Pass the raw delta string - accumulator parses it
            accumulator.onInputDelta(deltaChunk.id, deltaChunk.delta);

            const tools = accumulator.getAllTools();
            expect(tools[0].input).toEqual({
                file_path: "/Users/nick/src/carmenta-code/package.json",
            });
            expect(tools[0].input.file_path).toBe(
                "/Users/nick/src/carmenta-code/package.json"
            );
        });

        it("should handle tool-call: complete input available", () => {
            const accumulator = new ToolStateAccumulator();
            const chunk = CAPTURED_CHUNKS.toolCall;

            accumulator.onToolCall(
                chunk.toolCallId,
                chunk.toolName,
                chunk.input as Record<string, unknown>
            );

            const tools = accumulator.getAllTools();
            expect(tools).toHaveLength(1);
            expect(tools[0].state).toBe("input-available");
            expect(tools[0].input).toEqual(chunk.input);
        });

        it("should handle tool-result: output available", () => {
            const accumulator = new ToolStateAccumulator();
            const callChunk = CAPTURED_CHUNKS.toolCall;
            const resultChunk = CAPTURED_CHUNKS.toolResult;

            // Tool call first
            accumulator.onToolCall(
                callChunk.toolCallId,
                callChunk.toolName,
                callChunk.input as Record<string, unknown>
            );

            // Then result (arrives 1ms later in real data)
            accumulator.onResult(resultChunk.toolCallId, resultChunk.output, false);

            const tools = accumulator.getAllTools();
            expect(tools[0].state).toBe("output-available");
            expect(tools[0].output).toBe(resultChunk.output);
        });

        it("should handle complete tool lifecycle in order", () => {
            const accumulator = new ToolStateAccumulator();
            const states: string[] = [];

            // 1. tool-input-start
            accumulator.onInputStart(
                CAPTURED_CHUNKS.toolInputStart.id,
                CAPTURED_CHUNKS.toolInputStart.toolName
            );
            states.push(accumulator.getAllTools()[0].state);

            // 2. tool-input-delta (raw string)
            accumulator.onInputDelta(
                CAPTURED_CHUNKS.toolInputDelta.id,
                CAPTURED_CHUNKS.toolInputDelta.delta
            );
            // State doesn't change from delta, just input is populated

            // 3. tool-call
            accumulator.onToolCall(
                CAPTURED_CHUNKS.toolCall.toolCallId,
                CAPTURED_CHUNKS.toolCall.toolName,
                CAPTURED_CHUNKS.toolCall.input as Record<string, unknown>
            );
            states.push(accumulator.getAllTools()[0].state);

            // 4. tool-result
            accumulator.onResult(
                CAPTURED_CHUNKS.toolResult.toolCallId,
                CAPTURED_CHUNKS.toolResult.output,
                false
            );
            states.push(accumulator.getAllTools()[0].state);

            expect(states).toEqual([
                "input-streaming",
                "input-available",
                "output-available",
            ]);
        });

        it("should handle multiple tools in sequence", () => {
            const accumulator = new ToolStateAccumulator();

            // Tool 1: Read
            accumulator.onInputStart("tool1", "Read");
            accumulator.onToolCall("tool1", "Read", { file_path: "/a.txt" });
            accumulator.onResult("tool1", "content", false);

            // Tool 2: Grep
            accumulator.onInputStart("tool2", "Grep");
            accumulator.onToolCall("tool2", "Grep", { pattern: "TODO" });
            accumulator.onResult("tool2", "matches", false);

            const tools = accumulator.getAllTools();
            expect(tools).toHaveLength(2);
            expect(tools[0].toolName).toBe("Read");
            expect(tools[0].state).toBe("output-available");
            expect(tools[1].toolName).toBe("Grep");
            expect(tools[1].state).toBe("output-available");
        });
    });

    describe("Chunk type identification", () => {
        it("should identify all chunk types from SDK", () => {
            const chunkTypes = [
                "tool-input-start",
                "tool-input-delta",
                "tool-call",
                "tool-result",
                "text-delta",
                "finish",
            ];

            // These are all the types we captured from real SDK output
            expect(chunkTypes).toContain(CAPTURED_CHUNKS.toolInputStart.type);
            expect(chunkTypes).toContain(CAPTURED_CHUNKS.toolInputDelta.type);
            expect(chunkTypes).toContain(CAPTURED_CHUNKS.toolCall.type);
            expect(chunkTypes).toContain(CAPTURED_CHUNKS.toolResult.type);
            expect(chunkTypes).toContain(CAPTURED_CHUNKS.textDelta.type);
            expect(chunkTypes).toContain(CAPTURED_CHUNKS.finish.type);
        });
    });

    describe("Input delta parsing", () => {
        it("should parse JSON delta into input object", () => {
            const delta = CAPTURED_CHUNKS.toolInputDelta.delta;
            const parsed = JSON.parse(delta);

            expect(parsed).toEqual({
                file_path: "/Users/nick/src/carmenta-code/package.json",
            });
        });

        it("should handle Grep tool input delta", () => {
            const grepDelta =
                '{"pattern":"TODO|FIXME","path":"lib","output_mode":"content","-i":true}';
            const parsed = JSON.parse(grepDelta);

            expect(parsed.pattern).toBe("TODO|FIXME");
            expect(parsed.path).toBe("lib");
        });
    });
});
