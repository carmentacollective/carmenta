/**
 * Connection Persistence Tests
 *
 * Comprehensive tests for connection storage with 90%+ coverage.
 * Tests cover:
 * - Connection CRUD operations
 * - Message save/load with parts
 * - Tool call and generative UI persistence
 * - Streaming status for background save
 * - Window close / recovery simulation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the title generator to avoid LLM calls in tests
vi.mock("@/lib/db/title-generator", () => ({
    generateTitle: vi.fn((message: string) => {
        // Simulate LLM-style title generation with truncation
        if (message.length > 50) {
            return Promise.resolve(message.slice(0, 47) + "...");
        }
        return Promise.resolve(message);
    }),
}));

// Use native crypto.randomUUID() instead of uuid package
const uuid = () => crypto.randomUUID();

import { db, schema } from "@/lib/db";
import {
    createConnection,
    getConnectionWithMessages,
    getRecentConnections,
    updateConnection,
    archiveConnection,
    deleteConnection,
    saveMessage,
    updateMessage,
    upsertMessage,
    loadMessages,
    updateStreamingStatus,
    markAsBackground,
    findInterruptedConnections,
    generateTitleFromFirstMessage,
} from "@/lib/db/connections";
import {
    mapUIPartToDBPart,
    mapDBPartToUIPart,
    mapUIMessageToDB,
    mapDBMessageToUI,
    type UIMessageLike,
    type UIMessagePartLike,
} from "@/lib/db/message-mapping";

// ============================================================================
// FIXTURES
// ============================================================================

async function createTestUser(email = "test@example.com") {
    const [user] = await db
        .insert(schema.users)
        .values({
            email,
            clerkId: `clerk_${uuid()}`,
            firstName: "Test",
            lastName: "User",
        })
        .returning();
    return user;
}

function createTextMessage(
    id: string,
    role: "user" | "assistant",
    text: string
): UIMessageLike {
    return {
        id,
        role,
        parts: [{ type: "text", text }],
    };
}

function createToolCallMessage(
    id: string,
    toolName: string,
    state: string,
    input: Record<string, unknown>,
    output?: Record<string, unknown>
): UIMessageLike {
    const toolPart: UIMessagePartLike = {
        type: `tool-${toolName}`,
        toolCallId: `call_${uuid()}`,
        state,
        input,
        ...(output && { output }),
    };
    return {
        id,
        role: "assistant",
        parts: [toolPart],
    };
}

function createDataMessage(
    id: string,
    dataType: string,
    data: Record<string, unknown>
): UIMessageLike {
    return {
        id,
        role: "assistant",
        parts: [
            {
                type: `data-${dataType}`,
                id: `data_${uuid()}`,
                data,
            },
        ],
    };
}

// ============================================================================
// CONVERSATION CRUD TESTS
// ============================================================================

describe("Connection CRUD Operations", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
        testUser = await createTestUser();
    });

    describe("createConnection", () => {
        it("creates connection with defaults", async () => {
            const connection = await createConnection(testUser.id);

            expect(connection.id).toBeDefined();
            expect(connection.userId).toBe(testUser.id);
            expect(connection.status).toBe("active");
            expect(connection.streamingStatus).toBe("idle");
            expect(connection.title).toBeNull();
        });

        it("creates connection with title and model", async () => {
            const connection = await createConnection(
                testUser.id,
                "Test Chat",
                "anthropic/claude-sonnet-4"
            );

            expect(connection.title).toBe("Test Chat");
            expect(connection.modelId).toBe("anthropic/claude-sonnet-4");
        });
    });

    describe("getConnectionWithMessages", () => {
        it("returns connection with messages and parts", async () => {
            const connection = await createConnection(testUser.id, "Test Chat");

            await saveMessage(
                connection.id,
                createTextMessage(uuid(), "user", "Hello")
            );
            await saveMessage(
                connection.id,
                createTextMessage(uuid(), "assistant", "Hi there!")
            );

            const result = await getConnectionWithMessages(connection.id);

            expect(result).not.toBeNull();
            expect(result!.messages).toHaveLength(2);
            expect(result!.messages[0].parts).toHaveLength(1);
            expect(result!.messages[1].parts).toHaveLength(1);
        });

        it("returns null for non-existent connection", async () => {
            const result = await getConnectionWithMessages(999999999);
            expect(result).toBeNull();
        });
    });

    describe("getRecentConnections", () => {
        it("returns connections ordered by last activity", async () => {
            const conv1 = await createConnection(testUser.id, "First");
            const conv2 = await createConnection(testUser.id, "Second");

            // Add message to conv1 to make it more recent
            await saveMessage(conv1.id, createTextMessage(uuid(), "user", "test"));

            const recent = await getRecentConnections(testUser.id, 10);

            expect(recent).toHaveLength(2);
            expect(recent[0].id).toBe(conv1.id); // Most recent first
        });

        it("respects limit parameter", async () => {
            await createConnection(testUser.id, "One");
            await createConnection(testUser.id, "Two");
            await createConnection(testUser.id, "Three");

            const recent = await getRecentConnections(testUser.id, 2);
            expect(recent).toHaveLength(2);
        });

        it("filters by status", async () => {
            const active = await createConnection(testUser.id, "Active");
            const toArchive = await createConnection(testUser.id, "Will Archive");
            await archiveConnection(toArchive.id);

            const activeOnly = await getRecentConnections(testUser.id, 10, "active");
            expect(activeOnly).toHaveLength(1);
            expect(activeOnly[0].id).toBe(active.id);
        });
    });

    describe("updateConnection", () => {
        it("updates title", async () => {
            const connection = await createConnection(testUser.id);
            const updated = await updateConnection(connection.id, {
                title: "New Title",
            });

            expect(updated!.title).toBe("New Title");
        });

        it("updates status", async () => {
            const connection = await createConnection(testUser.id);
            const updated = await updateConnection(connection.id, {
                status: "background",
            });

            expect(updated!.status).toBe("background");
        });

        it("returns null for non-existent connection", async () => {
            const result = await updateConnection(999999999, { title: "Test" });
            expect(result).toBeNull();
        });
    });

    describe("archiveConnection", () => {
        it("sets status to archived", async () => {
            const connection = await createConnection(testUser.id);
            await archiveConnection(connection.id);

            const result = await getConnectionWithMessages(connection.id);
            expect(result!.status).toBe("archived");
        });
    });

    describe("deleteConnection", () => {
        it("removes connection and messages (cascade)", async () => {
            const connection = await createConnection(testUser.id);
            await saveMessage(connection.id, createTextMessage(uuid(), "user", "test"));

            await deleteConnection(connection.id);

            const result = await getConnectionWithMessages(connection.id);
            expect(result).toBeNull();
        });
    });
});

// ============================================================================
// MESSAGE PERSISTENCE TESTS
// ============================================================================

describe("Message Persistence", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let connection: Awaited<ReturnType<typeof createConnection>>;

    beforeEach(async () => {
        testUser = await createTestUser();
        connection = await createConnection(testUser.id, "Test Chat");
    });

    describe("saveMessage", () => {
        it("saves text message with parts", async () => {
            const messageId = uuid();
            await saveMessage(
                connection.id,
                createTextMessage(messageId, "user", "Hello world")
            );

            const messages = await loadMessages(connection.id);
            expect(messages).toHaveLength(1);
            expect(messages[0].id).toBe(messageId);
            expect(messages[0].role).toBe("user");
            expect(messages[0].parts[0]).toMatchObject({
                type: "text",
                text: "Hello world",
            });
        });

        it("saves multi-part message", async () => {
            const message: UIMessageLike = {
                id: uuid(),
                role: "assistant",
                parts: [
                    { type: "text", text: "Let me search for that" },
                    {
                        type: "tool-webSearch",
                        toolCallId: "call_1",
                        state: "input-available",
                        input: { query: "test" },
                    },
                    { type: "text", text: "Here are the results" },
                ],
            };

            await saveMessage(connection.id, message);

            const messages = await loadMessages(connection.id);
            expect(messages).toHaveLength(1);
            expect(messages[0].parts).toHaveLength(3);
            expect(messages[0].parts[0].type).toBe("text");
            expect(messages[0].parts[1].type).toBe("tool-webSearch");
            expect(messages[0].parts[2].type).toBe("text");
        });

        it("updates connection lastActivityAt", async () => {
            const before = new Date();
            await new Promise((r) => setTimeout(r, 10)); // Small delay

            await saveMessage(connection.id, createTextMessage(uuid(), "user", "test"));

            const conv = await getConnectionWithMessages(connection.id);
            expect(conv!.lastActivityAt.getTime()).toBeGreaterThan(before.getTime());
        });
    });

    describe("updateMessage", () => {
        it("replaces all parts atomically", async () => {
            const messageId = uuid();
            await saveMessage(
                connection.id,
                createToolCallMessage(messageId, "webSearch", "input-available", {
                    query: "test",
                })
            );

            // Update with output
            await updateMessage(
                messageId,
                createToolCallMessage(
                    messageId,
                    "webSearch",
                    "output-available",
                    { query: "test" },
                    { results: ["a", "b"] }
                )
            );

            const messages = await loadMessages(connection.id);
            expect(messages[0].parts[0]).toMatchObject({
                type: "tool-webSearch",
                state: "output-available",
                output: { results: ["a", "b"] },
            });
        });
    });

    describe("upsertMessage", () => {
        it("creates message if not exists", async () => {
            const messageId = uuid();
            await upsertMessage(
                connection.id,
                createTextMessage(messageId, "user", "Hello")
            );

            const messages = await loadMessages(connection.id);
            expect(messages).toHaveLength(1);
        });

        it("updates message if exists", async () => {
            const messageId = uuid();
            await upsertMessage(
                connection.id,
                createTextMessage(messageId, "user", "First")
            );
            await upsertMessage(
                connection.id,
                createTextMessage(messageId, "user", "Updated")
            );

            const messages = await loadMessages(connection.id);
            expect(messages).toHaveLength(1);
            expect(messages[0].parts[0]).toMatchObject({
                type: "text",
                text: "Updated",
            });
        });
    });

    describe("loadMessages", () => {
        it("returns messages in creation order", async () => {
            await saveMessage(
                connection.id,
                createTextMessage(uuid(), "user", "First")
            );
            await saveMessage(
                connection.id,
                createTextMessage(uuid(), "assistant", "Second")
            );
            await saveMessage(
                connection.id,
                createTextMessage(uuid(), "user", "Third")
            );

            const messages = await loadMessages(connection.id);

            expect(messages).toHaveLength(3);
            expect(messages[0].parts[0]).toMatchObject({ text: "First" });
            expect(messages[1].parts[0]).toMatchObject({ text: "Second" });
            expect(messages[2].parts[0]).toMatchObject({ text: "Third" });
        });

        it("returns empty array for non-existent connection", async () => {
            const messages = await loadMessages(999999999);
            expect(messages).toEqual([]);
        });
    });
});

// ============================================================================
// TOOL CALL PERSISTENCE TESTS
// ============================================================================

describe("Tool Call Persistence", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let connection: Awaited<ReturnType<typeof createConnection>>;

    beforeEach(async () => {
        testUser = await createTestUser();
        connection = await createConnection(testUser.id);
    });

    it("persists tool call with input-available state", async () => {
        const message = createToolCallMessage(uuid(), "webSearch", "input-available", {
            query: "best coffee shops",
        });

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts[0]).toMatchObject({
            type: "tool-webSearch",
            state: "input-available",
            input: { query: "best coffee shops" },
        });
    });

    it("persists tool call with output-available state", async () => {
        const message = createToolCallMessage(
            uuid(),
            "webSearch",
            "output-available",
            { query: "best coffee shops" },
            { results: [{ title: "Blue Bottle", url: "https://example.com" }] }
        );

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts[0]).toMatchObject({
            type: "tool-webSearch",
            state: "output-available",
            input: { query: "best coffee shops" },
            output: { results: [{ title: "Blue Bottle", url: "https://example.com" }] },
        });
    });

    it("persists tool call with error state", async () => {
        const message: UIMessageLike = {
            id: uuid(),
            role: "assistant",
            parts: [
                {
                    type: "tool-webSearch",
                    toolCallId: "call_1",
                    state: "output-error",
                    input: { query: "test" },
                    errorText: "API rate limit exceeded",
                },
            ],
        };

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts[0]).toMatchObject({
            type: "tool-webSearch",
            state: "output-error",
            errorText: "API rate limit exceeded",
        });
    });

    it("handles multiple tool calls in one message", async () => {
        const message: UIMessageLike = {
            id: uuid(),
            role: "assistant",
            parts: [
                { type: "text", text: "Let me search for both topics" },
                {
                    type: "tool-webSearch",
                    toolCallId: "call_1",
                    state: "output-available",
                    input: { query: "React performance" },
                    output: { results: [] },
                },
                {
                    type: "tool-webSearch",
                    toolCallId: "call_2",
                    state: "output-available",
                    input: { query: "Vue performance" },
                    output: { results: [] },
                },
                { type: "text", text: "Here are the results for both frameworks" },
            ],
        };

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts).toHaveLength(4);
        expect(messages[0].parts[1]).toMatchObject({
            input: { query: "React performance" },
        });
        expect(messages[0].parts[2]).toMatchObject({
            input: { query: "Vue performance" },
        });
    });
});

// ============================================================================
// GENERATIVE UI DATA PERSISTENCE TESTS
// ============================================================================

describe("Generative UI Data Persistence", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let connection: Awaited<ReturnType<typeof createConnection>>;

    beforeEach(async () => {
        testUser = await createTestUser();
        connection = await createConnection(testUser.id);
    });

    it("persists comparison data", async () => {
        const message = createDataMessage(uuid(), "comparison", {
            title: "Framework Comparison",
            options: ["React", "Vue"],
        });

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts[0]).toMatchObject({
            type: "data-comparison",
            data: {
                title: "Framework Comparison",
                options: ["React", "Vue"],
                loading: false,
            },
        });
    });

    it("persists comparison table data", async () => {
        const message = createDataMessage(uuid(), "comparison", {
            items: [
                { name: "Option A", price: 100 },
                { name: "Option B", price: 150 },
            ],
            criteria: ["price", "features"],
        });

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts[0]).toMatchObject({
            type: "data-comparison",
            data: {
                items: [
                    { name: "Option A", price: 100 },
                    { name: "Option B", price: 150 },
                ],
                loading: false,
            },
        });
    });

    it("persists search results data", async () => {
        const message = createDataMessage(uuid(), "searchResults", {
            query: "best coffee shops",
            results: [
                { title: "Blue Bottle", url: "https://example.com/1" },
                { title: "Sightglass", url: "https://example.com/2" },
            ],
        });

        await saveMessage(connection.id, message);
        const messages = await loadMessages(connection.id);

        expect(messages[0].parts[0]).toMatchObject({
            type: "data-searchResults",
            data: {
                query: "best coffee shops",
                results: expect.arrayContaining([
                    expect.objectContaining({ title: "Blue Bottle" }),
                ]),
            },
        });
    });
});

// ============================================================================
// STREAMING STATUS TESTS
// ============================================================================

describe("Streaming Status Management", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let connection: Awaited<ReturnType<typeof createConnection>>;

    beforeEach(async () => {
        testUser = await createTestUser();
        connection = await createConnection(testUser.id);
    });

    describe("updateStreamingStatus", () => {
        it("updates status to streaming", async () => {
            await updateStreamingStatus(connection.id, "streaming");

            const conv = await getConnectionWithMessages(connection.id);
            expect(conv!.streamingStatus).toBe("streaming");
        });

        it("updates status to completed", async () => {
            await updateStreamingStatus(connection.id, "streaming");
            await updateStreamingStatus(connection.id, "completed");

            const conv = await getConnectionWithMessages(connection.id);
            expect(conv!.streamingStatus).toBe("completed");
        });

        it("updates status to failed", async () => {
            await updateStreamingStatus(connection.id, "streaming");
            await updateStreamingStatus(connection.id, "failed");

            const conv = await getConnectionWithMessages(connection.id);
            expect(conv!.streamingStatus).toBe("failed");
        });
    });

    describe("markAsBackground", () => {
        it("changes connection status to background", async () => {
            await markAsBackground(connection.id);

            const conv = await getConnectionWithMessages(connection.id);
            expect(conv!.status).toBe("background");
        });
    });

    describe("findInterruptedConnections", () => {
        it("finds connections with streaming status", async () => {
            const conv1 = await createConnection(testUser.id, "Streaming");
            const conv2 = await createConnection(testUser.id, "Completed");

            await updateStreamingStatus(conv1.id, "streaming");
            await updateStreamingStatus(conv2.id, "completed");

            const interrupted = await findInterruptedConnections(testUser.id);

            expect(interrupted).toHaveLength(1);
            expect(interrupted[0].id).toBe(conv1.id);
        });

        it("returns empty array if no interrupted connections", async () => {
            const conv = await createConnection(testUser.id);
            await updateStreamingStatus(conv.id, "completed");

            const interrupted = await findInterruptedConnections(testUser.id);
            expect(interrupted).toEqual([]);
        });
    });
});

// ============================================================================
// BACKGROUND SAVE / WINDOW CLOSE SIMULATION
// ============================================================================

describe("Background Save - Window Close Simulation", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
        testUser = await createTestUser();
    });

    it("preserves partial response when window closes mid-stream", async () => {
        // Simulate: User sends message, streaming starts
        const connection = await createConnection(testUser.id, "Deep Research");
        await updateStreamingStatus(connection.id, "streaming");

        // User message saved immediately
        await saveMessage(
            connection.id,
            createTextMessage(uuid(), "user", "Research quantum computing")
        );

        // Partial assistant response saved during streaming
        const assistantId = uuid();
        await saveMessage(connection.id, {
            id: assistantId,
            role: "assistant",
            parts: [
                {
                    type: "text",
                    text: "I'll research that for you. Starting deep research...",
                },
                {
                    type: "tool-deepResearch",
                    toolCallId: "call_1",
                    state: "input-available",
                    input: { query: "quantum computing" },
                },
            ],
        });

        // WINDOW CLOSES HERE - streaming interrupted
        await markAsBackground(connection.id);

        // Simulate: User returns later
        const recovered = await getConnectionWithMessages(connection.id);

        expect(recovered!.status).toBe("background");
        expect(recovered!.streamingStatus).toBe("streaming");
        expect(recovered!.messages).toHaveLength(2);

        // Verify partial response is preserved
        const assistantMsg = recovered!.messages.find((m) => m.role === "assistant");
        expect(assistantMsg).toBeDefined();
        expect(assistantMsg!.parts).toHaveLength(2);
        expect(assistantMsg!.parts[1]).toMatchObject({
            type: "tool_call",
            toolCall: expect.objectContaining({
                toolName: "deepResearch",
                state: "input_available",
            }),
        });
    });

    it("can resume and complete interrupted connection", async () => {
        // Setup: Create interrupted connection
        const connection = await createConnection(testUser.id, "Interrupted");
        await updateStreamingStatus(connection.id, "streaming");
        const assistantId = uuid();
        await saveMessage(connection.id, createTextMessage(uuid(), "user", "Hello"));
        await saveMessage(connection.id, {
            id: assistantId,
            role: "assistant",
            parts: [{ type: "text", text: "Hi! Let me help with..." }],
        });
        await markAsBackground(connection.id);

        // Find interrupted connections
        const interrupted = await findInterruptedConnections(testUser.id);
        expect(interrupted).toHaveLength(1);

        // Resume: Update the assistant message with completed response
        await updateMessage(assistantId, {
            id: assistantId,
            role: "assistant",
            parts: [
                {
                    type: "text",
                    text: "Hi! Let me help with that. Here's my complete response.",
                },
            ],
        });
        await updateStreamingStatus(connection.id, "completed");
        await updateConnection(connection.id, { status: "active" });

        // Verify completion
        const completed = await getConnectionWithMessages(connection.id);
        expect(completed!.status).toBe("active");
        expect(completed!.streamingStatus).toBe("completed");
        // DB format uses textContent, not text
        expect(completed!.messages[1].parts[0]).toMatchObject({
            textContent: "Hi! Let me help with that. Here's my complete response.",
        });
    });

    it("handles multiple interrupted connections", async () => {
        // Create several interrupted connections
        for (let i = 0; i < 3; i++) {
            const conv = await createConnection(testUser.id, `Interrupted ${i}`);
            await updateStreamingStatus(conv.id, "streaming");
            await saveMessage(conv.id, createTextMessage(uuid(), "user", `Query ${i}`));
        }

        const interrupted = await findInterruptedConnections(testUser.id);
        expect(interrupted).toHaveLength(3);
    });
});

// ============================================================================
// MESSAGE MAPPING TESTS
// ============================================================================

describe("Message Mapping", () => {
    describe("mapUIPartToDBPart", () => {
        it("maps text part", () => {
            const part: UIMessagePartLike = { type: "text", text: "Hello" };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({
                messageId: "msg-1",
                order: 0,
                type: "text",
                textContent: "Hello",
            });
        });

        it("maps reasoning part", () => {
            const part: UIMessagePartLike = {
                type: "reasoning",
                text: "Let me think...",
                providerMetadata: { anthropic: { reasoning_tokens: 100 } },
            };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({
                type: "reasoning",
                reasoningContent: "Let me think...",
                providerMetadata: { anthropic: { reasoning_tokens: 100 } },
            });
        });

        it("maps file part", () => {
            const part: UIMessagePartLike = {
                type: "file",
                mediaType: "image/png",
                filename: "screenshot.png",
                url: "https://example.com/image.png",
            };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({
                type: "file",
                fileMediaType: "image/png",
                fileName: "screenshot.png",
                fileUrl: "https://example.com/image.png",
            });
        });

        it("maps step-start part", () => {
            const part: UIMessagePartLike = { type: "step-start" };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({ type: "step_start" });
        });

        it("maps tool call part", () => {
            const part: UIMessagePartLike = {
                type: "tool-webSearch",
                toolCallId: "call_123",
                state: "output-available",
                input: { query: "best coffee" },
                output: { results: [] },
            };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({
                type: "tool_call",
                toolCall: {
                    toolName: "webSearch",
                    toolCallId: "call_123",
                    state: "output_available",
                    input: { query: "best coffee" },
                    output: { results: [] },
                },
            });
        });

        it("maps data part", () => {
            const part: UIMessagePartLike = {
                type: "data-comparison",
                id: "data_123",
                data: { title: "Options", options: ["A", "B"] },
            };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({
                type: "data",
                dataContent: {
                    type: "comparison",
                    data: { title: "Options", options: ["A", "B"], id: "data_123" },
                    loading: false,
                },
            });
        });

        it("handles unknown part type gracefully", () => {
            const part: UIMessagePartLike = { type: "unknown-type", data: "test" };
            const result = mapUIPartToDBPart(part, "msg-1", 0);

            expect(result).toMatchObject({
                type: "text",
                textContent: "[Unknown part type: unknown-type]",
            });
        });
    });

    describe("mapUIMessageToDB", () => {
        it("maps complete message with parts", () => {
            const message: UIMessageLike = {
                id: "msg-1",
                role: "assistant",
                parts: [
                    { type: "text", text: "Hello" },
                    {
                        type: "tool-search",
                        toolCallId: "call_1",
                        state: "output-available",
                        input: { q: "test" },
                        output: { results: [] },
                    },
                ],
            };

            const { message: dbMsg, parts } = mapUIMessageToDB(message, 1);

            expect(dbMsg).toMatchObject({
                id: "msg-1",
                connectionId: 1,
                role: "assistant",
            });
            expect(parts).toHaveLength(2);
            expect(parts[0].order).toBe(0);
            expect(parts[1].order).toBe(1);
        });
    });
});

// ============================================================================
// TITLE GENERATION TESTS
// ============================================================================

describe("Title Generation", () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
        testUser = await createTestUser();
    });

    it("generates title from first user message", async () => {
        const connection = await createConnection(testUser.id);
        await saveMessage(
            connection.id,
            createTextMessage(uuid(), "user", "How do I cook pasta?")
        );

        await generateTitleFromFirstMessage(connection.id);

        const conv = await getConnectionWithMessages(connection.id);
        expect(conv!.title).toBe("How do I cook pasta?");
    });

    it("truncates long messages via LLM fallback", async () => {
        const connection = await createConnection(testUser.id);
        const longMessage = "A".repeat(100);
        await saveMessage(
            connection.id,
            createTextMessage(uuid(), "user", longMessage)
        );

        await generateTitleFromFirstMessage(connection.id);

        const conv = await getConnectionWithMessages(connection.id);
        // Mock returns 47 chars + "..." = 50 total
        expect(conv!.title).toHaveLength(50);
        expect(conv!.title!.endsWith("...")).toBe(true);
    });

    it("does not overwrite existing title", async () => {
        const connection = await createConnection(testUser.id, "Existing Title");
        await saveMessage(connection.id, createTextMessage(uuid(), "user", "Hello"));

        await generateTitleFromFirstMessage(connection.id);

        const conv = await getConnectionWithMessages(connection.id);
        expect(conv!.title).toBe("Existing Title");
    });

    it("handles connection with no user messages", async () => {
        const connection = await createConnection(testUser.id);
        // Only assistant messages, no user messages - title should not be generated
        await saveMessage(
            connection.id,
            createTextMessage(uuid(), "assistant", "Hello, how can I help?")
        );

        await generateTitleFromFirstMessage(connection.id);

        const conv = await getConnectionWithMessages(connection.id);
        expect(conv!.title).toBeNull();
    });
});
