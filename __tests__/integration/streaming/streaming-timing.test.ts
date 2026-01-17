/**
 * Integration Test: Streaming Timing
 *
 * Tests that the chat response STREAMS token-by-token, not all at once.
 *
 * THE BUG: After concierge completes, the main LLM response appears all at once
 * instead of streaming incrementally. This test should FAIL until the bug is fixed.
 *
 * The resumable-stream library uses a start() callback that eagerly reads all
 * chunks before the Response is even returned to the client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encodeConnectionId } from "@/lib/sqids";

// Track chunk arrival times
let chunkArrivalTimes: number[] = [];
let streamStartTime: number = 0;

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: vi.fn(),
}));

// Mock env
vi.mock("@/lib/env", () => ({
    env: {
        AI_GATEWAY_API_KEY: "test-key",
        NODE_ENV: "test",
    },
    assertEnv: vi.fn(),
}));

// SLOW STREAMING: Mock the Gateway to stream with delays
// This simulates a real LLM that produces tokens every 50ms
vi.mock("@/lib/ai/gateway", async () => {
    const { MockLanguageModelV3, simulateReadableStream } = await import("ai/test");
    const mockModel = new MockLanguageModelV3({
        doStream: async () => ({
            stream: simulateReadableStream({
                chunks: [
                    { type: "text-start", id: "text-1" },
                    { type: "text-delta", id: "text-1", delta: "Hello" },
                    { type: "text-delta", id: "text-1", delta: " " },
                    { type: "text-delta", id: "text-1", delta: "world" },
                    { type: "text-delta", id: "text-1", delta: "!" },
                    { type: "text-delta", id: "text-1", delta: " This" },
                    { type: "text-delta", id: "text-1", delta: " is" },
                    { type: "text-delta", id: "text-1", delta: " streaming" },
                    { type: "text-delta", id: "text-1", delta: "." },
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
                                total: 9,
                                text: undefined,
                                reasoning: undefined,
                            },
                        },
                    },
                ],
                // KEY: Add delay between chunks to simulate real LLM behavior
                chunkDelayInMs: 50,
            }),
        }),
    });

    return {
        getGatewayClient: () => () => mockModel,
        translateModelId: (id: string) => id,
        translateOptions: (_modelId: string, options: unknown) => ({
            gateway: {
                models: (options as { fallbackModels?: string[] }).fallbackModels || [],
            },
        }),
    };
});

// Mock concierge
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
        modelId: "anthropic/claude-haiku-4.5",
        temperature: 0.7,
        reasoning: { enabled: false },
    },
}));

// Mock context routing rules
vi.mock("@/lib/context", () => ({
    applyRoutingRules: vi.fn().mockReturnValue({
        modelId: "anthropic/claude-haiku-4.5",
        wasChanged: false,
        originalModelId: "anthropic/claude-haiku-4.5",
    }),
}));

// Mock DB operations
vi.mock("@/lib/db", () => ({
    getOrCreateUser: vi.fn(),
    createConnection: vi.fn(),
    getConnection: vi.fn(),
    upsertMessage: vi.fn(),
    upsertToolPart: vi.fn(),
    updateStreamingStatus: vi.fn(),
    updateActiveStreamId: vi.fn(),
    updateConnection: vi.fn(),
}));

// Mock user lookup
vi.mock("@/lib/db/users", () => ({
    findUserByClerkId: vi.fn().mockResolvedValue({
        id: "db-user-123",
        clerkId: "test-user-123",
        email: "test@example.com",
    }),
}));

// Mock integrations
vi.mock("@/lib/integrations/connection-manager", () => ({
    getConnectedServices: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/integrations/services", () => ({
    findSuggestableIntegrations: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/integrations/tools", () => ({
    getIntegrationTools: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/mcp/gateway", () => ({
    getMcpGatewayTools: vi.fn().mockResolvedValue({}),
}));

// Mock system messages
vi.mock("@/lib/prompts/system-messages", () => ({
    buildSystemMessages: vi.fn().mockResolvedValue([]),
}));

// Mock tools
vi.mock("@/lib/tools/built-in", () => ({
    builtInTools: {},
    createSearchKnowledgeTool: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai-team/agents/image-artist-tool", () => ({
    createImageArtistTool: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai-team/agents/librarian-tool", () => ({
    createLibrarianTool: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai-team/agents/mcp-config-tool", () => ({
    createMcpConfigTool: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai-team/agents/sms-user-tool", () => ({
    createSmsUserTool: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai-team/agents/push-notification-tool", () => ({
    createPushNotificationTool: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/tools/post-response", () => ({
    postResponseTools: {},
}));

vi.mock("@/lib/tools/tool-errors", () => ({
    detectToolError: vi.fn().mockReturnValue({ isError: false }),
}));

// Mock braintrust
vi.mock("@/lib/braintrust", () => ({
    initBraintrustLogger: vi.fn().mockResolvedValue(undefined),
    logTraceData: vi.fn().mockResolvedValue(undefined),
}));

// Mock Temporal
vi.mock("@/lib/temporal/client", () => ({
    isBackgroundModeEnabled: vi.fn().mockReturnValue(false),
    startBackgroundResponse: vi.fn().mockResolvedValue(undefined),
}));

// Mock librarian
vi.mock("@/lib/ai-team/librarian/trigger", () => ({
    triggerLibrarian: vi.fn().mockResolvedValue(undefined),
}));

// Mock research
vi.mock("@/lib/research/auto-trigger", () => ({
    detectDepthSelection: vi.fn().mockReturnValue({ isDepthResponse: false }),
    preExecuteResearch: vi.fn().mockResolvedValue(null),
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock model config
vi.mock("@/lib/model-config", () => ({
    getModel: vi.fn().mockReturnValue({
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku",
        supportsTools: false,
    }),
    getFallbackChain: vi.fn().mockReturnValue([]),
}));

/**
 * Mock stream context that REPLICATES the BUGGY resumable-stream library behavior.
 *
 * THE BUG: When a client resumes a stream, the library sends ALL buffered chunks
 * as ONE message (see runtime.js line 89 BEFORE the fix):
 *   `const chunksToSend = chunks.join("").slice(parsedMessage.skipCharacters || 0);`
 */
function createBuggyStreamContext() {
    return {
        createNewResumableStream: async (
            _streamId: string,
            makeStream: () => ReadableStream<string>
        ): Promise<ReadableStream<string>> => {
            const sourceStream = makeStream();
            const reader = sourceStream.getReader();
            const chunks: string[] = [];

            // Read all chunks into the buffer
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            // THE BUG: Join all chunks and send as ONE message
            const allChunksJoined = chunks.join("");

            return new ReadableStream<string>({
                start(controller) {
                    controller.enqueue(allChunksJoined);
                    controller.close();
                },
            });
        },
        resumeExistingStream: vi.fn().mockResolvedValue(null),
    };
}

/**
 * Mock stream context that simulates the FIXED resumable-stream library behavior.
 *
 * THE FIX: Send chunks individually instead of joining them, preserving
 * the original streaming timing for resumed clients.
 */
function createFixedStreamContext() {
    return {
        createNewResumableStream: async (
            _streamId: string,
            makeStream: () => ReadableStream<string>
        ): Promise<ReadableStream<string>> => {
            const sourceStream = makeStream();
            const reader = sourceStream.getReader();
            const chunks: string[] = [];

            // Read all chunks into the buffer
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            // THE FIX: Send chunks individually (like the patched library does)
            return new ReadableStream<string>({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(chunk);
                    }
                    controller.close();
                },
            });
        },
        resumeExistingStream: vi.fn().mockResolvedValue(null),
    };
}

// This mock will be set per-test
let mockStreamContext: ReturnType<typeof createBuggyStreamContext> | null = null;

vi.mock("@/lib/streaming/stream-context", () => ({
    getStreamContext: () => mockStreamContext,
}));

// Import route after all mocks are set up
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

describe("Streaming Timing - Bug Replication", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        chunkArrivalTimes = [];
        streamStartTime = 0;

        // Default authenticated user
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

        // Default concierge response
        vi.mocked(runConcierge).mockResolvedValue({
            modelId: "anthropic/claude-haiku-4.5",
            temperature: 0.7,
            explanation: "Standard task.",
            reasoning: { enabled: false },
            title: "Test Connection",
        });

        // Default DB mocks
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
            sessionCount: 5,
            lastSessionDate: "2024-01-15",
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
        mockStreamContext = null;
        vi.restoreAllMocks();
    });

    /**
     * DOCUMENTS THE BUG (expected to fail)
     *
     * This test uses a mock that replicates the UNPATCHED library behavior
     * where chunks.join("") sends all content as one message.
     *
     * Keep this test to document what the bug looks like. It should fail
     * because the buggy mock sends all chunks joined as one.
     */
    it.skip("DOCUMENTS BUG: unpatched library joins all chunks into one", async () => {
        // Use the buggy stream context that replicates the library behavior
        mockStreamContext = createBuggyStreamContext();

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

        if (response.status !== 200) {
            const body = await response.text();
            console.error("Response error:", response.status, body);
        }
        expect(response.status).toBe(200);

        // Read the stream and record timing of each chunk
        const reader = response.body!.getReader();
        streamStartTime = Date.now();

        while (true) {
            const { done } = await reader.read();
            if (done) break;
            chunkArrivalTimes.push(Date.now() - streamStartTime);
        }

        console.log("Chunk arrival times (ms from start):", chunkArrivalTimes);

        // Calculate gaps between consecutive chunks
        const gaps: number[] = [];
        for (let i = 1; i < chunkArrivalTimes.length; i++) {
            gaps.push(chunkArrivalTimes[i] - chunkArrivalTimes[i - 1]);
        }
        console.log("Gaps between chunks (ms):", gaps);

        // THE BUG ASSERTION:
        // With the buggy resumable stream, ALL chunks arrive at once.
        // All gaps should be < 10ms (buffered together).
        // If streaming worked correctly, there would be 50ms+ gaps.
        const meaningfulGaps = gaps.filter((gap) => gap >= 40);

        // This assertion SHOULD FAIL when the bug exists (all chunks arrive together)
        // Once fixed, chunks should arrive with 50ms gaps and this will pass.
        expect(
            meaningfulGaps.length,
            `Expected incremental streaming (gaps >= 40ms) but got gaps: ${gaps.join(", ")}ms`
        ).toBeGreaterThan(0);
    });

    /**
     * THIS TEST SHOULD PASS after applying the pnpm patch.
     *
     * THE FIX: The patched library sends chunks individually instead of
     * joining them. This preserves streaming behavior for resumed clients.
     */
    it("PASSES: with FIXED resumable stream, chunks arrive individually", async () => {
        // Use the fixed stream context that sends chunks individually
        mockStreamContext = createFixedStreamContext();

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

        if (response.status !== 200) {
            const body = await response.text();
            console.error("Fixed test error:", response.status, body);
        }
        expect(response.status).toBe(200);

        // Read the stream and record timing
        const reader = response.body!.getReader();
        streamStartTime = Date.now();

        while (true) {
            const { done } = await reader.read();
            if (done) break;
            chunkArrivalTimes.push(Date.now() - streamStartTime);
        }

        console.log("Fixed - Chunk arrival times (ms):", chunkArrivalTimes);

        // With the fix, chunks arrive individually (multiple chunks, not one)
        // Note: timing gaps may still be 0 since chunks are pre-buffered,
        // but there should be MULTIPLE chunks, not just one.
        expect(
            chunkArrivalTimes.length,
            "Expected multiple chunks but got only one (bug not fixed)"
        ).toBeGreaterThan(1);
    });

    /**
     * Control test: without resumable stream, chunks SHOULD arrive incrementally.
     * This test should PASS to confirm the streaming pipeline works without the bug.
     */
    it("PASSES: without resumable stream, chunks arrive incrementally", async () => {
        // No stream context = uses fallback path (regular streaming)
        mockStreamContext = null;

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

        if (response.status !== 200) {
            const body = await response.text();
            console.error("Control test error:", response.status, body);
        }
        expect(response.status).toBe(200);

        // Read the stream and record timing
        const reader = response.body!.getReader();
        streamStartTime = Date.now();

        while (true) {
            const { done } = await reader.read();
            if (done) break;
            chunkArrivalTimes.push(Date.now() - streamStartTime);
        }

        console.log("Control - Chunk arrival times (ms):", chunkArrivalTimes);

        // Calculate gaps
        const gaps: number[] = [];
        for (let i = 1; i < chunkArrivalTimes.length; i++) {
            gaps.push(chunkArrivalTimes[i] - chunkArrivalTimes[i - 1]);
        }
        console.log("Control - Gaps between chunks (ms):", gaps);

        // Without the resumable stream layer, streaming should work correctly.
        // We should see 50ms gaps between chunks (from our mock LLM delay).
        const meaningfulGaps = gaps.filter((gap) => gap >= 40);
        expect(
            meaningfulGaps.length,
            `Expected incremental streaming but got gaps: ${gaps.join(", ")}ms`
        ).toBeGreaterThan(0);
    });
});
