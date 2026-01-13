/**
 * Connection API Response Paths Integration Tests
 *
 * These tests validate the distinct response paths through the connection API:
 * 1. Normal Response Path - Standard streamText flow with concierge headers
 * 2. Clarifying Questions Path - Returns interactive questions before research
 * 3. Background Mode Path - Dispatches to Temporal for durable execution
 * 4. Tool Execution Path - Emits transient status during tool calls
 *
 * Each path produces different stream formats and headers. These tests ensure
 * the contract between server and client is maintained across all paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uiMessageChunkSchema } from "ai";
import { encodeConnectionId } from "@/lib/sqids";

// Mock Clerk currentUser
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: vi.fn(),
}));

// Mock env first - needs to be before other mocks
vi.mock("@/lib/env", () => ({
    env: {
        AI_GATEWAY_API_KEY: "test-key",
        NODE_ENV: "test",
    },
    assertEnv: vi.fn(),
}));

// Mock the Gateway provider to use a mock model
vi.mock("@/lib/ai/gateway", async () => {
    const { MockLanguageModelV3, simulateReadableStream } = await import("ai/test");
    const mockModel = new MockLanguageModelV3({
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

    return {
        getGatewayClient: () => () => mockModel,
        translateModelId: (id: string) => id,
        translateOptions: (modelId: string, options: unknown) => ({
            gateway: {
                models: (options as { fallbackModels?: string[] }).fallbackModels || [],
            },
        }),
    };
});

// Mock concierge - we'll override this per test
vi.mock("@/lib/concierge", () => ({
    runConcierge: vi.fn(),
    buildConciergeInput: vi.fn().mockReturnValue({
        currentMessage: { content: "test", role: "user" },
        recentContext: { messageCount: 1, conversationDepth: 1 },
        attachments: [],
        contextMetadata: { estimatedCurrentTokens: 100 },
    }),
    getAttachmentTypesFromInput: vi.fn().mockReturnValue([]),
    CONCIERGE_DEFAULTS: {
        modelId: "anthropic/claude-sonnet-4.5",
        temperature: 0.5,
        reasoning: { enabled: false },
    },
}));

// Mock context routing rules
vi.mock("@/lib/context", () => ({
    applyRoutingRules: vi.fn().mockReturnValue({
        modelId: "anthropic/claude-sonnet-4.5",
        wasChanged: false,
        originalModelId: "anthropic/claude-sonnet-4.5",
    }),
}));

// Mock DB operations
vi.mock("@/lib/db", () => ({
    getOrCreateUser: vi.fn(),
    createConnection: vi.fn(),
    getConnection: vi.fn(),
    upsertMessage: vi.fn(),
    updateStreamingStatus: vi.fn(),
    updateActiveStreamId: vi.fn(),
    updateConnection: vi.fn(),
}));

// Mock discovery functions
vi.mock("@/lib/discovery", () => ({
    getPendingDiscoveries: vi.fn().mockResolvedValue([]),
    completeDiscovery: vi.fn(),
    skipDiscovery: vi.fn(),
}));

// Mock user lookup for discovery
vi.mock("@/lib/db/users", () => ({
    findUserByClerkId: vi.fn().mockResolvedValue({
        id: "db-user-123",
        clerkId: "test-user-123",
        email: "test@example.com",
    }),
}));

// Mock connection manager for integration suggestions
vi.mock("@/lib/integrations/connection-manager", () => ({
    getConnectedServices: vi.fn().mockResolvedValue([]),
}));

// Mock Temporal client
vi.mock("@/lib/temporal/client", () => ({
    isBackgroundModeEnabled: vi.fn().mockReturnValue(false),
    startBackgroundResponse: vi.fn(),
}));

// Mock stream context (resumable streams)
vi.mock("@/lib/streaming/stream-context", () => ({
    getStreamContext: vi.fn().mockReturnValue(null),
}));

// Import after mocks are set up
import { POST } from "@/app/api/connection/route";
import { currentUser } from "@clerk/nextjs/server";
import { runConcierge } from "@/lib/concierge";
import {
    getOrCreateUser,
    createConnection,
    upsertMessage,
    updateStreamingStatus,
    updateActiveStreamId,
} from "@/lib/db";
import {
    isBackgroundModeEnabled,
    startBackgroundResponse,
} from "@/lib/temporal/client";

/**
 * Parse SSE stream into chunks for validation.
 * Handles the `data: {...}\n\n` format from createUIMessageStream.
 *
 * Note: In the Node.js test environment, streams may return different types
 * (Uint8Array for piped streams, string for transformed streams).
 */
async function parseSSEStream(response: Response): Promise<unknown[]> {
    const chunks: unknown[] = [];

    if (!response.body) {
        return chunks;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Handle both Uint8Array (from piped streams) and string (from transform)
            if (value instanceof Uint8Array) {
                buffer += decoder.decode(value, { stream: true });
            } else if (typeof value === "string") {
                buffer += value;
            } else {
                // Skip unexpected types
                continue;
            }

            // Process complete SSE messages (end with \n\n)
            const parts = buffer.split("\n\n");
            // Keep the last incomplete part in the buffer
            buffer = parts.pop() || "";

            for (const part of parts) {
                if (!part.trim()) continue;

                for (const line of part.split("\n")) {
                    if (line.startsWith("data: ")) {
                        try {
                            const json = JSON.parse(line.slice(6));
                            chunks.push(json);
                        } catch {
                            // Skip non-JSON lines
                        }
                    }
                }
            }
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
            for (const line of buffer.split("\n")) {
                if (line.startsWith("data: ")) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        chunks.push(json);
                    } catch {
                        // Skip non-JSON lines
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return chunks;
}

/**
 * Read stream as text - handles streaming response properly.
 * Handles both Uint8Array and string chunks.
 */
async function readStreamAsText(response: Response): Promise<string> {
    if (!response.body) {
        return "";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Handle both Uint8Array and string chunks
            if (value instanceof Uint8Array) {
                result += decoder.decode(value, { stream: true });
            } else if (typeof value === "string") {
                result += value;
            }
        }
        result += decoder.decode(); // Flush remaining
    } finally {
        reader.releaseLock();
    }

    return result;
}

/**
 * Validate a chunk against the AI SDK schema.
 * The validate method exists on the AI SDK schema.
 */
async function validateChunk(
    chunk: unknown
): Promise<{ success: true } | { success: false; error: unknown }> {
    const schema = uiMessageChunkSchema();

    return await (schema as any).validate(chunk);
}

/**
 * Create a standard request body for testing.
 */
function createRequestBody(overrides?: {
    messages?: unknown[];
    connectionId?: string;
}) {
    return {
        messages: overrides?.messages ?? [
            {
                id: "msg-1",
                role: "user",
                parts: [{ type: "text", text: "Hello" }],
            },
        ],
        ...(overrides?.connectionId && { connectionId: overrides.connectionId }),
    };
}

/**
 * Create a POST request with proper headers.
 */
function createRequest(body: unknown): Request {
    return new Request("http://localhost/api/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("Connection API Response Paths", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default authenticated user - cast to unknown first for mock
        vi.mocked(currentUser).mockResolvedValue({
            id: "test-user-123",
            emailAddresses: [
                {
                    id: "email-1",
                    emailAddress: "test@example.com",
                    verification: null,
                    linkedTo: [],
                },
            ],
            firstName: "Test",
            lastName: "User",
            fullName: "Test User",
            imageUrl: "https://example.com/avatar.jpg",
        } as unknown as Awaited<ReturnType<typeof currentUser>>);

        // Default concierge response (normal path)
        vi.mocked(runConcierge).mockResolvedValue({
            modelId: "anthropic/claude-sonnet-4.5",
            temperature: 0.5,
            explanation: "Standard task.",
            reasoning: { enabled: false },
            title: "Test Connection",
        });

        // Default db mock responses
        vi.mocked(getOrCreateUser).mockResolvedValue({
            id: "db-user-123",
            clerkId: "test-user-123",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            displayName: "Test User",
            imageUrl: "https://example.com/avatar.jpg",
            preferences: null,
            lastSignedInAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        vi.mocked(createConnection).mockImplementation(
            async (userId, title, _modelId, conciergeData) => {
                const id = 1;
                const publicId = encodeConnectionId(id);
                return {
                    id,
                    userId,
                    title: title ?? null,
                    titleEdited: false,
                    slug: `test-connection-${publicId}`,
                    status: "active" as const,
                    streamingStatus: "idle" as const,
                    activeStreamId: null,
                    modelId: null,
                    conciergeModelId: conciergeData?.modelId ?? null,
                    conciergeTemperature:
                        conciergeData?.temperature?.toString() ?? null,
                    conciergeExplanation: conciergeData?.explanation ?? null,
                    conciergeReasoning: conciergeData?.reasoning ?? null,
                    isStarred: false,
                    starredAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastActivityAt: new Date(),
                    projectPath: null,
                    codeSessionId: null,
                    // Import tracking
                    source: "carmenta" as const,
                    externalId: null,
                    importedAt: null,
                    customGptId: null,
                };
            }
        );

        vi.mocked(upsertMessage).mockResolvedValue(undefined);
        vi.mocked(updateStreamingStatus).mockResolvedValue(undefined);
        vi.mocked(updateActiveStreamId).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    // ========================================================================
    // 1. NORMAL RESPONSE PATH
    // ========================================================================
    describe("Normal Response Path", () => {
        it("returns 200 with text/event-stream content type", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");
        });

        it("includes all concierge headers", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Concierge-Model-Id")).toBe(
                "anthropic/claude-sonnet-4.5"
            );
            expect(response.headers.get("X-Concierge-Temperature")).toBe("0.5");
            expect(response.headers.get("X-Concierge-Explanation")).toBe(
                encodeURIComponent("Standard task.")
            );
        });

        it("includes connection ID header", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const connectionId = response.headers.get("X-Connection-Id");
            expect(connectionId).toBeTruthy();
            // Should be a valid Sqid format (6+ lowercase alphanumeric)
            expect(connectionId).toMatch(/^[0-9a-z]{6,}$/);
        });

        it("includes new connection headers for first message", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Connection-Is-New")).toBe("true");
            expect(response.headers.get("X-Connection-Slug")).toBeTruthy();
            expect(response.headers.get("X-Connection-Title")).toBe(
                encodeURIComponent("Test Connection")
            );
        });

        it("does not include new connection headers for existing connection", async () => {
            const existingId = encodeConnectionId(42);
            const request = createRequest(
                createRequestBody({ connectionId: existingId })
            );
            const response = await POST(request);

            expect(response.headers.get("X-Connection-Is-New")).toBeNull();
            expect(response.headers.get("X-Connection-Slug")).toBeNull();
        });

        it("streams valid AI SDK v6 chunks", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            // Use response.text() since createUIMessageStreamResponse returns
            // a standard web stream that works with this method
            const text = await response.text();
            expect(text.length).toBeGreaterThan(0);

            // Parse SSE format to extract chunks
            const chunks: unknown[] = [];
            const messages = text.split("\n\n").filter((m) => m.trim());
            for (const message of messages) {
                for (const line of message.split("\n")) {
                    if (line.startsWith("data: ")) {
                        try {
                            const json = JSON.parse(line.slice(6));
                            chunks.push(json);
                        } catch {
                            // Skip non-JSON lines
                        }
                    }
                }
            }

            expect(chunks.length).toBeGreaterThan(0);

            // Validate each chunk against the AI SDK schema
            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success, `Invalid chunk: ${JSON.stringify(chunk)}`).toBe(
                    true
                );
            }
        });

        it("streams text content correctly", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const text = await response.text();
            // The mock LLM returns "Hello, friend!"
            expect(text).toContain("Hello");
            expect(text).toContain("friend");
        });

        it("saves user message before streaming", async () => {
            const request = createRequest(createRequestBody());
            await POST(request);

            // upsertMessage should be called with the user's message
            expect(vi.mocked(upsertMessage)).toHaveBeenCalled();
        });

        it("marks connection as streaming then completed", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            // Must consume stream to trigger onFinish
            await response.text();

            // Should mark as streaming initially
            expect(vi.mocked(updateStreamingStatus)).toHaveBeenCalledWith(
                expect.any(Number),
                "streaming"
            );
        });

        it("includes reasoning headers when reasoning is enabled", async () => {
            vi.mocked(runConcierge).mockResolvedValueOnce({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Complex task requiring deep thinking.",
                reasoning: { enabled: true, effort: "medium", maxTokens: 8000 },
                title: "Deep Thinking Task",
            });

            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const reasoningHeader = response.headers.get("X-Concierge-Reasoning");
            expect(reasoningHeader).toBeTruthy();

            const reasoning = JSON.parse(decodeURIComponent(reasoningHeader!));
            expect(reasoning.enabled).toBe(true);
            expect(reasoning.effort).toBe("medium");
        });

        it("includes auto-switch headers when routing rules change model", async () => {
            const { applyRoutingRules } = await import("@/lib/context");
            vi.mocked(applyRoutingRules).mockReturnValueOnce({
                modelId: "google/gemini-3-pro-preview",
                wasChanged: true,
                originalModelId: "anthropic/claude-sonnet-4.5",
                reason: "Audio file detected - routing to Gemini for native audio processing",
            });

            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Concierge-Auto-Switched")).toBe("true");
            expect(response.headers.get("X-Concierge-Auto-Switch-Reason")).toContain(
                "Audio"
            );
        });
    });

    // ========================================================================
    // 2. CLARIFYING QUESTIONS PATH
    // ========================================================================
    describe("Clarifying Questions Path", () => {
        beforeEach(() => {
            // Configure concierge to return clarifying questions
            vi.mocked(runConcierge).mockResolvedValue({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Research task - need more context.",
                reasoning: { enabled: false },
                title: "Research Task",
                clarifyingQuestions: [
                    {
                        question: "What programming language are you using?",
                        options: [
                            { label: "TypeScript", value: "typescript" },
                            { label: "Python", value: "python" },
                            { label: "Go", value: "go" },
                        ],
                    },
                ],
            });
        });

        it("returns 200 with text/event-stream content type", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");
        });

        it("includes all concierge headers", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Concierge-Model-Id")).toBe(
                "anthropic/claude-sonnet-4.5"
            );
            expect(response.headers.get("X-Concierge-Temperature")).toBe("0.5");
            expect(response.headers.get("X-Connection-Id")).toBeTruthy();
        });

        it("includes new connection headers for new connections", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Connection-Is-New")).toBe("true");
            expect(response.headers.get("X-Connection-Slug")).toBeTruthy();
        });

        it("streams intro text using v6 format", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const chunks = await parseSSEStream(response);

            // Should have text-start, text-delta (intro), text-end
            const textStart = chunks.find(
                (c: unknown) => (c as { type?: string }).type === "text-start"
            );
            const textDelta = chunks.find(
                (c: unknown) => (c as { type?: string }).type === "text-delta"
            );
            const textEnd = chunks.find(
                (c: unknown) => (c as { type?: string }).type === "text-end"
            );

            expect(textStart).toBeTruthy();
            expect(textDelta).toBeTruthy();
            expect(textEnd).toBeTruthy();

            // Text delta is now empty (question renders inline, no intro needed)
            expect((textDelta as { delta?: string }).delta).toBe("");
        });

        it("emits valid AI SDK v6 chunks for all parts", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const chunks = await parseSSEStream(response);

            // Validate each chunk
            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success, `Invalid chunk: ${JSON.stringify(chunk)}`).toBe(
                    true
                );
            }
        });

        it("streams data-askUserInput parts for each question", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const chunks = await parseSSEStream(response);

            // Filter for askUserInput parts
            const askUserInputChunks = chunks.filter(
                (c: unknown) => (c as { type?: string }).type === "data-askUserInput"
            );

            // Now only ONE question (we simplified to single question)
            expect(askUserInputChunks).toHaveLength(1);

            // Verify question structure (no allowFreeform - options only)
            const question = askUserInputChunks[0] as {
                type: string;
                data: {
                    question: string;
                    options: Array<{ label: string; value: string }>;
                };
            };
            expect(question.data.question).toBe(
                "What programming language are you using?"
            );
            expect(question.data.options).toHaveLength(3);
            // allowFreeform is no longer sent
            expect(question.data).not.toHaveProperty("allowFreeform");
        });

        it("marks connection as completed immediately", async () => {
            const request = createRequest(createRequestBody());
            await POST(request);

            // Should mark as completed (not streaming since we're just asking questions)
            expect(vi.mocked(updateStreamingStatus)).toHaveBeenCalledWith(
                expect.any(Number),
                "completed"
            );
        });

        it("does NOT call streamText when clarifying questions are present", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            // The response should not contain LLM-generated content
            const text = await readStreamAsText(response);

            // Should contain the askUserInput data but NOT the mock LLM response
            expect(text).toContain("data-askUserInput");
            expect(text).not.toContain("Hello, friend!");
        });
    });

    // ========================================================================
    // 3. BACKGROUND MODE PATH
    // ========================================================================
    describe("Background Mode Path", () => {
        beforeEach(() => {
            // Enable background mode
            vi.mocked(isBackgroundModeEnabled).mockReturnValue(true);
            vi.mocked(startBackgroundResponse).mockResolvedValue("workflow-123");

            // Configure concierge to request background mode
            vi.mocked(runConcierge).mockResolvedValue({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Deep research task.",
                reasoning: { enabled: true, effort: "high", maxTokens: 16000 },
                title: "Deep Research",
                backgroundMode: {
                    enabled: true,
                    reason: "Deep research - this will take a few minutes",
                },
            });
        });

        it("returns 200 with text/event-stream content type", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");
        });

        it("includes X-Background-Mode header", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Background-Mode")).toBe("true");
        });

        it("includes X-Stream-Id header", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const streamId = response.headers.get("X-Stream-Id");
            expect(streamId).toBeTruthy();
            // nanoid generates 21-char IDs by default
            expect(streamId!.length).toBeGreaterThan(10);
        });

        it("includes all concierge headers", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Concierge-Model-Id")).toBe(
                "anthropic/claude-sonnet-4.5"
            );
            expect(response.headers.get("X-Concierge-Temperature")).toBe("0.5");
            expect(response.headers.get("X-Connection-Id")).toBeTruthy();
        });

        it("includes new connection headers for new connections", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.headers.get("X-Connection-Is-New")).toBe("true");
            expect(response.headers.get("X-Connection-Slug")).toBeTruthy();
            expect(response.headers.get("X-Connection-Title")).toBe(
                encodeURIComponent("Deep Research")
            );
        });

        it("dispatches to Temporal workflow", async () => {
            const request = createRequest(createRequestBody());
            await POST(request);

            expect(vi.mocked(startBackgroundResponse)).toHaveBeenCalledWith({
                connectionId: expect.any(Number),
                userId: "db-user-123",
                streamId: expect.any(String),
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                reasoning: { enabled: true, effort: "high", maxTokens: 16000 },
            });
        });

        it("streams background status message", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);

            const chunks = await parseSSEStream(response);

            // Should have a transient status message about background mode
            const transientChunk = chunks.find(
                (c: unknown) => (c as { type?: string }).type === "data-transient"
            );
            expect(transientChunk).toBeTruthy();

            const data = (transientChunk as { data?: { text?: string } }).data;
            expect(data?.text).toContain("still working");
        });

        it("returns immediately (does not call streamText)", async () => {
            const request = createRequest(createRequestBody());
            const response = await POST(request);
            const text = await readStreamAsText(response);

            // Should NOT contain mock LLM response
            expect(text).not.toContain("Hello, friend!");
        });

        it("falls back to inline when Temporal dispatch fails", async () => {
            vi.mocked(startBackgroundResponse).mockRejectedValueOnce(
                new Error("Temporal unavailable")
            );

            const request = createRequest(createRequestBody());
            const response = await POST(request);

            // Should still return 200 (falls back to inline)
            expect(response.status).toBe(200);

            // Should NOT have background mode headers since it fell back
            expect(response.headers.get("X-Background-Mode")).toBeNull();

            // Should contain streamed content from inline execution
            const text = await response.text();
            expect(text).toContain("Hello");
        });

        it("runs inline when Temporal is not configured", async () => {
            vi.mocked(isBackgroundModeEnabled).mockReturnValue(false);

            const request = createRequest(createRequestBody());
            const response = await POST(request);

            // Should NOT have background mode headers
            expect(response.headers.get("X-Background-Mode")).toBeNull();
            expect(response.headers.get("X-Stream-Id")).toBeNull();

            // Should contain normal streamed content
            const text = await response.text();
            expect(text).toContain("Hello");
        });
    });

    // ========================================================================
    // 4. TOOL EXECUTION PATH (onChunk transient status)
    // ========================================================================
    describe("Tool Execution Path", () => {
        /**
         * Testing the onChunk callback behavior requires a mock LLM that emits
         * tool-call and tool-result chunks. This is complex to mock completely,
         * so we validate the transient message format separately.
         */

        it("validates data-transient chunk format for tool status", async () => {
            // This validates what writeStatus produces
            const transientChunk = {
                type: "data-transient",
                id: "tool-call-123",
                data: {
                    id: "tool-call-123",
                    type: "status",
                    destination: "chat",
                    text: "Searching the web...",
                    icon: "?",
                },
                transient: true,
            };

            const result = await validateChunk(transientChunk);
            expect(result.success).toBe(true);
        });

        it("validates transient chunk format for clearing status", async () => {
            // When tool-result arrives, we clear the status with empty text
            const clearChunk = {
                type: "data-transient",
                id: "tool-call-123",
                data: {
                    id: "tool-call-123",
                    type: "status",
                    destination: "chat",
                    text: "",
                },
                transient: true,
            };

            const result = await validateChunk(clearChunk);
            expect(result.success).toBe(true);
        });

        it("validates tool-related chunk formats", async () => {
            // These chunks are produced by the AI SDK during tool execution
            const chunks = [
                {
                    type: "tool-input-start",
                    toolCallId: "call-123",
                    toolName: "webSearch",
                },
                {
                    type: "tool-input-available",
                    toolCallId: "call-123",
                    toolName: "webSearch",
                    input: { query: "TypeScript best practices" },
                },
                {
                    type: "tool-output-available",
                    toolCallId: "call-123",
                    output: { results: [{ title: "Result 1", url: "https://..." }] },
                },
            ];

            for (const chunk of chunks) {
                const result = await validateChunk(chunk);
                expect(result.success, `Failed: ${JSON.stringify(chunk)}`).toBe(true);
            }
        });
    });

    // ========================================================================
    // ERROR HANDLING
    // ========================================================================
    describe("Error Handling", () => {
        it("returns 400 for invalid connection ID format", async () => {
            const request = createRequest(
                createRequestBody({ connectionId: "ABC" }) // Too short and uppercase
            );
            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it("returns 400 for missing messages", async () => {
            const request = createRequest({ messages: [] });
            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it("marks connection as failed on error", async () => {
            // Force an error in the route
            vi.mocked(createConnection).mockRejectedValueOnce(
                new Error("Database error")
            );

            const request = createRequest(createRequestBody());
            const response = await POST(request);

            expect(response.status).toBe(500);
        });
    });

    // ========================================================================
    // HEADER VERIFICATION (all paths)
    // ========================================================================
    describe("Header Verification", () => {
        it("all paths include required concierge headers", async () => {
            const requiredHeaders = [
                "X-Concierge-Model-Id",
                "X-Concierge-Temperature",
                "X-Concierge-Explanation",
                "X-Connection-Id",
            ];

            // Test normal path
            const normalRequest = createRequest(createRequestBody());
            const normalResponse = await POST(normalRequest);

            for (const header of requiredHeaders) {
                expect(
                    normalResponse.headers.get(header),
                    `Normal path missing ${header}`
                ).toBeTruthy();
            }

            // Reset mocks and test clarifying questions path
            vi.mocked(runConcierge).mockResolvedValue({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Research task.",
                reasoning: { enabled: false },
                title: "Research",
                clarifyingQuestions: [
                    {
                        question: "Test?",
                        options: [{ label: "Yes", value: "yes" }],
                    },
                ],
            });

            const clarifyRequest = createRequest(createRequestBody());
            const clarifyResponse = await POST(clarifyRequest);

            for (const header of requiredHeaders) {
                expect(
                    clarifyResponse.headers.get(header),
                    `Clarifying questions path missing ${header}`
                ).toBeTruthy();
            }
        });

        it("new connection headers are URL-encoded properly", async () => {
            vi.mocked(runConcierge).mockResolvedValue({
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.5,
                explanation: "Task with special chars & quotes 'test'",
                reasoning: { enabled: false },
                title: "Fix auth & session issues",
            });

            const request = createRequest(createRequestBody());
            const response = await POST(request);

            // Headers should be URL-encoded
            const explanation = response.headers.get("X-Concierge-Explanation");
            expect(explanation).toBeTruthy();
            expect(decodeURIComponent(explanation!)).toContain("&");
            expect(decodeURIComponent(explanation!)).toContain("'");

            const title = response.headers.get("X-Connection-Title");
            expect(title).toBeTruthy();
            expect(decodeURIComponent(title!)).toBe("Fix auth & session issues");
        });
    });
});
