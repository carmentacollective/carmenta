import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLanguageModelV2, simulateReadableStream } from "ai/test";
import { encodeConnectionId } from "@/lib/sqids";

// Define mock functions that can be referenced in vi.mock
const mockCurrentUser = vi.fn();
const mockRunConcierge = vi.fn();
const mockGetOrCreateUser = vi.fn();
const mockCreateConnection = vi.fn();
const mockUpsertMessage = vi.fn();
const mockUpdateStreamingStatus = vi.fn();

// Mock Clerk currentUser
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mockCurrentUser,
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
    runConcierge: mockRunConcierge,
    CONCIERGE_DEFAULTS: {
        modelId: "anthropic/claude-sonnet-4.5",
        temperature: 0.5,
        reasoning: { enabled: false },
    },
}));

// Mock database functions for persistence
vi.mock("@/lib/db", () => ({
    getOrCreateUser: mockGetOrCreateUser,
    createConnection: mockCreateConnection,
    upsertMessage: mockUpsertMessage,
    updateStreamingStatus: mockUpdateStreamingStatus,
}));

// Import after mocks are set up
import { POST } from "@/app/api/connection/route";

describe("POST /api/connection", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset to authenticated user by default
        mockCurrentUser.mockResolvedValue({
            id: "test-user-123",
            emailAddresses: [{ emailAddress: "test@example.com" }],
            firstName: "Test",
            lastName: "User",
            fullName: "Test User",
            imageUrl: "https://example.com/avatar.jpg",
        });

        // Default concierge response with title
        mockRunConcierge.mockResolvedValue({
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.5,
            explanation: "Standard task.",
            reasoning: { enabled: false },
            title: "Fix authentication bug",
        });

        // Default db mock responses
        mockGetOrCreateUser.mockResolvedValue({
            id: "db-user-123",
            clerkId: "test-user-123",
            email: "test@example.com",
        });

        mockCreateConnection.mockImplementation((userId, title) => {
            const id = 1; // Integer ID from database
            const publicId = encodeConnectionId(id);
            return {
                id, // Integer, not string
                userId,
                title: title ?? null,
                slug: title
                    ? `fix-authentication-bug-${publicId}`
                    : `connection-${publicId}`,
                status: "active",
                streamingStatus: "idle",
                createdAt: new Date(),
                updatedAt: new Date(),
                lastActivityAt: new Date(),
            };
        });

        mockUpsertMessage.mockResolvedValue(undefined);
        mockUpdateStreamingStatus.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.skip("returns 401 when not authenticated in production", async () => {
        // Note: This test is skipped because process.env.NODE_ENV is read-only in bun test
        // The behavior is tested manually and in e2e tests
        mockCurrentUser.mockResolvedValue(null);

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
            expect(mockRunConcierge).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ role: "user" })])
            );

            // Verify connection was created with title from concierge
            expect(mockCreateConnection).toHaveBeenCalledWith(
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

            // The mock creates connection with id: 1
            const expectedPublicId = encodeConnectionId(1);

            // Should return new connection headers
            expect(response.headers.get("X-Connection-Is-New")).toBe("true");
            expect(response.headers.get("X-Connection-Slug")).toBe(
                `fix-authentication-bug-${expectedPublicId}`
            );
            expect(response.headers.get("X-Connection-Id")).toBe(expectedPublicId);
            expect(response.headers.get("X-Connection-Title")).toBe(
                encodeURIComponent("Fix authentication bug")
            );
        });

        it("does not return new connection headers when connectionId is provided", async () => {
            // Use a valid Sqid for an existing connection (e.g., DB ID 42)
            const existingPublicId = encodeConnectionId(42);

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
                    connectionId: existingPublicId, // Valid existing Sqid
                }),
            });

            const response = await POST(request);

            // Should NOT return new connection headers
            expect(response.headers.get("X-Connection-Is-New")).toBeNull();
            expect(response.headers.get("X-Connection-Slug")).toBeNull();

            // Should NOT create a new connection
            expect(mockCreateConnection).not.toHaveBeenCalled();
        });

        it("generates slug with title when concierge provides title", async () => {
            mockRunConcierge.mockResolvedValueOnce({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: "Debug API errors",
            });

            const testId = 2; // Use a different ID
            const testPublicId = encodeConnectionId(testId);

            // Update mock to reflect new title with integer ID
            mockCreateConnection.mockImplementationOnce((userId, title) => ({
                id: testId,
                userId,
                title,
                slug: `debug-api-errors-${testPublicId}`,
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
                `debug-api-errors-${testPublicId}`
            );
        });

        it("generates fallback slug when concierge provides no title", async () => {
            mockRunConcierge.mockResolvedValueOnce({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Test",
                reasoning: { enabled: false },
                title: undefined, // No title
            });

            const testId = 3;
            const testPublicId = encodeConnectionId(testId);

            mockCreateConnection.mockImplementationOnce((userId, _title) => ({
                id: testId,
                userId,
                title: null,
                slug: `connection-${testPublicId}`, // Fallback slug
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
                `connection-${testPublicId}`
            );
            // No title header when no title
            expect(response.headers.get("X-Connection-Title")).toBeNull();
        });
    });

    describe("Connection ID Validation", () => {
        it("accepts valid 6+ character connection ID", async () => {
            // Use an actual valid Sqid
            const validSqid = encodeConnectionId(100);

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
                    connectionId: validSqid,
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
            // Use a large number that produces a longer Sqid
            const longerSqid = encodeConnectionId(999999999);

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
                    connectionId: longerSqid,
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        });
    });
});
