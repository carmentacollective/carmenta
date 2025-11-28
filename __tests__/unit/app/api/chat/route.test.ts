import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLanguageModelV2, simulateReadableStream } from "ai/test";

// Mock the OpenRouter provider to use our mock model
const mockModel = new MockLanguageModelV2({
    doStream: async () => ({
        stream: simulateReadableStream({
            chunks: [
                { type: "text-start", id: "text-1" },
                { type: "text-delta", id: "text-1", delta: "Hello" },
                { type: "text-delta", id: "text-1", delta: ", " },
                { type: "text-delta", id: "text-1", delta: "friend!" },
                { type: "text-end", id: "text-1" },
                {
                    type: "finish",
                    finishReason: "stop",
                    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
            ],
        }),
    }),
});

vi.mock("@openrouter/ai-sdk-provider", () => ({
    createOpenRouter: () => ({
        chat: () => mockModel,
    }),
}));

// Mock env to provide API key
vi.mock("@/lib/env", () => ({
    env: { OPENROUTER_API_KEY: "test-key" },
    assertEnv: vi.fn(),
}));

// Import after mocks are set up
import { POST } from "@/app/api/chat/route";

describe("POST /api/chat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("converts UIMessage format to ModelMessage and streams response", async () => {
        // UIMessage format as sent by useChat hook (with parts array)
        const uiMessages = [
            {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Hello" }],
            },
        ];

        const request = new Request("http://localhost/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: uiMessages }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/event-stream");

        // Consume the stream to verify it works
        const text = await response.text();
        expect(text).toContain("Hello");
    });

    it("handles multi-turn conversation with UIMessage format", async () => {
        const uiMessages = [
            {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Hi there" }],
            },
            {
                id: "msg-2",
                role: "assistant",
                parts: [{ type: "text", text: "Hello! How can I help?" }],
            },
            {
                id: "msg-3",
                role: "user",
                parts: [{ type: "text", text: "Tell me a joke" }],
            },
        ];

        const request = new Request("http://localhost/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: uiMessages }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
    });
});
