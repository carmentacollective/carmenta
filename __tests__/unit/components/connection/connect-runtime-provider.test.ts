/**
 * Tests for ConnectRuntimeProvider pure functions
 *
 * Tests message conversion (toAIMessage) and error parsing (parseErrorMessage).
 * These are pure functions that transform data without side effects.
 */

import { describe, it, expect } from "vitest";
import {
    toAIMessage,
    parseErrorMessage,
} from "@/components/connection/connect-runtime-provider";
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

        it("handles empty text content", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-empty-text",
                role: "user",
                parts: [{ type: "text", text: "" }],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({ type: "text", text: "" });
        });

        it("handles missing text field by defaulting to empty string", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-missing-text",
                role: "user",
                parts: [{ type: "text" } as any],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({ type: "text", text: "" });
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

        it("handles reasoning without providerMetadata", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-reasoning-no-meta",
                role: "assistant",
                parts: [{ type: "reasoning", text: "Simple thought" }],
            };

            const result = toAIMessage(dbMessage);

            expect((result.parts[0] as any).providerMetadata).toBeUndefined();
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
                name: "file",
            });
        });

        it("falls back to mimeType when mediaType is missing", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-file-mimetype",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "https://storage.example.com/doc.pdf",
                        mimeType: "application/pdf",
                        name: "doc.pdf",
                    } as any,
                ],
            };

            const result = toAIMessage(dbMessage);

            expect((result.parts[0] as any).mediaType).toBe("application/pdf");
        });

        it("provides default values for completely empty file parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-file-minimal",
                role: "user",
                parts: [{ type: "file" } as any],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({
                type: "file",
                url: "",
                mediaType: "",
                name: "file",
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

        it("defaults to input-available when state is missing", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-no-state",
                role: "assistant",
                parts: [
                    {
                        type: "tool-test",
                        toolCallId: "call-no-state",
                        input: { foo: "bar" },
                    } as any,
                ],
            };

            const result = toAIMessage(dbMessage);

            expect((result.parts[0] as any).state).toBe("input-available");
        });

        it("handles missing toolCallId by defaulting to empty string", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-tool-no-id",
                role: "assistant",
                parts: [
                    {
                        type: "tool-test",
                        state: "input-available",
                        input: {},
                    } as any,
                ],
            };

            const result = toAIMessage(dbMessage);

            expect((result.parts[0] as any).toolCallId).toBe("");
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

        it("handles data parts with missing fields", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-data-minimal",
                role: "assistant",
                parts: [
                    {
                        type: "data-research",
                    } as any,
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({
                type: "data-research",
                id: "",
                data: {},
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

    describe("edge cases - null and invalid parts", () => {
        it("filters out null parts from stream resume", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-with-nulls",
                role: "assistant",
                parts: [
                    null as any,
                    { type: "text", text: "Valid text" },
                    undefined as any,
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(1);
            expect(result.parts[0]).toEqual({ type: "text", text: "Valid text" });
        });

        it("filters out non-object parts", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-with-primitives",
                role: "assistant",
                parts: ["string" as any, 123 as any, { type: "text", text: "Valid" }],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(1);
            expect(result.parts[0]).toEqual({ type: "text", text: "Valid" });
        });

        it("filters out objects without type field", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-no-type",
                role: "assistant",
                parts: [
                    { text: "No type field" } as any,
                    { type: "text", text: "Has type" },
                ],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(1);
            expect(result.parts[0]).toEqual({ type: "text", text: "Has type" });
        });

        it("handles empty parts array", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-empty-parts",
                role: "assistant",
                parts: [],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts).toHaveLength(0);
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

        it("handles unknown type with missing text", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-unknown-no-text",
                role: "assistant",
                parts: [{ type: "mystery-type" as any }],
            };

            const result = toAIMessage(dbMessage);

            expect(result.parts[0]).toEqual({
                type: "text",
                text: "",
            });
        });
    });

    describe("role preservation", () => {
        it("preserves user role", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-user",
                role: "user",
                parts: [{ type: "text", text: "Hello" }],
            };

            expect(toAIMessage(dbMessage).role).toBe("user");
        });

        it("preserves assistant role", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-assistant",
                role: "assistant",
                parts: [{ type: "text", text: "Hello" }],
            };

            expect(toAIMessage(dbMessage).role).toBe("assistant");
        });

        it("preserves system role", () => {
            const dbMessage: UIMessageLike = {
                id: "msg-system",
                role: "system" as any,
                parts: [{ type: "text", text: "System message" }],
            };

            expect(toAIMessage(dbMessage).role).toBe("system");
        });
    });
});

describe("parseErrorMessage", () => {
    describe("undefined and empty input", () => {
        it("returns default message for undefined input", () => {
            expect(parseErrorMessage(undefined)).toBe(
                "We couldn't complete that request."
            );
        });

        it("returns default message for empty string", () => {
            expect(parseErrorMessage("")).toBe("We couldn't complete that request.");
        });

        it("passes through whitespace-only string as-is", () => {
            // Implementation only checks for falsy values, not whitespace-only
            // The trimmed check happens after the falsy check
            expect(parseErrorMessage("   ")).toBe("   ");
        });
    });

    describe("provider and API errors", () => {
        it("handles thinking block errors with retry suggestion", () => {
            const msg =
                "AI_APICallError: Provider returned error - thinking block issue";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "We hit a conversation glitch. Try sending your message again."
            );
        });

        it("handles rate limit errors (429)", () => {
            const msg = "Provider returned error: rate limit exceeded (429)";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "The model is busy right now. Give it a moment and try again."
            );
        });

        it("handles overloaded errors (503)", () => {
            const msg = "Provider returned error: service overloaded 503";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "High demand right now. Try a different model or wait a moment."
            );
        });

        it("handles timeout errors", () => {
            const msg = "Provider returned error: request timed out";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "The response took too long. Try a simpler question or a faster model."
            );
        });

        it("handles generic provider errors", () => {
            const msg = "AI_APICallError: Unknown provider error";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "We couldn't reach the model. Try again or switch models."
            );
        });
    });

    describe("connection and network errors", () => {
        it("handles fetch failed errors", () => {
            const msg = "Fetch failed: network error";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "Connection dropped. Check your network and try again."
            );
        });

        it("handles connection refused errors", () => {
            const msg = "ECONNREFUSED - could not connect to server";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "Connection dropped. Check your network and try again."
            );
        });

        it("handles generic network errors", () => {
            const msg = "Network error occurred";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "Connection dropped. Check your network and try again."
            );
        });
    });

    describe("JSON error responses", () => {
        it("extracts error message from JSON response", () => {
            const msg = JSON.stringify({ error: "Invalid API key" });

            const result = parseErrorMessage(msg);

            // Recursively parses - the inner message gets returned
            expect(result).toBe("Invalid API key");
        });

        it("handles nested JSON errors with provider messages", () => {
            const msg = JSON.stringify({
                error: "Provider returned error: rate limit",
            });

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "The model is busy right now. Give it a moment and try again."
            );
        });

        it("handles invalid JSON gracefully", () => {
            const msg = "{ invalid json";

            const result = parseErrorMessage(msg);

            // Falls through to general handling
            expect(result).toBe("{ invalid json");
        });

        it("handles JSON without error field by passing through", () => {
            const msg = JSON.stringify({ message: "Something happened" });

            const result = parseErrorMessage(msg);

            // Falls through - no `error` field in JSON, and "error" not in content
            expect(result).toBe(msg);
        });
    });

    describe("HTML error pages", () => {
        it("handles 404 HTML errors", () => {
            const msg = "<!DOCTYPE html><html><h1>404</h1></html>";

            const result = parseErrorMessage(msg);

            expect(result).toBe("We lost the thread. Refresh to continue.");
        });

        it("handles 500 HTML errors", () => {
            const msg = "<!DOCTYPE html><html><h1>500</h1></html>";

            const result = parseErrorMessage(msg);

            expect(result).toContain("Something broke on our end");
        });

        it("handles other status codes in HTML", () => {
            const msg = "<!DOCTYPE html><html><h1>502</h1></html>";

            const result = parseErrorMessage(msg);

            expect(result).toContain("Something unexpected happened");
        });

        it("handles HTML without status code", () => {
            const msg = "<!DOCTYPE html><html><body>Error</body></html>";

            const result = parseErrorMessage(msg);

            expect(result).toContain("Something unexpected happened");
        });

        it("handles html tag without DOCTYPE", () => {
            const msg = "<html><h1>500</h1></html>";

            const result = parseErrorMessage(msg);

            expect(result).toContain("Something broke on our end");
        });
    });

    describe("long messages (stack traces)", () => {
        it("handles very long error messages with generic response", () => {
            const longMessage = "Error: Something went wrong\n" + "a".repeat(250);

            const result = parseErrorMessage(longMessage);

            expect(result).toContain("Something went sideways");
        });
    });

    describe("generic error patterns", () => {
        it("appends retry suggestion to short error messages", () => {
            const msg = "Model error";

            const result = parseErrorMessage(msg);

            expect(result).toBe("Model error. Try again or switch models.");
        });

        it("preserves helpful error messages with please", () => {
            const msg = "Please check your input and try again";

            const result = parseErrorMessage(msg);

            // Contains "please" so preserved as-is
            expect(result).toBe("Please check your input and try again");
        });

        it("passes through plain messages without error pattern", () => {
            const msg = "Something went wrong";

            const result = parseErrorMessage(msg);

            // No "error" in message, passed through
            expect(result).toBe("Something went wrong");
        });
    });

    describe("case insensitivity", () => {
        it("handles uppercase PROVIDER RETURNED ERROR", () => {
            const msg = "PROVIDER RETURNED ERROR: timeout";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "The response took too long. Try a simpler question or a faster model."
            );
        });

        it("handles mixed case Network Error", () => {
            const msg = "NETWORK ERROR occurred";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "Connection dropped. Check your network and try again."
            );
        });
    });

    describe("whitespace handling", () => {
        it("trims leading and trailing whitespace", () => {
            const msg = "   Provider returned error: overloaded   ";

            const result = parseErrorMessage(msg);

            expect(result).toBe(
                "High demand right now. Try a different model or wait a moment."
            );
        });
    });
});
