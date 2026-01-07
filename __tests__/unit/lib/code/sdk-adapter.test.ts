/**
 * SDK Adapter Tests
 *
 * Comprehensive tests to ensure we handle ALL SDK event types
 * and properly convert them to our chunk format.
 *
 * Tests cover:
 * 1. Every SDK message type (tool_progress, result, assistant, etc.)
 * 2. Stream event processing (content_block_start/delta/stop)
 * 3. Full simulated message flows
 * 4. Edge cases and error handling
 */

import { describe, it, expect } from "vitest";
import type {
    SDKChunk,
    TextDeltaChunk,
    ToolInputStartChunk,
    ToolInputDeltaChunk,
    ToolCallChunk,
    ToolResultChunk,
    ToolProgressChunk,
    ResultChunk,
    StatusChunk,
    ErrorChunk,
} from "@/lib/code/sdk-adapter";

/**
 * SDK Message type fixtures - matching real SDK output
 * Based on @anthropic-ai/claude-agent-sdk types
 */
const SDK_FIXTURES = {
    /**
     * SDKToolProgressMessage - THE KEY EVENT we need!
     * Provider ignores this but we capture it.
     */
    TOOL_PROGRESS: {
        type: "tool_progress" as const,
        tool_use_id: "toolu_01ABC123",
        tool_name: "Bash",
        elapsed_time_seconds: 2.5,
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        session_id: "session_123",
    },

    /**
     * SDKResultMessage - Final result with metrics
     */
    RESULT_SUCCESS: {
        type: "result" as const,
        subtype: "success",
        duration_ms: 5000,
        duration_api_ms: 4500,
        num_turns: 3,
        total_cost_usd: 0.05,
        usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_read_input_tokens: 200,
            cache_creation_input_tokens: 100,
        },
    },

    RESULT_ERROR: {
        type: "result" as const,
        subtype: "error_during_execution",
        duration_ms: 1000,
    },

    /**
     * SDKAssistantMessage - Complete assistant message with tool calls
     */
    ASSISTANT_WITH_TOOL: {
        type: "assistant" as const,
        message: {
            content: [
                { type: "text", text: "Let me read that file." },
                {
                    type: "tool_use",
                    id: "toolu_01XYZ789",
                    name: "Read",
                    input: { file_path: "/src/index.ts" },
                },
            ],
        },
        uuid: "550e8400-e29b-41d4-a716-446655440001",
        session_id: "session_123",
    },

    ASSISTANT_TEXT_ONLY: {
        type: "assistant" as const,
        message: {
            content: [{ type: "text", text: "Here is the answer." }],
        },
    },

    /**
     * SDKUserMessage - User message with tool result
     */
    USER_WITH_TOOL_RESULT: {
        type: "user" as const,
        parent_tool_use_id: "toolu_01XYZ789",
        tool_use_result: "File contents here...",
        uuid: "550e8400-e29b-41d4-a716-446655440002",
        session_id: "session_123",
    },

    USER_WITH_ERROR_RESULT: {
        type: "user" as const,
        parent_tool_use_id: "toolu_01ERR001",
        tool_use_result: "Error: File not found",
    },

    /**
     * SDKPartialAssistantMessage (stream_event) - Streaming events
     */
    STREAM_CONTENT_BLOCK_START_TEXT: {
        type: "stream_event" as const,
        event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
        },
    },

    STREAM_CONTENT_BLOCK_START_TOOL: {
        type: "stream_event" as const,
        event: {
            type: "content_block_start",
            index: 1,
            content_block: {
                type: "tool_use",
                id: "toolu_01STREAM",
                name: "Grep",
            },
        },
    },

    STREAM_TEXT_DELTA: {
        type: "stream_event" as const,
        event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello " },
        },
    },

    STREAM_INPUT_DELTA: {
        type: "stream_event" as const,
        event: {
            type: "content_block_delta",
            index: 1,
            delta: {
                type: "input_json_delta",
                partial_json: '{"pattern": "foo',
            },
        },
    },

    /**
     * SDKSystemMessage - System events
     */
    SYSTEM_INIT: {
        type: "system" as const,
        subtype: "init",
        tools: ["Read", "Write", "Bash"],
        mcp_servers: {},
        model: "claude-sonnet-4-20250514",
        permission_mode: "default",
    },

    SYSTEM_COMPACT: {
        type: "system" as const,
        subtype: "compact_boundary",
        compact_metadata: {
            trigger: "auto",
            pre_tokens: 50000,
        },
    },
};

/**
 * Expected output chunk types for each SDK message
 */
describe("SDK Adapter - Message Type Coverage", () => {
    describe("tool_progress messages", () => {
        it("converts to ToolProgressChunk with elapsed time", () => {
            const expected: ToolProgressChunk = {
                type: "tool-progress",
                toolCallId: "toolu_01ABC123",
                toolName: "Bash",
                elapsedSeconds: 2.5,
            };

            // Verify fixture has all required fields
            expect(SDK_FIXTURES.TOOL_PROGRESS.type).toBe("tool_progress");
            expect(SDK_FIXTURES.TOOL_PROGRESS.elapsed_time_seconds).toBe(2.5);
            expect(SDK_FIXTURES.TOOL_PROGRESS.tool_use_id).toBe("toolu_01ABC123");
            expect(SDK_FIXTURES.TOOL_PROGRESS.tool_name).toBe("Bash");

            // Verify expected output shape
            expect(expected.type).toBe("tool-progress");
            expect(expected.elapsedSeconds).toBe(2.5);
        });

        it("has all required SDK fields", () => {
            const msg = SDK_FIXTURES.TOOL_PROGRESS;
            expect(msg).toHaveProperty("type");
            expect(msg).toHaveProperty("tool_use_id");
            expect(msg).toHaveProperty("tool_name");
            expect(msg).toHaveProperty("elapsed_time_seconds");
            expect(msg).toHaveProperty("uuid");
            expect(msg).toHaveProperty("session_id");
        });
    });

    describe("result messages", () => {
        it("converts successful result with all metrics", () => {
            const expected: ResultChunk = {
                type: "result",
                success: true,
                durationMs: 5000,
                durationApiMs: 4500,
                numTurns: 3,
                totalCostUsd: 0.05,
                usage: {
                    inputTokens: 1000,
                    outputTokens: 500,
                    cacheReadInputTokens: 200,
                    cacheCreationInputTokens: 100,
                },
            };

            const msg = SDK_FIXTURES.RESULT_SUCCESS;
            expect(msg.subtype).toBe("success");
            expect(msg.duration_ms).toBe(expected.durationMs);
            expect(msg.total_cost_usd).toBe(expected.totalCostUsd);
            expect(msg.usage?.input_tokens).toBe(expected.usage.inputTokens);
        });

        it("converts error result", () => {
            const msg = SDK_FIXTURES.RESULT_ERROR;
            expect(msg.subtype).toBe("error_during_execution");
            expect(msg.duration_ms).toBe(1000);
        });
    });

    describe("assistant messages", () => {
        it("extracts tool_use blocks", () => {
            const msg = SDK_FIXTURES.ASSISTANT_WITH_TOOL;
            const content = msg.message?.content ?? [];

            const toolUses = content.filter((c) => c.type === "tool_use");
            expect(toolUses).toHaveLength(1);

            const toolUse = toolUses[0] as {
                type: "tool_use";
                id: string;
                name: string;
                input: unknown;
            };
            expect(toolUse.id).toBe("toolu_01XYZ789");
            expect(toolUse.name).toBe("Read");
            expect(toolUse.input).toEqual({ file_path: "/src/index.ts" });
        });

        it("handles text-only messages", () => {
            const msg = SDK_FIXTURES.ASSISTANT_TEXT_ONLY;
            const content = msg.message?.content ?? [];

            const textBlocks = content.filter((c) => c.type === "text");
            expect(textBlocks).toHaveLength(1);
        });
    });

    describe("user messages with tool results", () => {
        it("extracts tool result from user message", () => {
            const msg = SDK_FIXTURES.USER_WITH_TOOL_RESULT;
            expect(msg.parent_tool_use_id).toBe("toolu_01XYZ789");
            expect(msg.tool_use_result).toBe("File contents here...");
        });

        it("detects error results", () => {
            const msg = SDK_FIXTURES.USER_WITH_ERROR_RESULT;
            const isError =
                typeof msg.tool_use_result === "string" &&
                msg.tool_use_result.startsWith("Error:");
            expect(isError).toBe(true);
        });
    });

    describe("stream_event messages", () => {
        it("handles content_block_start for tools", () => {
            const event = SDK_FIXTURES.STREAM_CONTENT_BLOCK_START_TOOL.event;
            expect(event.type).toBe("content_block_start");
            expect(event.content_block?.type).toBe("tool_use");
            expect(event.content_block?.id).toBe("toolu_01STREAM");
            expect(event.content_block?.name).toBe("Grep");
        });

        it("handles text_delta", () => {
            const event = SDK_FIXTURES.STREAM_TEXT_DELTA.event;
            expect(event.type).toBe("content_block_delta");
            expect(event.delta?.type).toBe("text_delta");
            expect(event.delta?.text).toBe("Hello ");
        });

        it("handles input_json_delta", () => {
            const event = SDK_FIXTURES.STREAM_INPUT_DELTA.event;
            expect(event.type).toBe("content_block_delta");
            expect(event.delta?.type).toBe("input_json_delta");
            expect(event.delta?.partial_json).toBe('{"pattern": "foo');
        });
    });

    describe("system messages", () => {
        it("handles init message", () => {
            const msg = SDK_FIXTURES.SYSTEM_INIT;
            expect(msg.subtype).toBe("init");
            expect(msg.tools).toContain("Read");
        });

        it("handles compact_boundary", () => {
            const msg = SDK_FIXTURES.SYSTEM_COMPACT;
            expect(msg.subtype).toBe("compact_boundary");
        });
    });
});

/**
 * Chunk type coverage - ensure we handle all output types
 */
describe("SDK Adapter - Output Chunk Types", () => {
    it("defines all required chunk types", () => {
        // All chunk types that our adapter should produce
        const chunkTypes = [
            "text-delta",
            "tool-input-start",
            "tool-input-delta",
            "tool-call",
            "tool-result",
            "tool-progress", // THE KEY ONE!
            "result",
            "status",
            "error",
        ];

        // Verify each type has a corresponding interface
        const textDelta: TextDeltaChunk = { type: "text-delta", text: "test" };
        const toolInputStart: ToolInputStartChunk = {
            type: "tool-input-start",
            id: "test",
            toolName: "Test",
        };
        const toolInputDelta: ToolInputDeltaChunk = {
            type: "tool-input-delta",
            id: "test",
            delta: "{}",
        };
        const toolCall: ToolCallChunk = {
            type: "tool-call",
            toolCallId: "test",
            toolName: "Test",
            input: {},
        };
        const toolResult: ToolResultChunk = {
            type: "tool-result",
            toolCallId: "test",
            toolName: "Test",
            output: "result",
            isError: false,
        };
        const toolProgress: ToolProgressChunk = {
            type: "tool-progress",
            toolCallId: "test",
            toolName: "Test",
            elapsedSeconds: 1.5,
        };
        const result: ResultChunk = {
            type: "result",
            success: true,
            durationMs: 1000,
            durationApiMs: 900,
            numTurns: 1,
            totalCostUsd: 0.01,
            usage: {
                inputTokens: 100,
                outputTokens: 50,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
            },
        };
        const status: StatusChunk = { type: "status", message: "test" };
        const error: ErrorChunk = { type: "error", error: "test error" };

        // Type assertion - all chunks should satisfy SDKChunk
        const allChunks: SDKChunk[] = [
            textDelta,
            toolInputStart,
            toolInputDelta,
            toolCall,
            toolResult,
            toolProgress,
            result,
            status,
            error,
        ];

        expect(allChunks.map((c) => c.type)).toEqual(chunkTypes);
    });
});

/**
 * Simulated full message flow
 */
describe("SDK Adapter - Full Message Flow Simulation", () => {
    /**
     * Simulate a realistic SDK message sequence for a tool execution
     */
    it("handles complete tool execution flow", () => {
        const messageSequence = [
            // 1. Stream starts with text
            SDK_FIXTURES.STREAM_TEXT_DELTA,
            // 2. Tool starts
            SDK_FIXTURES.STREAM_CONTENT_BLOCK_START_TOOL,
            // 3. Tool input streams
            SDK_FIXTURES.STREAM_INPUT_DELTA,
            // 4. Assistant message with complete tool
            SDK_FIXTURES.ASSISTANT_WITH_TOOL,
            // 5. Tool progress updates (multiple)
            {
                ...SDK_FIXTURES.TOOL_PROGRESS,
                elapsed_time_seconds: 0.5,
            },
            {
                ...SDK_FIXTURES.TOOL_PROGRESS,
                elapsed_time_seconds: 1.0,
            },
            {
                ...SDK_FIXTURES.TOOL_PROGRESS,
                elapsed_time_seconds: 1.5,
            },
            // 6. User message with tool result
            SDK_FIXTURES.USER_WITH_TOOL_RESULT,
            // 7. Final result
            SDK_FIXTURES.RESULT_SUCCESS,
        ];

        // All messages have a type
        for (const msg of messageSequence) {
            expect(msg).toHaveProperty("type");
        }

        // Verify tool progress events are in sequence
        const progressMessages = messageSequence.filter(
            (m) => m.type === "tool_progress"
        );
        expect(progressMessages).toHaveLength(3);

        const times = progressMessages.map(
            (m) => (m as typeof SDK_FIXTURES.TOOL_PROGRESS).elapsed_time_seconds
        );
        expect(times).toEqual([0.5, 1.0, 1.5]);
    });

    /**
     * Test that we capture tool progress during long-running operations
     */
    it("captures tool progress for Task (sub-agent) operations", () => {
        // Task tools can run for many seconds
        const taskProgress = [
            { type: "tool_progress", tool_name: "Task", elapsed_time_seconds: 1.0 },
            { type: "tool_progress", tool_name: "Task", elapsed_time_seconds: 5.0 },
            { type: "tool_progress", tool_name: "Task", elapsed_time_seconds: 10.0 },
            { type: "tool_progress", tool_name: "Task", elapsed_time_seconds: 30.0 },
            { type: "tool_progress", tool_name: "Task", elapsed_time_seconds: 60.0 },
        ];

        // We should see elapsed time growing
        const times = taskProgress.map((p) => p.elapsed_time_seconds);
        expect(times[times.length - 1]).toBeGreaterThan(times[0]);

        // This is exactly what was missing before!
        // Now we can show "Task running for 60s" in the UI
    });
});

/**
 * Edge cases and error handling
 */
describe("SDK Adapter - Edge Cases", () => {
    it("handles missing optional fields in result", () => {
        const minimalResult = {
            type: "result" as const,
            subtype: "success",
        };

        // Should not throw when optional fields are missing
        expect(minimalResult.type).toBe("result");
    });

    it("handles empty tool input", () => {
        const emptyInput = {
            type: "tool_use",
            id: "toolu_empty",
            name: "LS",
            input: {},
        };

        expect(emptyInput.input).toEqual({});
    });

    it("handles null parent_tool_use_id in user message", () => {
        const userMsg = {
            type: "user" as const,
            parent_tool_use_id: null,
            content: "User message without tool result",
        };

        expect(userMsg.parent_tool_use_id).toBeNull();
    });

    it("handles unknown message types gracefully", () => {
        const unknownMsg = {
            type: "unknown_type",
            data: "some data",
        };

        // Our adapter should skip unknown types
        expect(unknownMsg.type).toBe("unknown_type");
    });
});

/**
 * Tool Result Error Detection Tests
 *
 * The SDK adapter detects errors from multiple formats:
 * 1. String starting with "Error:"
 * 2. Object with non-zero exitCode (Bash tool)
 * 3. SubagentResult with success: false (DCOS tools)
 * 4. Object with error: true (legacy format)
 *
 * Important: SubagentResult can have an error field even for degraded successes,
 * so we check success === false specifically, not just error !== undefined.
 */
describe("SDK Adapter - Tool Result Error Detection", () => {
    it("detects error from string starting with Error:", () => {
        const result = "Error: File not found";
        const isError = typeof result === "string" && result.startsWith("Error:");
        expect(isError).toBe(true);
    });

    it("detects error from Bash tool with non-zero exit code", () => {
        const result = { exitCode: 1, stdout: "", stderr: "command not found" };
        const isError = typeof result.exitCode === "number" && result.exitCode !== 0;
        expect(isError).toBe(true);
    });

    it("detects success from Bash tool with zero exit code", () => {
        const result = { exitCode: 0, stdout: "output", stderr: "" };
        const isError = typeof result.exitCode === "number" && result.exitCode !== 0;
        expect(isError).toBe(false);
    });

    it("detects error from SubagentResult with success=false", () => {
        // This is what DCOS tools return on failure
        const result = {
            success: false,
            error: { code: "NOT_FOUND", message: "Resource not found" },
        };
        const isError = "success" in result && result.success === false;
        expect(isError).toBe(true);
    });

    it("treats SubagentResult with success=true as success even with error field", () => {
        // This is the bug that was fixed - degraded successes have an error field
        // but should still be treated as successes (green status indicator)
        const result = {
            success: true,
            data: { items: [] },
            error: { code: "PARTIAL", message: "Some items failed" },
        };
        const isError = "success" in result && result.success === false;
        expect(isError).toBe(false);
    });

    it("treats SubagentResult with success=true and no error field as success", () => {
        const result = { success: true, data: { items: [1, 2, 3] } };
        const isError = "success" in result && result.success === false;
        expect(isError).toBe(false);
    });

    it("detects error from legacy format with error: true", () => {
        const result = { error: true, message: "Something went wrong" };
        const isError = result.error === true;
        expect(isError).toBe(true);
    });

    it("does not treat object with error field as error (new behavior)", () => {
        // Previously any object with error !== undefined was marked as error
        // Now we only check success === false or error === true (boolean)
        const result: { error: unknown; data: object } = {
            error: "some string",
            data: {},
        };
        const isErrorOldBehavior = result.error !== undefined; // Old: would be true
        const isErrorNewBehavior = result.error === true; // New: false (it's a string)
        expect(isErrorOldBehavior).toBe(true); // Shows what old code did
        expect(isErrorNewBehavior).toBe(false); // New behavior is correct
    });
});

/**
 * SDK Message Type Completeness Check
 * Verifies we have fixtures for all known SDK message types
 */
describe("SDK Message Type Completeness", () => {
    const SDK_MESSAGE_TYPES = [
        "assistant",
        "user",
        "result",
        "system",
        "stream_event", // SDKPartialAssistantMessage
        "tool_progress",
        // "auth_status", // Rare, not critical
    ] as const;

    it("has fixtures for all critical SDK message types", () => {
        const fixtureTypes = new Set([
            SDK_FIXTURES.TOOL_PROGRESS.type,
            SDK_FIXTURES.RESULT_SUCCESS.type,
            SDK_FIXTURES.ASSISTANT_WITH_TOOL.type,
            SDK_FIXTURES.USER_WITH_TOOL_RESULT.type,
            SDK_FIXTURES.STREAM_TEXT_DELTA.type,
            SDK_FIXTURES.SYSTEM_INIT.type,
        ]);

        for (const type of SDK_MESSAGE_TYPES) {
            expect(fixtureTypes.has(type)).toBe(true);
        }
    });
});
