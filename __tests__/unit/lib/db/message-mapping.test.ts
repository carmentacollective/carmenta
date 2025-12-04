/**
 * Message Mapping Tests
 *
 * Tests for converting between UI message format and database format.
 * Focuses on edge cases and fallback behavior.
 */

import { describe, it, expect } from "vitest";

import {
    mapUIPartToDBPart,
    mapDBPartToUIPart,
    mapUIMessageToDB,
    mapDBMessageToUI,
    mapConnectionMessagesToUI,
    type UIMessagePartLike,
    type UIMessageLike,
    type MessageWithParts,
    type ConnectionWithMessages,
} from "@/lib/db/message-mapping";
import type { MessagePart } from "@/lib/db/schema";

describe("mapUIPartToDBPart", () => {
    const messageId = "msg-123";

    describe("text parts", () => {
        it("maps text part correctly", () => {
            const uiPart: UIMessagePartLike = {
                type: "text",
                text: "Hello world",
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                messageId,
                order: 0,
                type: "text",
                textContent: "Hello world",
            });
        });
    });

    describe("reasoning parts", () => {
        it("maps reasoning part with provider metadata", () => {
            const uiPart: UIMessagePartLike = {
                type: "reasoning",
                text: "Let me think about this...",
                providerMetadata: {
                    anthropic: {
                        cacheControl: { type: "ephemeral" },
                    },
                },
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "reasoning",
                reasoningContent: "Let me think about this...",
                providerMetadata: {
                    anthropic: {
                        cacheControl: { type: "ephemeral" },
                    },
                },
            });
        });
    });

    describe("file parts", () => {
        it("maps file part correctly", () => {
            const uiPart: UIMessagePartLike = {
                type: "file",
                mediaType: "image/png",
                filename: "screenshot.png",
                url: "https://example.com/image.png",
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "file",
                fileMediaType: "image/png",
                fileName: "screenshot.png",
                fileUrl: "https://example.com/image.png",
            });
        });
    });

    describe("step-start parts", () => {
        it("maps step-start part correctly", () => {
            const uiPart: UIMessagePartLike = {
                type: "step-start",
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "step_start",
            });
        });
    });

    describe("tool parts", () => {
        it("maps tool-* part with input-available state", () => {
            const uiPart: UIMessagePartLike = {
                type: "tool-getWeather",
                toolCallId: "call-123",
                state: "input-available",
                input: { city: "Seattle" },
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "tool_call",
                toolCall: {
                    toolName: "getWeather",
                    toolCallId: "call-123",
                    state: "input_available",
                    input: { city: "Seattle" },
                },
            });
        });

        it("maps tool part with output", () => {
            const uiPart: UIMessagePartLike = {
                type: "tool-fetchData",
                toolCallId: "call-456",
                state: "output-available",
                input: { url: "https://api.example.com" },
                output: { data: "response" },
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "tool_call",
                toolCall: {
                    state: "output_available",
                    output: { data: "response" },
                },
            });
        });

        it("maps tool part with error", () => {
            const uiPart: UIMessagePartLike = {
                type: "tool-searchWeb",
                toolCallId: "call-789",
                state: "output-error",
                input: { query: "test" },
                errorText: "API rate limit exceeded",
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "tool_call",
                toolCall: {
                    state: "output_error",
                    error: "API rate limit exceeded",
                },
            });
        });

        it("defaults to input_available when state is missing", () => {
            const uiPart: UIMessagePartLike = {
                type: "tool-customTool",
                toolCallId: "call-000",
                input: { arg: "value" },
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "tool_call",
                toolCall: {
                    state: "input_available",
                },
            });
        });
    });

    describe("data parts", () => {
        it("maps data-* part correctly", () => {
            const uiPart: UIMessagePartLike = {
                type: "data-weather",
                id: "data-123",
                data: {
                    temp: 72,
                    condition: "sunny",
                },
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "data",
                dataContent: {
                    type: "weather",
                    data: {
                        temp: 72,
                        condition: "sunny",
                        id: "data-123",
                    },
                    loading: false,
                },
            });
        });
    });

    describe("unknown parts", () => {
        it("handles unknown part types as text", () => {
            const uiPart: UIMessagePartLike = {
                type: "custom-unknown-type",
                someData: "value",
            };

            const result = mapUIPartToDBPart(uiPart, messageId, 0);

            expect(result).toMatchObject({
                type: "text",
                textContent: "[Unknown part type: custom-unknown-type]",
            });
        });
    });
});

describe("mapDBPartToUIPart", () => {
    const basePart = {
        id: "part-123",
        messageId: "msg-123",
        order: 0,
        createdAt: new Date(),
        textContent: null,
        reasoningContent: null,
        toolCall: null,
        fileMediaType: null,
        fileName: null,
        fileUrl: null,
        dataContent: null,
        providerMetadata: null,
    };

    describe("text parts", () => {
        it("maps text part to UI format", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "text",
                textContent: "Hello world",
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "text",
                text: "Hello world",
            });
        });

        it("handles null textContent as empty string", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "text",
                textContent: null,
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "text",
                text: "",
            });
        });
    });

    describe("reasoning parts", () => {
        it("maps reasoning part with provider metadata", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "reasoning",
                reasoningContent: "Thinking...",
                providerMetadata: { anthropic: {} },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "reasoning",
                text: "Thinking...",
                providerMetadata: { anthropic: {} },
            });
        });
    });

    describe("file parts", () => {
        it("maps file part correctly", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "file",
                fileMediaType: "application/pdf",
                fileName: "document.pdf",
                fileUrl: "https://example.com/doc.pdf",
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "file",
                mediaType: "application/pdf",
                filename: "document.pdf",
                url: "https://example.com/doc.pdf",
            });
        });
    });

    describe("step_start parts", () => {
        it("maps step_start to step-start", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "step_start",
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "step-start",
            });
        });
    });

    describe("tool_call parts", () => {
        it("maps input-streaming state", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "tool_call",
                toolCall: {
                    toolName: "getWeather",
                    toolCallId: "call-123",
                    state: "input_streaming",
                    input: { partial: "Sea" },
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toMatchObject({
                type: "tool-getWeather",
                toolCallId: "call-123",
                state: "input-streaming",
                input: { partial: "Sea" },
            });
        });

        it("maps input-available state", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "tool_call",
                toolCall: {
                    toolName: "searchWeb",
                    toolCallId: "call-456",
                    state: "input_available",
                    input: { query: "weather" },
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toMatchObject({
                type: "tool-searchWeb",
                state: "input-available",
                input: { query: "weather" },
            });
        });

        it("maps output-available state with output", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "tool_call",
                toolCall: {
                    toolName: "calculate",
                    toolCallId: "call-789",
                    state: "output_available",
                    input: { expression: "2+2" },
                    output: { result: 4 },
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toMatchObject({
                type: "tool-calculate",
                state: "output-available",
                input: { expression: "2+2" },
                output: { result: 4 },
            });
        });

        it("maps output-error state with error text", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "tool_call",
                toolCall: {
                    toolName: "fetchData",
                    toolCallId: "call-000",
                    state: "output_error",
                    input: { url: "invalid" },
                    error: "Invalid URL format",
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toMatchObject({
                type: "tool-fetchData",
                state: "output-error",
                input: { url: "invalid" },
                errorText: "Invalid URL format",
            });
        });

        it("handles unknown tool state with default behavior", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "tool_call",
                toolCall: {
                    toolName: "customTool",
                    toolCallId: "call-999",
                    state: "unknown_state" as "input_available", // Force unknown state
                    input: { data: "test" },
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toMatchObject({
                type: "tool-customTool",
                state: "unknown-state",
                input: { data: "test" },
            });
        });

        it("handles missing tool call data", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "tool_call",
                toolCall: null,
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "text",
                text: "[Missing tool call data]",
            });
        });
    });

    describe("data parts", () => {
        it("maps data part with id in data", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "data",
                dataContent: {
                    type: "weather",
                    data: {
                        id: "weather-123",
                        temp: 75,
                        condition: "cloudy",
                    },
                    loading: true, // Should be overwritten to false
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toMatchObject({
                type: "data-weather",
                id: "weather-123",
                data: {
                    temp: 75,
                    condition: "cloudy",
                    loading: false,
                },
            });
        });

        it("uses part.id when data has no id", () => {
            const dbPart: MessagePart = {
                ...basePart,
                id: "fallback-id",
                type: "data",
                dataContent: {
                    type: "custom",
                    data: { value: 42 },
                    loading: false,
                },
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result.id).toBe("fallback-id");
        });

        it("handles missing data content", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "data",
                dataContent: null,
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "text",
                text: "[Missing data content]",
            });
        });
    });

    describe("unknown types", () => {
        it("handles unknown stored part type as text fallback", () => {
            const dbPart: MessagePart = {
                ...basePart,
                type: "unknown_type" as "text", // Force unknown type
            };

            const result = mapDBPartToUIPart(dbPart);

            expect(result).toEqual({
                type: "text",
                text: "[Unknown stored part type: unknown_type]",
            });
        });
    });
});

describe("mapUIMessageToDB", () => {
    it("maps UI message to database format", () => {
        const uiMessage: UIMessageLike = {
            id: "msg-123",
            role: "assistant",
            parts: [
                { type: "text", text: "Hello!" },
                { type: "text", text: "How can I help?" },
            ],
        };

        const result = mapUIMessageToDB(uiMessage, 456);

        expect(result.message).toMatchObject({
            id: "msg-123",
            connectionId: 456,
            role: "assistant",
        });
        expect(result.parts).toHaveLength(2);
        expect(result.parts[0].order).toBe(0);
        expect(result.parts[1].order).toBe(1);
    });
});

describe("mapDBMessageToUI", () => {
    it("sorts parts by order", () => {
        const messageWithParts: MessageWithParts = {
            id: "msg-123",
            connectionId: 456,
            role: "assistant",
            createdAt: new Date(),
            parts: [
                {
                    id: "part-2",
                    messageId: "msg-123",
                    type: "text",
                    order: 1,
                    textContent: "Second",
                    reasoningContent: null,
                    toolCall: null,
                    fileMediaType: null,
                    fileName: null,
                    fileUrl: null,
                    dataContent: null,
                    providerMetadata: null,
                    createdAt: new Date(),
                },
                {
                    id: "part-1",
                    messageId: "msg-123",
                    type: "text",
                    order: 0,
                    textContent: "First",
                    reasoningContent: null,
                    toolCall: null,
                    fileMediaType: null,
                    fileName: null,
                    fileUrl: null,
                    dataContent: null,
                    providerMetadata: null,
                    createdAt: new Date(),
                },
            ],
        };

        const result = mapDBMessageToUI(messageWithParts);

        expect(result.parts[0]).toMatchObject({ type: "text", text: "First" });
        expect(result.parts[1]).toMatchObject({ type: "text", text: "Second" });
    });
});

describe("mapConnectionMessagesToUI", () => {
    it("sorts messages by creation time", () => {
        const connection: ConnectionWithMessages = {
            id: 123,
            userId: "user-456",
            title: "Test Conversation",
            slug: "test-conversation-conv-123",
            status: "active",
            streamingStatus: "idle",
            modelId: null,
            lastActivityAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [
                {
                    id: "msg-2",
                    connectionId: 123,
                    role: "assistant",
                    createdAt: new Date("2024-01-01T12:00:01Z"),
                    parts: [
                        {
                            id: "part-1",
                            messageId: "msg-2",
                            type: "text",
                            order: 0,
                            textContent: "Response",
                            reasoningContent: null,
                            toolCall: null,
                            fileMediaType: null,
                            fileName: null,
                            fileUrl: null,
                            dataContent: null,
                            providerMetadata: null,
                            createdAt: new Date(),
                        },
                    ],
                },
                {
                    id: "msg-1",
                    connectionId: 123,
                    role: "user",
                    createdAt: new Date("2024-01-01T12:00:00Z"),
                    parts: [
                        {
                            id: "part-2",
                            messageId: "msg-1",
                            type: "text",
                            order: 0,
                            textContent: "Hello",
                            reasoningContent: null,
                            toolCall: null,
                            fileMediaType: null,
                            fileName: null,
                            fileUrl: null,
                            dataContent: null,
                            providerMetadata: null,
                            createdAt: new Date(),
                        },
                    ],
                },
            ],
        };

        const result = mapConnectionMessagesToUI(connection);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("msg-1"); // Earlier message first
        expect(result[1].id).toBe("msg-2"); // Later message second
    });
});
