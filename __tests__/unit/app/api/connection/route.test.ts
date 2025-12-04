import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLanguageModelV2, simulateReadableStream } from "ai/test";

// Use vi.hoisted to define mock functions that can be referenced in vi.mock
const mocks = vi.hoisted(() => ({
    mockCurrentUser: vi.fn(),
    mockRunConcierge: vi.fn(),
    mockGetOrCreateUser: vi.fn(),
    mockCreateConnection: vi.fn(),
    mockUpsertMessage: vi.fn(),
    mockUpdateStreamingStatus: vi.fn(),
}));

// Mock Clerk currentUser
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mocks.mockCurrentUser,
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

// Mock concierge
vi.mock("@/lib/concierge", () => ({
    runConcierge: mocks.mockRunConcierge,
}));

// Mock database functions for persistence
vi.mock("@/lib/db", () => ({
    getOrCreateUser: mocks.mockGetOrCreateUser,
    createConnection: mocks.mockCreateConnection,
    upsertMessage: mocks.mockUpsertMessage,
    updateStreamingStatus: mocks.mockUpdateStreamingStatus,
}));

// Import after mocks are set up
import { POST } from "@/app/api/connection/route";

describe("POST /api/connection", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset to authenticated user by default
        mocks.mockCurrentUser.mockResolvedValue({
            id: "test-user-123",
            emailAddresses: [{ emailAddress: "test@example.com" }],
        });

        // Default concierge response with title
        mocks.mockRunConcierge.mockResolvedValue({
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.5,
            explanation: "Standard task.",
            reasoning: { enabled: false },
            title: "Fix authentication bug",
        });

        // Default db mock responses
        mocks.mockGetOrCreateUser.mockResolvedValue({
            id: "db-user-123",
            clerkId: "test-user-123",
            email: "test@example.com",
        });

        mocks.mockCreateConnection.mockImplementation((userId, title) => ({
            id: "abc12345", // 8+ character Sqid
            userId,
            title: title ?? null,
            slug: title ? "fix-authentication-bug-abc12345" : "connection-abc12345",
            status: "active",
            streamingStatus: "idle",
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActivityAt: new Date(),
        }));

        mocks.mockUpsertMessage.mockResolvedValue(undefined);
        mocks.mockUpdateStreamingStatus.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.skip("returns 401 when not authenticated in production", async () => {
        // Note: This test is skipped because process.env.NODE_ENV is read-only in bun test
        // The behavior is tested manually and in e2e tests
        mocks.mockCurrentUser.mockResolvedValue(null);

        const request = new Request("http://localhost/api/connection", {
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

        const request = new Request("http://localhost/api/connection", {
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

    it("handles multi-turn connection with UIMessage format", async () => {
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

        const request = new Request("http://localhost/api/connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: uiMessages }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
    });

    describe("Lazy Connection Creation Flow", () => {
        it("creates connection with title from concierge when no connectionId provided", async () => {
            const request = new Request("http://localhost/api/connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        {
                            id: "msg-1",
                            role: "user",
                            parts: [{ type: "text", text: "Help me fix auth bugs" }],
                        },
                    ],
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            // Verify concierge was called to get model selection AND title
            expect(mocks.mockRunConcierge).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ role: "user" })])
            );

            // Verify connection was created with title from concierge
            expect(mocks.mockCreateConnection).toHaveBeenCalledWith(
                "db-user-123",
                "Fix authentication bug", // Title from concierge mock
                "anthropic/claude-sonnet-4.5" // Model from concierge mock
            );
        });

        it("returns new connection headers for lazy creation", async () => {
            const request = new Request("http://localhost/api/connection", {
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

            // Should return new connection headers
            expect(response.headers.get("X-Connection-Is-New")).toBe("true");
            expect(response.headers.get("X-Connection-Slug")).toBe(
                "fix-authentication-bug-abc12345"
            );
            expect(response.headers.get("X-Connection-Id")).toBe("abc12345");
            expect(response.headers.get("X-Connection-Title")).toBe(
                encodeURIComponent("Fix authentication bug")
            );
        });

        it("does not return new connection headers when connectionId is provided", async () => {
            const request = new Request("http://localhost/api/connection", {
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
                    connectionId: "existing8", // 8-character existing ID
                }),
            });

            const response = await POST(request);

            // Should NOT return new connection headers
            expect(response.headers.get("X-Connection-Is-New")).toBeNull();
            expect(response.headers.get("X-Connection-Slug")).toBeNull();

            // Should NOT create a new connection
            expect(mocks.mockCreateConnection).not.toHaveBeenCalled();
        });

        it("generates slug with title when concierge provides title", async () => {
            mocks.mockRunConcierge.mockResolvedValueOnce({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: "Debug API errors",
            });

            // Update mock to reflect new title
            mocks.mockCreateConnection.mockImplementationOnce((userId, title) => ({
                id: "xyz78901",
                userId,
                title,
                slug: "debug-api-errors-xyz78901",
                status: "active",
                streamingStatus: "idle",
                createdAt: new Date(),
                updatedAt: new Date(),
                lastActivityAt: new Date(),
            }));

            const request = new Request("http://localhost/api/connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        {
                            id: "msg-1",
                            role: "user",
                            parts: [{ type: "text", text: "Debug my API" }],
                        },
                    ],
                }),
            });

            const response = await POST(request);

            expect(response.headers.get("X-Connection-Slug")).toBe(
                "debug-api-errors-xyz78901"
            );
        });

        it("generates fallback slug when concierge provides no title", async () => {
            mocks.mockRunConcierge.mockResolvedValueOnce({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: undefined, // No title
            });

            mocks.mockCreateConnection.mockImplementationOnce((userId, _title) => ({
                id: "abc12345",
                userId,
                title: null,
                slug: "connection-abc12345", // Fallback slug
                status: "active",
                streamingStatus: "idle",
                createdAt: new Date(),
                updatedAt: new Date(),
                lastActivityAt: new Date(),
            }));

            const request = new Request("http://localhost/api/connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        {
                            id: "msg-1",
                            role: "user",
                            parts: [{ type: "text", text: "Hi" }],
                        },
                    ],
                }),
            });

            const response = await POST(request);

            expect(response.headers.get("X-Connection-Slug")).toBe(
                "connection-abc12345"
            );
            // No title header when no title
            expect(response.headers.get("X-Connection-Title")).toBeNull();
        });
    });

    describe("Connection ID Validation", () => {
        it("accepts valid 8-character connection ID", async () => {
            const request = new Request("http://localhost/api/connection", {
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
                    connectionId: "abc12345", // Valid 8+ char Sqid
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        });

        it("rejects connection ID that is too short", async () => {
            const request = new Request("http://localhost/api/connection", {
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
                    connectionId: "abc", // Too short
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(400);

            const body = await response.json();
            expect(body.details?.fieldErrors?.connectionId).toBeDefined();
        });

        it("rejects connection ID with uppercase characters", async () => {
            const request = new Request("http://localhost/api/connection", {
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
                    connectionId: "ABC12345", // Uppercase not allowed
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it("rejects connection ID with special characters", async () => {
            const request = new Request("http://localhost/api/connection", {
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
                    connectionId: "abc-1234", // Hyphen not allowed
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it("accepts longer Sqid connection IDs (variable length)", async () => {
            const request = new Request("http://localhost/api/connection", {
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
                    connectionId: "a1b2c3d4e5f6", // 12-char Sqid is valid
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        });
    });
});
