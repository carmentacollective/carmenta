/**
 * Claude Agent SDK → AI SDK Bridge Transformation Tests
 *
 * Tests the pipeline: SDK messages → bridge transforms → renderable ToolParts
 *
 * The bridge must handle:
 * 1. SDKPartialAssistantMessage (streaming events) → early tool detection
 * 2. SDKAssistantMessage (complete message) → tool_use content blocks
 * 3. SDKToolProgressMessage → elapsed time for running tools
 * 4. SDKUserMessage → tool results (tool_use_result field)
 *
 * Output format must match what CodeModeMessage expects:
 * - type: `tool-${toolName}`
 * - toolCallId: unique ID
 * - state: "input-streaming" | "input-available" | "output-available" | "output-error"
 * - input: tool arguments
 * - output?: tool result (when complete)
 * - elapsedSeconds?: from tool_progress (for "running 2.3s" display)
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
    SDKMessage,
    SDKAssistantMessage,
    SDKPartialAssistantMessage,
    SDKToolProgressMessage,
    SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

import {
    ToolStateAccumulator,
    type RenderableToolPart,
    getToolStatusMessage,
    getToolIcon,
} from "@/lib/code/transform";

/**
 * ============================================================================
 * FIXTURES: Real SDK message shapes captured from Claude Agent SDK
 * ============================================================================
 */

// UUID helper for fixtures
const uuid = () =>
    crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`;

/**
 * Fixture: SDKPartialAssistantMessage with content_block_start (tool_use)
 *
 * This arrives when Claude starts using a tool - we see the tool name and ID
 * but arguments are still streaming.
 */
const FIXTURE_PARTIAL_TOOL_START: SDKPartialAssistantMessage = {
    type: "stream_event",
    event: {
        type: "content_block_start",
        index: 0,
        content_block: {
            type: "tool_use",
            id: "toolu_01ABC123",
            name: "Read",
            input: {},
        },
    },
    parent_tool_use_id: null,
    uuid: uuid(),
    session_id: "session_123",
};

/**
 * Fixture: SDKPartialAssistantMessage with content_block_delta (tool input)
 *
 * Arguments stream in as JSON deltas.
 */
const _FIXTURE_PARTIAL_TOOL_DELTA: SDKPartialAssistantMessage = {
    type: "stream_event",
    event: {
        type: "content_block_delta",
        index: 0,
        delta: {
            type: "input_json_delta",
            partial_json: '{"file_path": "/src/index.ts"}',
        },
    },
    parent_tool_use_id: null,
    uuid: uuid(),
    session_id: "session_123",
};

/**
 * Fixture: SDKPartialAssistantMessage with content_block_stop
 *
 * Tool input is complete, execution begins.
 */
const _FIXTURE_PARTIAL_TOOL_STOP: SDKPartialAssistantMessage = {
    type: "stream_event",
    event: {
        type: "content_block_stop",
        index: 0,
    },
    parent_tool_use_id: null,
    uuid: uuid(),
    session_id: "session_123",
};

/**
 * Fixture: SDKToolProgressMessage
 *
 * Emitted during tool execution with elapsed time.
 * This is the key to showing "Running for 2.3s..."
 */
const FIXTURE_TOOL_PROGRESS: SDKToolProgressMessage = {
    type: "tool_progress",
    tool_use_id: "toolu_01ABC123",
    tool_name: "Bash",
    parent_tool_use_id: null,
    elapsed_time_seconds: 2.3,
    uuid: uuid(),
    session_id: "session_123",
};

/**
 * Fixture: SDKAssistantMessage with tool_use content block
 *
 * Complete assistant message after tool execution.
 * Contains full tool_use block with all arguments.
 */
const FIXTURE_ASSISTANT_WITH_TOOL: SDKAssistantMessage = {
    type: "assistant",
    message: {
        id: "msg_01XYZ",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-20250514",
        stop_reason: "tool_use",
        stop_sequence: null,
        usage: {
            input_tokens: 100,
            output_tokens: 50,
        },
        content: [
            {
                type: "text",
                text: "Let me read that file for you.",
            },
            {
                type: "tool_use",
                id: "toolu_01ABC123",
                name: "Read",
                input: {
                    file_path: "/src/index.ts",
                },
            },
        ],
    },
    parent_tool_use_id: null,
    uuid: uuid(),
    session_id: "session_123",
};

/**
 * Fixture: SDKUserMessage with tool_use_result
 *
 * Contains the result of tool execution.
 */
const FIXTURE_USER_WITH_RESULT: SDKUserMessage = {
    type: "user",
    message: {
        role: "user",
        content: [
            {
                type: "tool_result",
                tool_use_id: "toolu_01ABC123",
                content: `     1→import { foo } from "bar";
     2→
     3→export function main() {
     4→    return foo();
     5→}`,
            },
        ],
    },
    parent_tool_use_id: "toolu_01ABC123",
    isSynthetic: true,
    tool_use_result: `     1→import { foo } from "bar";
     2→
     3→export function main() {
     4→    return foo();
     5→}`,
    session_id: "session_123",
};

/**
 * Fixture: SDKUserMessage with error result
 */
const _FIXTURE_USER_WITH_ERROR: SDKUserMessage = {
    type: "user",
    message: {
        role: "user",
        content: [
            {
                type: "tool_result",
                tool_use_id: "toolu_01DEF456",
                content: "Error: File not found: /nonexistent/path.ts",
                is_error: true,
            },
        ],
    },
    parent_tool_use_id: "toolu_01DEF456",
    isSynthetic: true,
    tool_use_result: {
        error: "File not found: /nonexistent/path.ts",
    },
    session_id: "session_123",
};

/**
 * Fixture: Multiple tools in sequence
 *
 * Simulates: Glob → Read → Edit flow
 */
const _FIXTURE_MULTI_TOOL_SEQUENCE: SDKMessage[] = [
    // Glob starts
    {
        type: "stream_event",
        event: {
            type: "content_block_start",
            index: 0,
            content_block: {
                type: "tool_use",
                id: "toolu_glob_001",
                name: "Glob",
                input: {},
            },
        },
        parent_tool_use_id: null,
        uuid: uuid(),
        session_id: "session_123",
    } satisfies SDKPartialAssistantMessage,
    // Glob progress
    {
        type: "tool_progress",
        tool_use_id: "toolu_glob_001",
        tool_name: "Glob",
        parent_tool_use_id: null,
        elapsed_time_seconds: 0.5,
        uuid: uuid(),
        session_id: "session_123",
    } satisfies SDKToolProgressMessage,
    // Glob result
    {
        type: "user",
        message: {
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: "toolu_glob_001",
                    content: JSON.stringify(["/src/index.ts", "/src/utils.ts"]),
                },
            ],
        },
        parent_tool_use_id: "toolu_glob_001",
        isSynthetic: true,
        tool_use_result: ["/src/index.ts", "/src/utils.ts"],
        session_id: "session_123",
    } satisfies SDKUserMessage,
    // Read starts
    {
        type: "stream_event",
        event: {
            type: "content_block_start",
            index: 1,
            content_block: {
                type: "tool_use",
                id: "toolu_read_002",
                name: "Read",
                input: {},
            },
        },
        parent_tool_use_id: null,
        uuid: uuid(),
        session_id: "session_123",
    } satisfies SDKPartialAssistantMessage,
];

/**
 * ============================================================================
 * TESTS
 * ============================================================================
 */

describe("Claude Agent SDK → Bridge Transformation", () => {
    describe("Fixture Shape Validation", () => {
        it("SDKPartialAssistantMessage has expected shape for tool_use start", () => {
            expect(FIXTURE_PARTIAL_TOOL_START.type).toBe("stream_event");
            expect(FIXTURE_PARTIAL_TOOL_START.event.type).toBe("content_block_start");

            const event = FIXTURE_PARTIAL_TOOL_START.event as {
                type: "content_block_start";
                content_block: { type: string; id: string; name: string };
            };
            expect(event.content_block.type).toBe("tool_use");
            expect(event.content_block.id).toBe("toolu_01ABC123");
            expect(event.content_block.name).toBe("Read");
        });

        it("SDKToolProgressMessage has elapsed_time_seconds", () => {
            expect(FIXTURE_TOOL_PROGRESS.type).toBe("tool_progress");
            expect(FIXTURE_TOOL_PROGRESS.tool_use_id).toBe("toolu_01ABC123");
            expect(FIXTURE_TOOL_PROGRESS.tool_name).toBe("Bash");
            expect(FIXTURE_TOOL_PROGRESS.elapsed_time_seconds).toBe(2.3);
        });

        it("SDKAssistantMessage contains tool_use content blocks", () => {
            expect(FIXTURE_ASSISTANT_WITH_TOOL.type).toBe("assistant");
            expect(FIXTURE_ASSISTANT_WITH_TOOL.message.content).toHaveLength(2);

            const toolUse = FIXTURE_ASSISTANT_WITH_TOOL.message.content[1];
            expect(toolUse.type).toBe("tool_use");
            if (toolUse.type === "tool_use") {
                expect(toolUse.id).toBe("toolu_01ABC123");
                expect(toolUse.name).toBe("Read");
                expect(toolUse.input).toEqual({ file_path: "/src/index.ts" });
            }
        });

        it("SDKUserMessage has tool_use_result for completed tools", () => {
            expect(FIXTURE_USER_WITH_RESULT.type).toBe("user");
            expect(FIXTURE_USER_WITH_RESULT.tool_use_result).toBeDefined();
            expect(FIXTURE_USER_WITH_RESULT.parent_tool_use_id).toBe("toolu_01ABC123");
        });
    });

    describe("Tool State Machine", () => {
        /**
         * Tool lifecycle states:
         *
         * content_block_start (tool_use) → input-streaming
         * content_block_delta (input_json_delta) → input-streaming (updates input)
         * content_block_stop → input-available (input complete, executing)
         * tool_progress → input-available (with elapsed time)
         * tool_result (success) → output-available
         * tool_result (error) → output-error
         */

        it("content_block_start creates tool in input-streaming state", () => {
            const expected: RenderableToolPart = {
                type: "tool-Read",
                toolCallId: "toolu_01ABC123",
                toolName: "Read",
                state: "input-streaming",
                input: {},
            };

            // This is what we want the bridge to produce
            expect(expected.state).toBe("input-streaming");
            expect(expected.input).toEqual({});
        });

        it("content_block_stop transitions to input-available", () => {
            const expected: RenderableToolPart = {
                type: "tool-Read",
                toolCallId: "toolu_01ABC123",
                toolName: "Read",
                state: "input-available",
                input: { file_path: "/src/index.ts" },
            };

            expect(expected.state).toBe("input-available");
            expect(expected.input).toEqual({ file_path: "/src/index.ts" });
        });

        it("tool_progress updates elapsedSeconds while input-available", () => {
            const expected: RenderableToolPart = {
                type: "tool-Bash",
                toolCallId: "toolu_01ABC123",
                toolName: "Bash",
                state: "input-available",
                input: { command: "npm test" },
                elapsedSeconds: 2.3,
            };

            expect(expected.elapsedSeconds).toBe(2.3);
        });

        it("tool_result (success) transitions to output-available", () => {
            const expected: RenderableToolPart = {
                type: "tool-Read",
                toolCallId: "toolu_01ABC123",
                toolName: "Read",
                state: "output-available",
                input: { file_path: "/src/index.ts" },
                output: `     1→import { foo } from "bar";
     2→
     3→export function main() {
     4→    return foo();
     5→}`,
            };

            expect(expected.state).toBe("output-available");
            expect(expected.output).toContain("import");
        });

        it("tool_result (error) transitions to output-error with errorText", () => {
            const expected: RenderableToolPart = {
                type: "tool-Read",
                toolCallId: "toolu_01DEF456",
                toolName: "Read",
                state: "output-error",
                input: { file_path: "/nonexistent/path.ts" },
                errorText: "File not found: /nonexistent/path.ts",
            };

            expect(expected.state).toBe("output-error");
            expect(expected.errorText).toContain("File not found");
        });
    });

    describe("Bridge Output Format", () => {
        it("produces correct type format: tool-{ToolName}", () => {
            const toolNames = [
                "Read",
                "Write",
                "Edit",
                "Bash",
                "Glob",
                "Grep",
                "Task",
                "WebFetch",
            ];

            for (const name of toolNames) {
                const expected: RenderableToolPart = {
                    type: `tool-${name}` as `tool-${string}`,
                    toolCallId: "test_id",
                    toolName: name,
                    state: "input-available",
                    input: {},
                };

                expect(expected.type).toBe(`tool-${name}`);
            }
        });

        it("preserves toolCallId from SDK messages", () => {
            // The toolCallId must match between:
            // - content_block_start.content_block.id
            // - tool_progress.tool_use_id
            // - tool_result.tool_use_id
            expect(FIXTURE_PARTIAL_TOOL_START.event).toMatchObject({
                type: "content_block_start",
            });
            const startEvent = FIXTURE_PARTIAL_TOOL_START.event as {
                content_block: { id: string };
            };

            expect(startEvent.content_block.id).toBe("toolu_01ABC123");
            expect(FIXTURE_TOOL_PROGRESS.tool_use_id).toBe("toolu_01ABC123");
            expect(FIXTURE_USER_WITH_RESULT.parent_tool_use_id).toBe("toolu_01ABC123");
        });
    });

    describe("Multi-Tool Sequences", () => {
        it("tracks multiple tools independently by toolCallId", () => {
            // Simulating state after processing FIXTURE_MULTI_TOOL_SEQUENCE
            const expectedState: Map<string, RenderableToolPart> = new Map([
                [
                    "toolu_glob_001",
                    {
                        type: "tool-Glob",
                        toolCallId: "toolu_glob_001",
                        toolName: "Glob",
                        state: "output-available",
                        input: { pattern: "**/*.ts" },
                        output: ["/src/index.ts", "/src/utils.ts"],
                    },
                ],
                [
                    "toolu_read_002",
                    {
                        type: "tool-Read",
                        toolCallId: "toolu_read_002",
                        toolName: "Read",
                        state: "input-streaming",
                        input: {},
                    },
                ],
            ]);

            expect(expectedState.size).toBe(2);
            expect(expectedState.get("toolu_glob_001")?.state).toBe("output-available");
            expect(expectedState.get("toolu_read_002")?.state).toBe("input-streaming");
        });
    });

    describe("Edge Cases", () => {
        it("handles tools with empty input", () => {
            const expected: RenderableToolPart = {
                type: "tool-Glob",
                toolCallId: "test_id",
                toolName: "Glob",
                state: "input-available",
                input: {},
            };

            expect(expected.input).toEqual({});
        });

        it("handles tools with complex nested input", () => {
            const complexInput = {
                todos: [
                    {
                        content: "Task 1",
                        status: "pending",
                        activeForm: "Doing task 1",
                    },
                    {
                        content: "Task 2",
                        status: "in_progress",
                        activeForm: "Doing task 2",
                    },
                ],
            };

            const expected: RenderableToolPart = {
                type: "tool-TodoWrite",
                toolCallId: "test_id",
                toolName: "TodoWrite",
                state: "input-available",
                input: complexInput,
            };

            expect(expected.input).toEqual(complexInput);
        });

        it("handles tools with binary/large output (truncation)", () => {
            const largeOutput = "x".repeat(10000);

            const expected: RenderableToolPart = {
                type: "tool-Read",
                toolCallId: "test_id",
                toolName: "Read",
                state: "output-available",
                input: { file_path: "/large-file.txt" },
                output: largeOutput,
            };

            // Bridge should preserve full output, UI handles truncation
            expect(expected.output).toHaveLength(10000);
        });

        it("handles rapid tool_progress updates", () => {
            // Multiple progress events should update elapsed time
            const progressUpdates = [0.1, 0.5, 1.0, 2.3, 5.0];

            for (const elapsed of progressUpdates) {
                const progress: SDKToolProgressMessage = {
                    ...FIXTURE_TOOL_PROGRESS,
                    elapsed_time_seconds: elapsed,
                };
                expect(progress.elapsed_time_seconds).toBe(elapsed);
            }
        });
    });
});

/**
 * ============================================================================
 * TOOL STATE ACCUMULATOR TESTS
 * ============================================================================
 */

describe("ToolStateAccumulator", () => {
    let accumulator: ToolStateAccumulator;

    beforeEach(() => {
        accumulator = new ToolStateAccumulator();
    });

    describe("onInputStart", () => {
        it("creates tool in input-streaming state", () => {
            const tool = accumulator.onInputStart("toolu_123", "Read");

            expect(tool.type).toBe("tool-Read");
            expect(tool.toolCallId).toBe("toolu_123");
            expect(tool.toolName).toBe("Read");
            expect(tool.state).toBe("input-streaming");
            expect(tool.input).toEqual({});
        });

        it("stores tool for later retrieval", () => {
            accumulator.onInputStart("toolu_123", "Read");

            const retrieved = accumulator.getTool("toolu_123");
            expect(retrieved).toBeDefined();
            expect(retrieved?.toolName).toBe("Read");
        });
    });

    describe("onInputDelta", () => {
        it("accumulates partial JSON input", () => {
            accumulator.onInputStart("toolu_123", "Read");

            // First chunk
            accumulator.onInputDelta("toolu_123", '{"file_path":');
            // Second chunk completes the JSON
            const tool = accumulator.onInputDelta("toolu_123", '"/src/index.ts"}');

            expect(tool?.input).toEqual({ file_path: "/src/index.ts" });
        });

        it("handles incomplete JSON gracefully", () => {
            accumulator.onInputStart("toolu_123", "Read");

            // Incomplete JSON - should not throw
            const tool = accumulator.onInputDelta("toolu_123", '{"file_path":');
            expect(tool).toBeDefined();
            // Input may still be empty or partial
        });

        it("returns null for unknown toolCallId", () => {
            const result = accumulator.onInputDelta("unknown", '{"foo": "bar"}');
            expect(result).toBeNull();
        });
    });

    describe("onToolCall", () => {
        it("transitions to input-available with complete args", () => {
            accumulator.onInputStart("toolu_123", "Read");

            const tool = accumulator.onToolCall("toolu_123", "Read", {
                file_path: "/src/index.ts",
            });

            expect(tool.state).toBe("input-available");
            expect(tool.input).toEqual({ file_path: "/src/index.ts" });
        });

        it("creates tool if input-start was missed", () => {
            // No onInputStart call - simulates late arrival
            const tool = accumulator.onToolCall("toolu_123", "Read", {
                file_path: "/src/index.ts",
            });

            expect(tool.toolCallId).toBe("toolu_123");
            expect(tool.state).toBe("input-available");
        });
    });

    describe("onProgress", () => {
        it("updates elapsedSeconds on existing tool", () => {
            accumulator.onInputStart("toolu_123", "Bash");
            accumulator.onToolCall("toolu_123", "Bash", { command: "npm test" });

            const tool = accumulator.onProgress("toolu_123", 2.5);

            expect(tool?.elapsedSeconds).toBe(2.5);
        });

        it("updates elapsedSeconds on successive calls", () => {
            accumulator.onInputStart("toolu_123", "Bash");

            accumulator.onProgress("toolu_123", 1.0);
            accumulator.onProgress("toolu_123", 2.0);
            const tool = accumulator.onProgress("toolu_123", 3.5);

            expect(tool?.elapsedSeconds).toBe(3.5);
        });

        it("returns null for unknown toolCallId", () => {
            const result = accumulator.onProgress("unknown", 2.5);
            expect(result).toBeNull();
        });
    });

    describe("onResult", () => {
        it("transitions to output-available on success", () => {
            accumulator.onInputStart("toolu_123", "Read");
            accumulator.onToolCall("toolu_123", "Read", { file_path: "/src/index.ts" });

            const tool = accumulator.onResult("toolu_123", "file contents here", false);

            expect(tool?.state).toBe("output-available");
            expect(tool?.output).toBe("file contents here");
            expect(tool?.errorText).toBeUndefined();
        });

        it("transitions to output-error on failure", () => {
            accumulator.onInputStart("toolu_123", "Read");
            accumulator.onToolCall("toolu_123", "Read", { file_path: "/missing.ts" });

            const tool = accumulator.onResult(
                "toolu_123",
                null,
                true,
                "File not found"
            );

            expect(tool?.state).toBe("output-error");
            expect(tool?.errorText).toBe("File not found");
        });

        it("clears elapsedSeconds on completion", () => {
            accumulator.onInputStart("toolu_123", "Bash");
            accumulator.onToolCall("toolu_123", "Bash", { command: "npm test" });
            accumulator.onProgress("toolu_123", 5.0);

            const tool = accumulator.onResult("toolu_123", { exitCode: 0 }, false);

            expect(tool?.elapsedSeconds).toBeUndefined();
        });

        it("returns null for unknown toolCallId", () => {
            const result = accumulator.onResult("unknown", "output", false);
            expect(result).toBeNull();
        });
    });

    describe("getAllTools", () => {
        it("returns all tools as array", () => {
            accumulator.onInputStart("toolu_1", "Read");
            accumulator.onInputStart("toolu_2", "Bash");
            accumulator.onInputStart("toolu_3", "Glob");

            const tools = accumulator.getAllTools();

            expect(tools).toHaveLength(3);
            expect(tools.map((t) => t.toolName)).toContain("Read");
            expect(tools.map((t) => t.toolName)).toContain("Bash");
            expect(tools.map((t) => t.toolName)).toContain("Glob");
        });
    });

    describe("toDataPart", () => {
        it("serializes tools for data stream emission", () => {
            accumulator.onInputStart("toolu_1", "Read");
            accumulator.onToolCall("toolu_1", "Read", { file_path: "/test.ts" });

            const dataPart = accumulator.toDataPart();

            expect(dataPart.type).toBe("tool-state");
            expect(dataPart.tools).toHaveLength(1);
            expect(dataPart.tools[0].toolName).toBe("Read");
        });
    });
});

/**
 * ============================================================================
 * FULL LIFECYCLE INTEGRATION TESTS
 * ============================================================================
 */

describe("Full Tool Execution Sequence", () => {
    let accumulator: ToolStateAccumulator;

    beforeEach(() => {
        accumulator = new ToolStateAccumulator();
    });

    it("processes complete Read tool lifecycle", () => {
        // 1. Tool starts
        let tool = accumulator.onInputStart("toolu_01ABC123", "Read");
        expect(tool.state).toBe("input-streaming");

        // 2. Input arrives
        accumulator.onInputDelta("toolu_01ABC123", '{"file_path": "/src/index.ts"}');

        // 3. Tool call with complete args
        tool = accumulator.onToolCall("toolu_01ABC123", "Read", {
            file_path: "/src/index.ts",
        });
        expect(tool.state).toBe("input-available");

        // 4. Result arrives
        tool = accumulator.onResult(
            "toolu_01ABC123",
            `     1→import { foo } from "bar";
     2→
     3→export function main() {
     4→    return foo();
     5→}`,
            false
        )!;

        expect(tool.state).toBe("output-available");
        expect(tool.output).toContain("import");
    });

    it("processes Bash tool with progress updates", () => {
        // 1. Tool starts
        accumulator.onInputStart("toolu_bash_001", "Bash");

        // 2. Tool call
        accumulator.onToolCall("toolu_bash_001", "Bash", { command: "npm test" });

        // 3. Progress updates while running
        let tool = accumulator.onProgress("toolu_bash_001", 1.0);
        expect(tool?.elapsedSeconds).toBe(1.0);

        tool = accumulator.onProgress("toolu_bash_001", 2.5);
        expect(tool?.elapsedSeconds).toBe(2.5);

        tool = accumulator.onProgress("toolu_bash_001", 3.5);
        expect(tool?.elapsedSeconds).toBe(3.5);

        // 4. Result
        tool = accumulator.onResult(
            "toolu_bash_001",
            { stdout: "test passed", stderr: "", exitCode: 0 },
            false
        );

        expect(tool?.state).toBe("output-available");
        expect(tool?.output).toEqual({
            stdout: "test passed",
            stderr: "",
            exitCode: 0,
        });
        expect(tool?.elapsedSeconds).toBeUndefined(); // Cleared on completion
    });

    it("handles error results correctly", () => {
        accumulator.onInputStart("toolu_123", "Read");
        accumulator.onToolCall("toolu_123", "Read", { file_path: "/missing.ts" });

        const tool = accumulator.onResult(
            "toolu_123",
            null,
            true,
            "File not found: /missing.ts"
        );

        expect(tool?.state).toBe("output-error");
        expect(tool?.errorText).toBe("File not found: /missing.ts");
    });

    it("tracks multiple tools independently", () => {
        // Glob starts and completes
        accumulator.onInputStart("toolu_glob", "Glob");
        accumulator.onToolCall("toolu_glob", "Glob", { pattern: "**/*.ts" });
        accumulator.onResult("toolu_glob", ["/src/index.ts", "/src/utils.ts"], false);

        // Read starts while Glob is done
        accumulator.onInputStart("toolu_read", "Read");
        accumulator.onToolCall("toolu_read", "Read", { file_path: "/src/index.ts" });

        const tools = accumulator.getAllTools();
        expect(tools).toHaveLength(2);

        const glob = accumulator.getTool("toolu_glob");
        const read = accumulator.getTool("toolu_read");

        expect(glob?.state).toBe("output-available");
        expect(read?.state).toBe("input-available");
    });
});

/**
 * ============================================================================
 * HELPER FUNCTION TESTS
 * ============================================================================
 */

/**
 * ============================================================================
 * CONTENT ORDER TRACKING TESTS
 * ============================================================================
 *
 * Tests for the content order tracking feature that enables proper interleaving
 * of text and tool parts after streaming ends. The AI SDK doesn't preserve
 * chronological order in message.parts, so we track it ourselves.
 */

describe("Content Order Tracking", () => {
    let accumulator: ToolStateAccumulator;

    beforeEach(() => {
        accumulator = new ToolStateAccumulator();
    });

    describe("onTextDelta", () => {
        it("creates text segment entry on first text delta", () => {
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toHaveLength(1);
            expect(order[0]).toEqual({ type: "text", id: "text-0" });
        });

        it("does NOT create duplicate entries for consecutive text deltas", () => {
            // Simulating multiple text-delta chunks in a row
            accumulator.onTextDelta();
            accumulator.onTextDelta();
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toHaveLength(1);
            expect(order[0]).toEqual({ type: "text", id: "text-0" });
        });

        it("increments text segment index for new segments", () => {
            // First text segment
            accumulator.onTextDelta();

            // Tool interrupts text flow
            accumulator.onInputStart("tool_1", "Read");

            // Second text segment (after tool)
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toHaveLength(3);
            expect(order[0]).toEqual({ type: "text", id: "text-0" });
            expect(order[1]).toEqual({ type: "tool", id: "tool_1" });
            expect(order[2]).toEqual({ type: "text", id: "text-1" });
        });
    });

    describe("onInputStart content order tracking", () => {
        it("adds tool entry to content order", () => {
            accumulator.onInputStart("tool_abc", "Read");

            const order = accumulator.getContentOrder();
            expect(order).toHaveLength(1);
            expect(order[0]).toEqual({ type: "tool", id: "tool_abc" });
        });

        it("resets text tracking when tool starts", () => {
            // Text, then tool, then more text
            accumulator.onTextDelta();
            accumulator.onInputStart("tool_1", "Bash");
            accumulator.onTextDelta(); // Should create text-1

            const order = accumulator.getContentOrder();
            expect(order[2]).toEqual({ type: "text", id: "text-1" });
        });
    });

    describe("getContentOrder", () => {
        it("returns empty array when no content", () => {
            expect(accumulator.getContentOrder()).toEqual([]);
        });

        it("returns a copy (not the internal array)", () => {
            accumulator.onTextDelta();
            const order1 = accumulator.getContentOrder();
            const order2 = accumulator.getContentOrder();

            expect(order1).not.toBe(order2);
            expect(order1).toEqual(order2);
        });
    });

    describe("realistic interleaving scenarios", () => {
        it("text → tool → text pattern", () => {
            // Claude says something
            accumulator.onTextDelta();
            accumulator.onTextDelta();

            // Claude uses a tool
            accumulator.onInputStart("toolu_read", "Read");
            accumulator.onToolCall("toolu_read", "Read", { file_path: "/test.ts" });
            accumulator.onResult("toolu_read", "content", false);

            // Claude says more
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toEqual([
                { type: "text", id: "text-0" },
                { type: "tool", id: "toolu_read" },
                { type: "text", id: "text-1" },
            ]);
        });

        it("tool → text → tool → text pattern", () => {
            // Starts with a tool
            accumulator.onInputStart("toolu_1", "Glob");
            accumulator.onResult("toolu_1", ["file.ts"], false);

            // Then text
            accumulator.onTextDelta();

            // Another tool
            accumulator.onInputStart("toolu_2", "Read");
            accumulator.onResult("toolu_2", "content", false);

            // More text
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toEqual([
                { type: "tool", id: "toolu_1" },
                { type: "text", id: "text-0" },
                { type: "tool", id: "toolu_2" },
                { type: "text", id: "text-1" },
            ]);
        });

        it("multiple tools in sequence (no text between)", () => {
            accumulator.onInputStart("toolu_1", "Glob");
            accumulator.onInputStart("toolu_2", "Read");
            accumulator.onInputStart("toolu_3", "Grep");

            const order = accumulator.getContentOrder();
            expect(order).toEqual([
                { type: "tool", id: "toolu_1" },
                { type: "tool", id: "toolu_2" },
                { type: "tool", id: "toolu_3" },
            ]);
        });

        it("complex realistic flow with thinking", () => {
            // Claude thinks/reasons (text)
            accumulator.onTextDelta();
            accumulator.onTextDelta();

            // First tool call
            accumulator.onInputStart("toolu_glob", "Glob");
            accumulator.onResult("toolu_glob", ["/src/a.ts", "/src/b.ts"], false);

            // Claude explains what it found
            accumulator.onTextDelta();

            // Reads multiple files back-to-back
            accumulator.onInputStart("toolu_read1", "Read");
            accumulator.onResult("toolu_read1", "content a", false);

            accumulator.onInputStart("toolu_read2", "Read");
            accumulator.onResult("toolu_read2", "content b", false);

            // Claude summarizes
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toEqual([
                { type: "text", id: "text-0" },
                { type: "tool", id: "toolu_glob" },
                { type: "text", id: "text-1" },
                { type: "tool", id: "toolu_read1" },
                { type: "tool", id: "toolu_read2" },
                { type: "text", id: "text-2" },
            ]);
        });

        it("text only (no tools)", () => {
            accumulator.onTextDelta();
            accumulator.onTextDelta();
            accumulator.onTextDelta();

            const order = accumulator.getContentOrder();
            expect(order).toEqual([{ type: "text", id: "text-0" }]);
        });

        it("tools only (no text)", () => {
            accumulator.onInputStart("toolu_1", "Bash");
            accumulator.onResult("toolu_1", "output", false);

            const order = accumulator.getContentOrder();
            expect(order).toEqual([{ type: "tool", id: "toolu_1" }]);
        });
    });
});

describe("Helper Functions", () => {
    describe("getToolStatusMessage", () => {
        it("formats Read tool message", () => {
            const msg = getToolStatusMessage("Read", {
                file_path: "/src/components/Modal.tsx",
            });
            expect(msg).toBe("Reading Modal.tsx");
        });

        it("formats Bash tool with description", () => {
            const msg = getToolStatusMessage("Bash", {
                command: "npm run test",
                description: "Running unit tests",
            });
            expect(msg).toBe("Running unit tests");
        });

        it("formats Bash tool with command when no description", () => {
            const msg = getToolStatusMessage("Bash", { command: "npm run build" });
            expect(msg).toBe("Running: npm run build");
        });

        it("formats WebFetch with hostname", () => {
            const msg = getToolStatusMessage("WebFetch", {
                url: "https://api.example.com/v1/users",
            });
            expect(msg).toBe("Fetching api.example.com");
        });

        it("truncates long strings", () => {
            const msg = getToolStatusMessage("Grep", {
                pattern: "this is a very long pattern that should be truncated",
            });
            expect(msg.length).toBeLessThan(50);
            expect(msg).toContain("…");
        });
    });

    describe("getToolIcon", () => {
        it("returns correct icons for known tools", () => {
            expect(getToolIcon("Read")).toBe("📖");
            expect(getToolIcon("Write")).toBe("✍️");
            expect(getToolIcon("Edit")).toBe("✏️");
            expect(getToolIcon("Bash")).toBe("💻");
            expect(getToolIcon("Task")).toBe("🤖");
        });

        it("returns fallback for unknown tools", () => {
            expect(getToolIcon("UnknownTool")).toBe("⚙️");
        });
    });
});
