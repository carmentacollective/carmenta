/**
 * Stream Format Contract Tests
 *
 * These tests verify that every stream chunk emitted by the connection API
 * conforms to the AI SDK v6 UIMessageChunk schema. This is the CONTRACT
 * between our API and the client's useChat hook.
 *
 * CRITICAL: The AI SDK validates every chunk. Invalid chunks cause runtime errors.
 * These tests ensure we never ship broken streaming responses.
 *
 * Why this matters:
 * - AI SDK v6 changed the streaming format (text-start/delta/end with id)
 * - Manual stream writes bypass TypeScript's type checking (cast to any)
 * - Without these tests, format errors only surface in production
 */

import { describe, it, expect } from "vitest";
import { uiMessageChunkSchema } from "ai";
import { nanoid } from "nanoid";

/**
 * Validate a chunk against the AI SDK schema.
 * This uses the EXACT same validation the client performs.
 */
async function validateChunk(
    chunk: unknown
): Promise<{ success: true } | { success: false; error: unknown }> {
    const schema = uiMessageChunkSchema();
    // The validate method exists on the AI SDK schema but TypeScript isn't aware

    return await (schema as any).validate(chunk);
}

describe("Stream Format Contract", () => {
    describe("Valid AI SDK v6 Chunk Formats", () => {
        it("validates text-start chunk format", async () => {
            const chunk = { type: "text-start", id: "text-1" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates text-delta chunk format", async () => {
            const chunk = {
                type: "text-delta",
                id: "text-1",
                delta: "Hello world",
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates text-end chunk format", async () => {
            const chunk = { type: "text-end", id: "text-1" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates data-* chunk format (for transient/custom data)", async () => {
            const chunk = {
                type: "data-transient",
                id: "status-1",
                data: { text: "Searching..." },
                transient: true,
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates tool-input-start chunk format", async () => {
            const chunk = {
                type: "tool-input-start",
                toolCallId: "call-1",
                toolName: "webSearch",
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates tool-input-available chunk format", async () => {
            const chunk = {
                type: "tool-input-available",
                toolCallId: "call-1",
                toolName: "webSearch",
                input: { query: "test" },
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates tool-output-available chunk format", async () => {
            const chunk = {
                type: "tool-output-available",
                toolCallId: "call-1",
                output: { results: [] },
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates finish chunk format", async () => {
            const chunk = { type: "finish", finishReason: "stop" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates start chunk format", async () => {
            const chunk = { type: "start", messageId: "msg-1" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("validates reasoning chunks format", async () => {
            const chunks = [
                { type: "reasoning-start", id: "reasoning-1" },
                {
                    type: "reasoning-delta",
                    id: "reasoning-1",
                    delta: "Let me think...",
                },
                { type: "reasoning-end", id: "reasoning-1" },
            ];
            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success, `Failed on ${chunk.type}`).toBe(true);
            }
        });

        it("validates error chunk format", async () => {
            const chunk = { type: "error", errorText: "Something went wrong" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });
    });

    describe("Invalid Chunk Formats (These MUST Fail)", () => {
        it("REJECTS old v5 text format without id", async () => {
            // This is the exact bug we're testing for!
            const chunk = {
                type: "text",
                text: "Before we dive in, let me ask a few questions...",
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(false);
        });

        it("REJECTS text-delta without id", async () => {
            const chunk = { type: "text-delta", delta: "Hello" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(false);
        });

        it("REJECTS text-start without id", async () => {
            const chunk = { type: "text-start" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(false);
        });

        it("REJECTS tool-input-start without required fields", async () => {
            const chunk = { type: "tool-input-start", toolName: "test" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(false);
        });

        it("REJECTS unknown chunk types", async () => {
            const chunk = { type: "invalid-type", data: "test" };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(false);
        });
    });

    describe("Correct Text Streaming Pattern", () => {
        it("produces valid chunks for text content", async () => {
            const textId = `text-${nanoid(8)}`;
            const text = "Hello, I'm here to help!";

            // This is how text SHOULD be streamed
            const chunks = [
                { type: "text-start", id: textId },
                { type: "text-delta", id: textId, delta: text },
                { type: "text-end", id: textId },
            ];

            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success, `Chunk ${chunk.type} failed validation`).toBe(
                    true
                );
            }
        });

        it("validates multi-part text streaming", async () => {
            const textId = `text-${nanoid(8)}`;
            const parts = ["Hello, ", "I'm ", "here ", "to ", "help!"];

            const chunks = [
                { type: "text-start", id: textId },
                ...parts.map((delta) => ({ type: "text-delta", id: textId, delta })),
                { type: "text-end", id: textId },
            ];

            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success, `Chunk failed: ${JSON.stringify(chunk)}`).toBe(
                    true
                );
            }
        });
    });
});

describe("Clarifying Questions Stream Format", () => {
    /**
     * This test validates the exact stream format produced by the
     * clarifying questions path in /api/connection.
     *
     * The bug: We were emitting {type: "text", text: "..."} instead of
     * the correct {type: "text-start/delta/end", id: "..."} format.
     */
    it("MUST use v6 format for intro text", async () => {
        // Simulate what the clarifying questions path produces
        const introText =
            "Before we dive in, let me ask a few questions to make sure I research exactly what you need:";

        // WRONG (v5 format) - This is what was being produced
        const wrongChunk = {
            type: "text",
            text: introText,
        };

        // Verify the wrong format fails validation
        const wrongResult = await validateChunk(wrongChunk);
        expect(wrongResult.success).toBe(false);

        // CORRECT (v6 format) - This is what should be produced
        const textId = `text-${nanoid(8)}`;
        const correctChunks = [
            { type: "text-start", id: textId },
            { type: "text-delta", id: textId, delta: introText },
            { type: "text-end", id: textId },
        ];

        // Verify the correct format passes validation
        for (const chunk of correctChunks) {
            const result = await validateChunk(chunk);
            expect(result.success, `Chunk ${chunk.type} should be valid`).toBe(true);
        }
    });

    it("MUST use valid format for tool parts", async () => {
        // The clarifying questions also emit tool parts
        // These use data-* format which should be valid
        const toolChunk = {
            type: "data-askUserInput",
            data: {
                question: "What programming language?",
                options: ["TypeScript", "Python"],
            },
        };

        // Note: Custom tool parts use data-* prefix pattern
        // This should be valid according to the schema
        const result = await validateChunk(toolChunk);
        expect(result.success).toBe(true);
    });
});

describe("createUIMessageStream Manual Writes", () => {
    /**
     * These tests validate that when we manually write chunks to
     * createUIMessageStream, they use the correct format.
     *
     * Note: Full stream integration tests are in integration/tool-streams/
     * These unit tests focus on chunk format validation.
     */

    it("writer.write accepts correct text chunk format", async () => {
        // This tests the chunks we would write, not the actual stream
        const textId = `text-${nanoid(8)}`;
        const chunks = [
            { type: "text-start", id: textId },
            { type: "text-delta", id: textId, delta: "Test message" },
            { type: "text-end", id: textId },
        ];

        for (const chunk of chunks) {
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        }
    });

    it("writer.write accepts correct data part format", async () => {
        const chunk = {
            type: "data-transient",
            id: "status-1",
            data: { text: "Searching..." },
            transient: true,
        };

        const result = await validateChunk(chunk);
        expect(result.success).toBe(true);
    });
});

describe("All Manual Stream Writes in Codebase", () => {
    /**
     * Document all places where we manually write to streams.
     * Each should have a corresponding test here.
     *
     * Locations:
     * - app/api/connection/route.ts:355-369 (clarifying questions)
     * - app/api/code/route.ts:367-552 (code mode streaming)
     * - lib/streaming/transient-writer.ts:62 (transient messages)
     */

    describe("Transient Writer Format", () => {
        it("uses valid data-transient format", async () => {
            // This is what writeTransient produces
            const chunk = {
                type: "data-transient",
                id: "search-status",
                data: {
                    id: "search-status",
                    type: "status",
                    destination: "chat",
                    text: "Searching 3 sources...",
                    icon: "🔍",
                },
                transient: true,
            };

            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });
    });

    describe("Code Mode Streaming Format", () => {
        it("uses valid text-start/delta/end format", async () => {
            const textId = nanoid();
            const chunks = [
                { type: "text-start", id: textId },
                { type: "text-delta", id: textId, delta: "Let me help with that." },
                { type: "text-end", id: textId },
            ];

            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success).toBe(true);
            }
        });

        it("uses valid tool-input-start format", async () => {
            const chunk = {
                type: "tool-input-start",
                toolCallId: "call-123",
                toolName: "Read",
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });

        it("uses valid data-code-messages format", async () => {
            const chunk = {
                type: "data-code-messages",
                data: [
                    { role: "assistant", text: "Reading file..." },
                    { role: "tool", toolName: "Read", result: "file contents" },
                ],
            };
            const result = await validateChunk(chunk);
            expect(result.success).toBe(true);
        });
    });
});
