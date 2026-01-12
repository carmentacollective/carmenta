/**
 * Integration test for CARMENTA-1W: Stream onFinish reliability
 *
 * This test validates the correct pattern for capturing response data
 * when using toUIMessageStream() with createUIMessageStream().
 *
 * Key insight: Use onFinish on toUIMessageStream(), not streamText().
 * The toUIMessageStream onFinish provides the responseMessage with parts
 * already formatted for UI consumption.
 *
 * @see https://github.com/vercel/ai/issues/7900
 * @see https://carmenta-collective-6a.sentry.io/issues/7181164188/
 */
import { describe, it, expect } from "vitest";
import { createUIMessageStream, JsonToSseTransformStream, streamText } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";

describe("CARMENTA-1W: Stream onFinish pattern", () => {
    const mockModel = new MockLanguageModelV3({
        doStream: async () => ({
            stream: simulateReadableStream({
                chunks: [
                    { type: "text-start", id: "text-1" },
                    { type: "text-delta", id: "text-1", delta: "Hello world" },
                    { type: "text-end", id: "text-1" },
                    {
                        type: "finish",
                        finishReason: { unified: "stop", raw: undefined },
                        usage: {
                            inputTokens: {
                                total: 10,
                                noCache: undefined,
                                cacheRead: undefined,
                                cacheWrite: undefined,
                            },
                            outputTokens: {
                                total: 5,
                                text: undefined,
                                reasoning: undefined,
                            },
                        },
                    },
                ],
            }),
        }),
    });

    it("CORRECT: Use onFinish on toUIMessageStream for reliable data capture", async () => {
        let finalParts: unknown[] = [];

        // Track onFinish completion
        let resolveOnFinish: () => void;
        const onFinishComplete = new Promise<void>((r) => (resolveOnFinish = r));

        const streamResult = streamText({
            model: mockModel,
            messages: [{ role: "user", content: "Hello" }],
            // NOTE: Don't put onFinish here for data capture
        });

        // Put onFinish on toUIMessageStream - this is the correct pattern
        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                writer.merge(
                    streamResult.toUIMessageStream({
                        onFinish: async ({ responseMessage }) => {
                            finalParts = responseMessage.parts;
                            resolveOnFinish();
                        },
                    })
                );
            },
        });

        const reader = stream.pipeThrough(new JsonToSseTransformStream()).getReader();
        while (!(await reader.read()).done);

        // Wait for onFinish to complete
        await onFinishComplete;

        // Parts are populated correctly
        expect(finalParts.length).toBeGreaterThan(0);
    });

    it("validates the fix matches production code pattern", async () => {
        // This test mirrors the exact pattern in background-response.ts
        let resolveOnFinish: () => void;
        const onFinishComplete = new Promise<void>((r) => (resolveOnFinish = r));
        let finalResponseParts: unknown[] = [];

        const streamResult = streamText({
            model: mockModel,
            messages: [{ role: "user", content: "Hello" }],
        });

        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                writer.merge(
                    streamResult.toUIMessageStream({
                        onFinish: async ({ responseMessage }) => {
                            finalResponseParts = responseMessage.parts;
                            resolveOnFinish();
                        },
                    })
                );
            },
        });

        // Simulate Redis streaming pipeline
        const sseStream = stream.pipeThrough(new JsonToSseTransformStream());
        const reader = sseStream.getReader();
        while (true) {
            const { done } = await reader.read();
            if (done) break;
        }

        // Wait for onFinish to complete before checking parts
        await onFinishComplete;

        // Verify we captured the response parts
        expect(finalResponseParts.length).toBeGreaterThan(0);
        // Parts include step-start and text parts
        const textPart = finalResponseParts.find(
            (p) => (p as { type: string }).type === "text"
        );
        expect(textPart).toBeDefined();
    });
});
