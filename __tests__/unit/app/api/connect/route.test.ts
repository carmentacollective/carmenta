import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLanguageModelV2, simulateReadableStream } from "ai/test";

// Mock Clerk currentUser to return a test user
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: vi.fn().mockResolvedValue({
        id: "test-user-123",
        emailAddresses: [{ emailAddress: "test@example.com" }],
    }),
}));

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
import { POST } from "@/app/api/connect/route";

// Import the mock to control it in tests
import { currentUser } from "@clerk/nextjs/server";

describe("POST /api/connect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to authenticated user by default
        vi.mocked(currentUser).mockResolvedValue({
            id: "test-user-123",
            emailAddresses: [{ emailAddress: "test@example.com" }],
        } as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns 401 when not authenticated in production", async () => {
        vi.mocked(currentUser).mockResolvedValue(null);
        vi.stubEnv("NODE_ENV", "production");

        const request = new Request("http://localhost/api/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        id: "msg-1",
                        role: "user",
                        parts: [{ type: "text", text: "Hello" }],
                    },
                ],
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe("Unauthorized");

        vi.unstubAllEnvs();
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

        const request = new Request("http://localhost/api/connect", {
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

        const request = new Request("http://localhost/api/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: uiMessages }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
    });
});
