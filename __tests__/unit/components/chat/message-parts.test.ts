/**
 * Unit tests for message-parts utilities
 *
 * These functions are critical for message rendering across both HoloThread
 * and SidecarThread. Tests cover edge cases and malformed data handling.
 */

import { describe, it, expect } from "vitest";
import type { UIMessage } from "@ai-sdk/react";
import {
    getMessageContent,
    getReasoningContent,
    getToolParts,
    getFileParts,
    getDataParts,
    getToolStatus,
    getToolError,
    isToolPart,
    isFilePart,
    isDataPart,
    type ToolPart,
    type FilePart,
    type DataPart,
} from "@/components/chat/message-parts";

describe("getMessageContent", () => {
    it("extracts text from simple message", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "Hello world" }],
        };
        expect(getMessageContent(message)).toBe("Hello world");
    });

    it("concatenates multiple text parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [
                { type: "text", text: "Hello " },
                { type: "text", text: "world" },
            ],
        };
        expect(getMessageContent(message)).toBe("Hello world");
    });

    it("handles empty parts array", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [],
        };
        expect(getMessageContent(message)).toBe("");
    });

    it("handles missing parts property", () => {
        const message = {
            id: "1",
            role: "user",
        } as UIMessage;
        expect(getMessageContent(message)).toBe("");
    });

    it("handles malformed text parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [
                { type: "text", text: "valid" },
                { type: "text" } as any, // Missing text field
                { type: "text", text: null } as any,
            ],
        };
        expect(getMessageContent(message)).toBe("valid");
    });

    it("filters non-text parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [
                { type: "text", text: "Hello" },
                {
                    type: "tool-getWeather",
                    toolCallId: "1",
                    state: "output-available",
                } as any,
                { type: "text", text: " world" },
            ],
        };
        expect(getMessageContent(message)).toBe("Hello world");
    });
});

describe("getReasoningContent", () => {
    it("extracts reasoning from message", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [
                { type: "reasoning", text: "Let me think..." },
                { type: "text", text: "Answer" },
            ],
        };
        expect(getReasoningContent(message)).toBe("Let me think...");
    });

    it("returns null when no reasoning present", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [{ type: "text", text: "Answer" }],
        };
        expect(getReasoningContent(message)).toBeNull();
    });

    it("handles missing parts property", () => {
        const message = {
            id: "1",
            role: "assistant",
        } as UIMessage;
        expect(getReasoningContent(message)).toBeNull();
    });

    it("handles malformed reasoning part", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [{ type: "reasoning" } as any],
        };
        expect(getReasoningContent(message)).toBeNull();
    });
});

describe("isToolPart", () => {
    it("identifies valid tool part", () => {
        const part: ToolPart = {
            type: "tool-getWeather",
            toolCallId: "call_123",
            state: "output-available",
            input: { location: "SF" },
            output: { temperature: 72 },
        };
        expect(isToolPart(part)).toBe(true);
    });

    it("rejects non-tool type", () => {
        const part = {
            type: "text",
            text: "Hello",
        };
        expect(isToolPart(part)).toBe(false);
    });

    it("rejects tool part missing required fields", () => {
        const missingToolCallId = {
            type: "tool-getWeather",
            state: "output-available",
            input: {},
        };
        expect(isToolPart(missingToolCallId)).toBe(false);

        const missingState = {
            type: "tool-getWeather",
            toolCallId: "call_123",
            input: {},
        };
        expect(isToolPart(missingState)).toBe(false);

        const missingInput = {
            type: "tool-getWeather",
            toolCallId: "call_123",
            state: "output-available",
        };
        expect(isToolPart(missingInput)).toBe(false);
    });

    it("rejects null and undefined", () => {
        expect(isToolPart(null)).toBe(false);
        expect(isToolPart(undefined)).toBe(false);
    });

    it("rejects non-object types", () => {
        expect(isToolPart("tool-getWeather")).toBe(false);
        expect(isToolPart(123)).toBe(false);
        expect(isToolPart(true)).toBe(false);
    });
});

describe("getToolParts", () => {
    it("extracts tool parts from message", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [
                {
                    type: "tool-getWeather",
                    toolCallId: "call_1",
                    state: "output-available",
                    input: { location: "SF" },
                    output: { temperature: 72 },
                },
                { type: "text", text: "The weather is nice" },
            ] as any,
        };
        const tools = getToolParts(message);
        expect(tools).toHaveLength(1);
        expect(tools[0].type).toBe("tool-getWeather");
    });

    it("returns empty array when no tool parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [{ type: "text", text: "Hello" }],
        };
        expect(getToolParts(message)).toEqual([]);
    });

    it("handles missing parts property", () => {
        const message = {
            id: "1",
            role: "assistant",
        } as UIMessage;
        expect(getToolParts(message)).toEqual([]);
    });

    it("filters out malformed tool parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [
                {
                    type: "tool-valid",
                    toolCallId: "call_1",
                    state: "output-available",
                    input: {},
                },
                {
                    type: "tool-invalid",
                    // Missing required fields
                },
            ] as any,
        };
        const tools = getToolParts(message);
        expect(tools).toHaveLength(1);
        expect(tools[0].type).toBe("tool-valid");
    });
});

describe("isFilePart", () => {
    it("identifies valid file part", () => {
        const part: FilePart = {
            type: "file",
            mimeType: "image/png",
            data: "base64encodeddata",
            filename: "image.png",
        };
        expect(isFilePart(part)).toBe(true);
    });

    it("accepts file part without optional filename", () => {
        const part: FilePart = {
            type: "file",
            mimeType: "image/png",
            data: "base64encodeddata",
        };
        expect(isFilePart(part)).toBe(true);
    });

    it("rejects non-file type", () => {
        const part = {
            type: "text",
            text: "Hello",
        };
        expect(isFilePart(part)).toBe(false);
    });

    it("rejects file part missing required fields", () => {
        const missingData = {
            type: "file",
            mimeType: "image/png",
        };
        expect(isFilePart(missingData)).toBe(false);

        const missingMimeType = {
            type: "file",
            data: "base64encodeddata",
        };
        expect(isFilePart(missingMimeType)).toBe(false);
    });

    it("rejects null and undefined", () => {
        expect(isFilePart(null)).toBe(false);
        expect(isFilePart(undefined)).toBe(false);
    });
});

describe("getFileParts", () => {
    it("extracts file parts from message", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [
                {
                    type: "file",
                    mimeType: "image/png",
                    data: "base64encodeddata",
                },
                { type: "text", text: "Check this out" },
            ] as any,
        };
        const files = getFileParts(message);
        expect(files).toHaveLength(1);
        expect(files[0].mimeType).toBe("image/png");
    });

    it("returns empty array when no file parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
        };
        expect(getFileParts(message)).toEqual([]);
    });

    it("handles missing parts property", () => {
        const message = {
            id: "1",
            role: "user",
        } as UIMessage;
        expect(getFileParts(message)).toEqual([]);
    });
});

describe("isDataPart", () => {
    it("identifies valid data part", () => {
        const part: DataPart = {
            type: "data-askUserInput",
            id: "data_1",
            data: { question: "Are you sure?" },
        };
        expect(isDataPart(part)).toBe(true);
    });

    it("accepts data part without optional id", () => {
        const part: DataPart = {
            type: "data-askUserInput",
            data: { question: "Are you sure?" },
        };
        expect(isDataPart(part)).toBe(true);
    });

    it("rejects non-data type", () => {
        const part = {
            type: "text",
            text: "Hello",
        };
        expect(isDataPart(part)).toBe(false);
    });

    it("rejects data part missing data field", () => {
        const missingData = {
            type: "data-askUserInput",
            id: "data_1",
        };
        expect(isDataPart(missingData)).toBe(false);
    });

    it("rejects null and undefined", () => {
        expect(isDataPart(null)).toBe(false);
        expect(isDataPart(undefined)).toBe(false);
    });
});

describe("getDataParts", () => {
    it("extracts data parts from message", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [
                {
                    type: "data-askUserInput",
                    id: "data_1",
                    data: { question: "Continue?" },
                },
                { type: "text", text: "Answer" },
            ] as any,
        };
        const dataParts = getDataParts(message);
        expect(dataParts).toHaveLength(1);
        expect(dataParts[0].type).toBe("data-askUserInput");
    });

    it("returns empty array when no data parts", () => {
        const message: UIMessage = {
            id: "1",
            role: "assistant",
            parts: [{ type: "text", text: "Hello" }],
        };
        expect(getDataParts(message)).toEqual([]);
    });

    it("handles missing parts property", () => {
        const message = {
            id: "1",
            role: "assistant",
        } as UIMessage;
        expect(getDataParts(message)).toEqual([]);
    });
});

describe("getToolStatus", () => {
    it("maps output-available to completed", () => {
        expect(getToolStatus("output-available")).toBe("completed");
    });

    it("maps output-error to error", () => {
        expect(getToolStatus("output-error")).toBe("error");
    });

    it("maps input-streaming to running", () => {
        expect(getToolStatus("input-streaming")).toBe("running");
    });

    it("maps input-available to running", () => {
        expect(getToolStatus("input-available")).toBe("running");
    });
});

describe("getToolError", () => {
    const createPart = (state: ToolPart["state"], errorText?: string): ToolPart => ({
        type: "tool-test",
        toolCallId: "call_1",
        state,
        input: {},
        errorText,
    });

    it("extracts errorText from AI SDK pattern", () => {
        const part = createPart("output-error", "Something went wrong");
        expect(getToolError(part, undefined)).toBe("Something went wrong");
    });

    it("extracts error from SubagentResult pattern", () => {
        const part = createPart("output-error");
        const output = {
            success: false,
            error: { message: "Subagent failed" },
        };
        expect(getToolError(part, output)).toBe("Subagent failed");
    });

    it("extracts error from simple error string pattern", () => {
        const part = createPart("output-error");
        const output = {
            error: "Simple error message",
        };
        expect(getToolError(part, output)).toBe("Simple error message");
    });

    it("uses fallback message when SubagentResult has no message", () => {
        const part = createPart("output-error");
        const output = {
            success: false,
            error: {},
        };
        expect(getToolError(part, output, "Custom fallback")).toBe("Custom fallback");
    });

    it("returns undefined when no error", () => {
        const part = createPart("output-available");
        expect(getToolError(part, { result: "success" })).toBeUndefined();
    });

    it("prefers errorText over output patterns", () => {
        const part = createPart("output-error", "AI SDK error");
        const output = {
            success: false,
            error: { message: "Subagent error" },
        };
        expect(getToolError(part, output)).toBe("AI SDK error");
    });
});
