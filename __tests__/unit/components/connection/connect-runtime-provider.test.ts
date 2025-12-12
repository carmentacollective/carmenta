/**
 * Tests for ConnectRuntimeProvider message conversion
 *
 * These tests verify that messages loaded from the database are correctly
 * converted to the AI SDK UIMessage format, preserving all part types.
 */

import { describe, it, expect } from "vitest";
import { toAIMessage } from "@/components/connection/connect-runtime-provider";
import type { UIMessageLike } from "@/lib/db/message-mapping";

describe("toAIMessage", () => {
    describe("text parts", () => {
        it("preserves text parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Hello, world!" }],
            };

            const result = toAIMessage(dbMessage);

            expect(result).toEqual({
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Hello, world!" }],
            });
        });
    });

    describe("reasoning parts", () => {
        it("preserves reasoning parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-2",
                role: "assistant",
                parts: [{ type: "reasoning", text: "Let me think about this..." }],
            };

            const result = toAIMessage(dbMessage);

            expect(result).toEqual({
                id: "msg-2",
                role: "assistant",
                parts: [{ type: "reasoning", text: "Let me think about this..." }],
            });
        });

        it("preserves providerMetadata with reasoning parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-2b",
                role: "assistant",
                parts: [
                    {
                        type: "reasoning",
                        text: "Thinking deeply...",
                        providerMetadata: {
                            anthropic: {
                                cacheControl: { type: "ephemeral" },
                            },
                        },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect((result.parts[0] as any).providerMetadata).toEqual({
                anthropic: { cacheControl: { type: "ephemeral" } },
            });
        });
    });

    describe("file parts", () => {
        it("preserves file parts when messages are reloaded from database", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-3",
                role: "user",
                parts: [
                    { type: "text", text: "Here's the screenshot:" },
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/image.png",
                        mediaType: "image/png",
                        name: "screenshot.png",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(2);
            expect(result.parts[1]).toEqual({
                type: "file",
                url: "https://storage.example.com/user123/image.png",
                mediaType: "image/png",
                name: "screenshot.png",
            });
        });

        it("handles file parts with missing optional fields gracefully", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-6",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://storage.example.com/user123/file.pdf",
                        mediaType: "application/pdf",
                        name: "",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({
                type: "file",
                url: "https://storage.example.com/user123/file.pdf",
                mediaType: "application/pdf",
                name: "file", // Empty name is converted to default "file"
            });
        });
    });

    describe("tool parts", () => {
        it("preserves tool-webSearch parts with output", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-1",
                role: "assistant",
                parts: [
                    {
                        type: "tool-webSearch",
                        toolCallId: "call-123",
                        state: "output-available",
                        input: { query: "weather in Tokyo" },
                        output: {
                            results: [
                                { title: "Tokyo Weather", url: "https://example.com" },
                            ],
                        },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            const part = result.parts[0] as any;
            expect(part.type).toBe("tool-webSearch");
            expect(part.toolCallId).toBe("call-123");
            expect(part.state).toBe("output-available");
            expect(part.output).toEqual({
                results: [{ title: "Tokyo Weather", url: "https://example.com" }],
            });
        });

        it("preserves tool-compareOptions parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-2",
                role: "assistant",
                parts: [
                    {
                        type: "tool-compareOptions",
                        toolCallId: "call-456",
                        state: "output-available",
                        input: {
                            title: "Phone Comparison",
                            options: [
                                { name: "iPhone", attributes: { price: "$999" } },
                                { name: "Android", attributes: { price: "$799" } },
                            ],
                        },
                        output: {
                            title: "Phone Comparison",
                            options: [
                                { name: "iPhone", attributes: { price: "$999" } },
                                { name: "Android", attributes: { price: "$799" } },
                            ],
                        },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            const part = result.parts[0] as any;
            expect(part.type).toBe("tool-compareOptions");
            expect(part.output.title).toBe("Phone Comparison");
            expect(part.output.options).toHaveLength(2);
        });

        it("preserves tool-fetchPage parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-3",
                role: "assistant",
                parts: [
                    {
                        type: "tool-fetchPage",
                        toolCallId: "call-789",
                        state: "output-available",
                        input: { url: "https://example.com/article" },
                        output: {
                            title: "Article Title",
                            content: "Article content here...",
                            url: "https://example.com/article",
                        },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            const part = result.parts[0] as any;
            expect(part.type).toBe("tool-fetchPage");
            expect(part.output.title).toBe("Article Title");
        });

        it("preserves tool-deepResearch parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-4",
                role: "assistant",
                parts: [
                    {
                        type: "tool-deepResearch",
                        toolCallId: "call-research",
                        state: "output-available",
                        input: { objective: "Research AI trends" },
                        output: {
                            summary: "AI is evolving rapidly...",
                            findings: ["Finding 1", "Finding 2"],
                            sources: ["https://source1.com", "https://source2.com"],
                        },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            const part = result.parts[0] as any;
            expect(part.type).toBe("tool-deepResearch");
            expect(part.output.summary).toContain("AI");
        });

        it("handles tool parts without output (input-available state)", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-5",
                role: "assistant",
                parts: [
                    {
                        type: "tool-webSearch",
                        toolCallId: "call-pending",
                        state: "input-available",
                        input: { query: "pending search" },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            const part = result.parts[0] as any;
            expect(part.type).toBe("tool-webSearch");
            expect(part.state).toBe("input-available");
            expect(part.output).toBeUndefined();
        });

        it("preserves tool error text when present", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-error",
                role: "assistant",
                parts: [
                    {
                        type: "tool-webSearch",
                        toolCallId: "call-failed",
                        state: "output-available",
                        input: { query: "failed search" },
                        errorText: "Search service unavailable",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect((result.parts[0] as any).errorText).toBe(
                "Search service unavailable"
            );
        });
    });

    describe("data parts", () => {
        it("preserves data-comparison parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-data-1",
                role: "assistant",
                parts: [
                    {
                        type: "data-comparison",
                        id: "comparison-123",
                        data: {
                            title: "Product Comparison",
                            items: [{ name: "A" }, { name: "B" }],
                        },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({
                type: "data-comparison",
                id: "comparison-123",
                data: {
                    title: "Product Comparison",
                    items: [{ name: "A" }, { name: "B" }],
                },
            });
        });
    });

    describe("step-start parts", () => {
        it("preserves step-start parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-step",
                role: "assistant",
                parts: [{ type: "step-start" }],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({ type: "step-start" });
        });
    });

    describe("mixed content", () => {
        it("handles complex messages with multiple part types", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-complex",
                role: "assistant",
                parts: [
                    { type: "reasoning", text: "Let me search for this..." },
                    {
                        type: "tool-webSearch",
                        toolCallId: "call-1",
                        state: "output-available",
                        input: { query: "test" },
                        output: { results: [] },
                    },
                    { type: "text", text: "Based on my search, here's what I found:" },
                    {
                        type: "data-comparison",
                        id: "comp-1",
                        data: { items: [] },
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(4);
            expect(result.parts[0].type).toBe("reasoning");
            expect(result.parts[1].type).toBe("tool-webSearch");
            expect(result.parts[2].type).toBe("text");
            expect(result.parts[3].type).toBe("data-comparison");
        });

        it("handles user messages with text and files", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-user-mixed",
                role: "user",
                parts: [
                    { type: "text", text: "What is in these images?" },
                    {
                        type: "file",
                        url: "https://storage.example.com/img1.png",
                        mediaType: "image/png",
                        name: "image1.png",
                    },
                    {
                        type: "file",
                        url: "https://storage.example.com/img2.jpg",
                        mediaType: "image/jpeg",
                        name: "image2.jpg",
                    },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(3);
            expect(result.parts[0].type).toBe("text");
            expect(result.parts[1].type).toBe("file");
            expect(result.parts[2].type).toBe("file");
        });
    });

    describe("unknown types", () => {
        it("falls back to text for truly unknown types", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-unknown",
                role: "assistant",

                parts: [
                    { type: "unknown-future-type" as any, text: "fallback content" },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({
                type: "text",
                text: "fallback content",
            });
        });
    });
});
