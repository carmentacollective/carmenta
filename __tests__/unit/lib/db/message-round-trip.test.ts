/**
 * Message Round-Trip Fidelity Tests
 *
 * Ensures that messages rendered during first-pass streaming are identical
 * to messages rendered after DB storage and retrieval.
 *
 * The flow being tested:
 *   First-pass: UIMessage → render
 *   Round-trip: UIMessage → mapUIMessageToDB → DB → mapDBMessageToUI → toAIMessage → render
 *
 * These should produce equivalent results for the rendering layer.
 */

import { describe, it, expect } from "vitest";

import {
    mapUIMessageToDB,
    mapDBMessageToUI,
    type UIMessageLike,
    type MessageWithParts,
} from "@/lib/db/message-mapping";
import { toAIMessage } from "@/components/connection/connect-runtime-provider";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Simulates the complete round-trip: UI → DB → UI
 * Returns the message as it would appear after retrieval.
 */
function roundTrip(uiMessage: UIMessageLike): UIMessageLike {
    const connectionId = 1;

    // Step 1: Map to DB format
    const { message, parts } = mapUIMessageToDB(uiMessage, connectionId);

    // Step 2: Simulate DB storage and retrieval
    // Add the fields that would come from the database
    const dbMessage: MessageWithParts = {
        id: message.id,
        connectionId: message.connectionId,
        role: message.role,
        createdAt: new Date(),
        parts: parts.map((p, idx) => ({
            id: `part-${idx}`,
            messageId: p.messageId,
            type: p.type,
            order: p.order ?? 0,
            textContent: p.textContent ?? null,
            reasoningContent: p.reasoningContent ?? null,
            toolCall: p.toolCall ?? null,
            fileMediaType: p.fileMediaType ?? null,
            fileName: p.fileName ?? null,
            fileUrl: p.fileUrl ?? null,
            dataContent: p.dataContent ?? null,
            providerMetadata: p.providerMetadata ?? null,
            createdAt: new Date(),
        })),
    };

    // Step 3: Map back to UI format
    return mapDBMessageToUI(dbMessage);
}

/**
 * Normalizes a message for comparison by:
 * - Removing undefined values (DB returns null, which gets converted differently)
 * - Sorting object keys for consistent comparison
 * - Handling the loading: false that gets added on retrieval
 */
function normalizeForComparison(msg: UIMessageLike): Record<string, unknown> {
    return JSON.parse(
        JSON.stringify(msg, (key, value) => {
            // Remove createdAt as it's added by DB
            if (key === "createdAt") return undefined;
            // Normalize undefined to be omitted
            if (value === undefined) return undefined;
            return value;
        })
    );
}

/**
 * Compares two messages for rendering equivalence.
 * Some differences are acceptable (e.g., loading: false added on retrieval).
 */
function assertRenderingEquivalent(
    original: UIMessageLike,
    roundTripped: UIMessageLike,
    description: string
) {
    const normalizedOriginal = normalizeForComparison(original);
    const normalizedRoundTripped = normalizeForComparison(roundTripped);

    expect(normalizedRoundTripped, description).toEqual(normalizedOriginal);
}

// ============================================================================
// TEXT PARTS
// ============================================================================

describe("Round-trip fidelity: text parts", () => {
    it("preserves simple text content", () => {
        const original: UIMessageLike = {
            id: "msg-1",
            role: "assistant",
            parts: [{ type: "text", text: "Hello, world!" }],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Simple text");
    });

    it("preserves empty text content", () => {
        const original: UIMessageLike = {
            id: "msg-2",
            role: "assistant",
            parts: [{ type: "text", text: "" }],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Empty text");
    });

    it("preserves multi-part text messages", () => {
        const original: UIMessageLike = {
            id: "msg-3",
            role: "assistant",
            parts: [
                { type: "text", text: "First paragraph." },
                { type: "text", text: "Second paragraph." },
                { type: "text", text: "Third paragraph." },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Multi-part text");
    });

    it("preserves text with special characters", () => {
        const original: UIMessageLike = {
            id: "msg-4",
            role: "assistant",
            parts: [
                {
                    type: "text",
                    text: "Special chars: <script>alert('xss')</script> & \"quotes\" 'apostrophes' \n\t🎉",
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Special characters");
    });
});

// ============================================================================
// REASONING PARTS
// ============================================================================

describe("Round-trip fidelity: reasoning parts", () => {
    it("preserves reasoning text", () => {
        const original: UIMessageLike = {
            id: "msg-5",
            role: "assistant",
            parts: [
                {
                    type: "reasoning",
                    text: "Let me think about this step by step...",
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Reasoning text");
    });

    it("preserves reasoning with providerMetadata", () => {
        const original: UIMessageLike = {
            id: "msg-6",
            role: "assistant",
            parts: [
                {
                    type: "reasoning",
                    text: "Deep thinking...",
                    providerMetadata: {
                        anthropic: {
                            cacheControl: { type: "ephemeral" },
                        },
                    },
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Reasoning with metadata");
    });

    it("preserves reasoning followed by text", () => {
        const original: UIMessageLike = {
            id: "msg-7",
            role: "assistant",
            parts: [
                { type: "reasoning", text: "Thinking..." },
                { type: "text", text: "Here's my response." },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Reasoning + text");
    });
});

// ============================================================================
// TOOL CALL PARTS
// ============================================================================

describe("Round-trip fidelity: tool call parts", () => {
    it("preserves tool call with input-available state", () => {
        const original: UIMessageLike = {
            id: "msg-8",
            role: "assistant",
            parts: [
                {
                    type: "tool-webSearch",
                    toolCallId: "call-123",
                    state: "input-available",
                    input: { query: "best coffee shops SF" },
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Tool input-available");
    });

    it("preserves tool call with output-available state", () => {
        const original: UIMessageLike = {
            id: "msg-9",
            role: "assistant",
            parts: [
                {
                    type: "tool-webSearch",
                    toolCallId: "call-456",
                    state: "output-available",
                    input: { query: "weather today" },
                    output: { results: ["Sunny, 72°F"] },
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Tool output-available");
    });

    it("preserves tool call with output-error state", () => {
        const original: UIMessageLike = {
            id: "msg-10",
            role: "assistant",
            parts: [
                {
                    type: "tool-fetchData",
                    toolCallId: "call-789",
                    state: "output-error",
                    input: { url: "https://broken.example" },
                    errorText: "Connection refused",
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Tool output-error");
    });

    it("preserves tool call with input-streaming state", () => {
        const original: UIMessageLike = {
            id: "msg-11",
            role: "assistant",
            parts: [
                {
                    type: "tool-calculate",
                    toolCallId: "call-stream",
                    state: "input-streaming",
                    input: { partial: "2 + " },
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Tool input-streaming");
    });

    it("preserves multiple tool calls in sequence", () => {
        const original: UIMessageLike = {
            id: "msg-12",
            role: "assistant",
            parts: [
                {
                    type: "tool-webSearch",
                    toolCallId: "call-1",
                    state: "output-available",
                    input: { query: "first search" },
                    output: { results: ["result 1"] },
                },
                {
                    type: "tool-webSearch",
                    toolCallId: "call-2",
                    state: "output-available",
                    input: { query: "second search" },
                    output: { results: ["result 2"] },
                },
                { type: "text", text: "Based on my research..." },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Multiple tool calls");
    });

    it("preserves complex nested tool input/output", () => {
        const original: UIMessageLike = {
            id: "msg-13",
            role: "assistant",
            parts: [
                {
                    type: "tool-complexTool",
                    toolCallId: "call-nested",
                    state: "output-available",
                    input: {
                        nested: {
                            deeply: {
                                value: [1, 2, { key: "value" }],
                            },
                        },
                        array: [{ a: 1 }, { b: 2 }],
                    },
                    output: {
                        response: {
                            items: [
                                { id: 1, meta: { tags: ["a", "b"] } },
                                { id: 2, meta: { tags: ["c"] } },
                            ],
                        },
                    },
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Complex nested data");
    });
});

// ============================================================================
// FILE PARTS
// ============================================================================

describe("Round-trip fidelity: file parts", () => {
    it("preserves file attachment with mediaType", () => {
        const original: UIMessageLike = {
            id: "msg-14",
            role: "user",
            parts: [
                {
                    type: "file",
                    mediaType: "image/png",
                    name: "screenshot.png",
                    url: "https://example.com/image.png",
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "File with mediaType");
    });

    it("preserves file attachment with mimeType alias", () => {
        // Some sources use mimeType instead of mediaType
        const original: UIMessageLike = {
            id: "msg-15",
            role: "user",
            parts: [
                {
                    type: "file",
                    mimeType: "application/pdf",
                    name: "document.pdf",
                    url: "https://example.com/doc.pdf",
                },
            ],
        };

        // After round-trip, should be normalized to mediaType
        const result = roundTrip(original);

        // The mimeType should become mediaType
        expect(result.parts[0]).toMatchObject({
            type: "file",
            mediaType: "application/pdf",
            name: "document.pdf",
            url: "https://example.com/doc.pdf",
        });
    });

    it("preserves text with file attachments", () => {
        const original: UIMessageLike = {
            id: "msg-16",
            role: "user",
            parts: [
                { type: "text", text: "What's in this image?" },
                {
                    type: "file",
                    mediaType: "image/jpeg",
                    name: "photo.jpg",
                    url: "https://example.com/photo.jpg",
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Text + file");
    });
});

// ============================================================================
// DATA PARTS (GENERATIVE UI)
// ============================================================================

describe("Round-trip fidelity: data parts", () => {
    it("preserves comparison data part", () => {
        const original: UIMessageLike = {
            id: "msg-17",
            role: "assistant",
            parts: [
                {
                    type: "data-comparison",
                    id: "comp-123",
                    data: {
                        options: [
                            { name: "Option A", score: 85 },
                            { name: "Option B", score: 92 },
                        ],
                        winner: "Option B",
                    },
                },
            ],
        };

        const result = roundTrip(original);

        // Data parts get loading: false added on retrieval
        expect(result.parts[0]).toMatchObject({
            type: "data-comparison",
            id: "comp-123",
            data: {
                options: [
                    { name: "Option A", score: 85 },
                    { name: "Option B", score: 92 },
                ],
                winner: "Option B",
                loading: false,
            },
        });
    });

    it("preserves research data part", () => {
        const original: UIMessageLike = {
            id: "msg-18",
            role: "assistant",
            parts: [
                {
                    type: "data-research",
                    id: "research-456",
                    data: {
                        sources: [
                            { title: "Source 1", url: "https://example.com/1" },
                            { title: "Source 2", url: "https://example.com/2" },
                        ],
                        summary: "Key findings...",
                    },
                },
            ],
        };

        const result = roundTrip(original);

        expect(result.parts[0]).toMatchObject({
            type: "data-research",
            id: "research-456",
        });
    });

    it("preserves data part followed by text", () => {
        const original: UIMessageLike = {
            id: "msg-19",
            role: "assistant",
            parts: [
                {
                    type: "data-chart",
                    id: "chart-789",
                    data: {
                        type: "bar",
                        values: [10, 20, 30],
                    },
                },
                { type: "text", text: "As you can see in the chart above..." },
            ],
        };

        const result = roundTrip(original);

        expect(result.parts).toHaveLength(2);
        expect(result.parts[0].type).toBe("data-chart");
        expect(result.parts[1]).toMatchObject({
            type: "text",
            text: "As you can see in the chart above...",
        });
    });
});

// ============================================================================
// STEP-START PARTS
// ============================================================================

describe("Round-trip fidelity: step-start parts", () => {
    it("preserves step-start markers", () => {
        const original: UIMessageLike = {
            id: "msg-20",
            role: "assistant",
            parts: [
                { type: "step-start" },
                { type: "text", text: "First step response" },
                { type: "step-start" },
                { type: "text", text: "Second step response" },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "Step-start markers");
    });
});

// ============================================================================
// COMPLEX MIXED MESSAGES
// ============================================================================

describe("Round-trip fidelity: complex mixed messages", () => {
    it("preserves full agentic response pattern", () => {
        const original: UIMessageLike = {
            id: "msg-21",
            role: "assistant",
            parts: [
                { type: "reasoning", text: "Let me research this..." },
                { type: "step-start" },
                {
                    type: "tool-webSearch",
                    toolCallId: "call-search",
                    state: "output-available",
                    input: { query: "latest news" },
                    output: { results: ["News item 1", "News item 2"] },
                },
                { type: "step-start" },
                { type: "text", text: "Based on my research, here's what I found:" },
                {
                    type: "data-comparison",
                    id: "compare-results",
                    data: {
                        items: ["Item A", "Item B"],
                        recommendation: "Item A",
                    },
                },
                { type: "text", text: "I recommend Item A because..." },
            ],
        };

        const result = roundTrip(original);

        // Check part count and types preserved
        expect(result.parts).toHaveLength(7);
        expect(result.parts.map((p) => p.type)).toEqual([
            "reasoning",
            "step-start",
            "tool-webSearch",
            "step-start",
            "text",
            "data-comparison",
            "text",
        ]);

        // Check specific content preserved
        expect(result.parts[0]).toMatchObject({
            type: "reasoning",
            text: "Let me research this...",
        });
        expect(result.parts[2]).toMatchObject({
            type: "tool-webSearch",
            state: "output-available",
            input: { query: "latest news" },
            output: { results: ["News item 1", "News item 2"] },
        });
    });

    it("preserves user message with text and files", () => {
        const original: UIMessageLike = {
            id: "msg-22",
            role: "user",
            parts: [
                { type: "text", text: "Analyze these images:" },
                {
                    type: "file",
                    mediaType: "image/png",
                    name: "chart1.png",
                    url: "https://example.com/chart1.png",
                },
                {
                    type: "file",
                    mediaType: "image/png",
                    name: "chart2.png",
                    url: "https://example.com/chart2.png",
                },
            ],
        };

        const result = roundTrip(original);
        assertRenderingEquivalent(original, result, "User text + files");
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Round-trip fidelity: edge cases", () => {
    it("preserves message order across round-trip", () => {
        const original: UIMessageLike = {
            id: "msg-23",
            role: "assistant",
            parts: [
                { type: "text", text: "Part 1" },
                { type: "text", text: "Part 2" },
                { type: "text", text: "Part 3" },
                { type: "text", text: "Part 4" },
                { type: "text", text: "Part 5" },
            ],
        };

        const result = roundTrip(original);

        expect(
            result.parts.map((p) => (p as unknown as { text: string }).text)
        ).toEqual(["Part 1", "Part 2", "Part 3", "Part 4", "Part 5"]);
    });

    it("handles null vs undefined in providerMetadata", () => {
        // First pass might have undefined, DB returns null
        const original: UIMessageLike = {
            id: "msg-24",
            role: "assistant",
            parts: [{ type: "reasoning", text: "Thinking..." }],
        };

        const result = roundTrip(original);

        // Should still work for rendering - providerMetadata being undefined vs null
        // shouldn't affect the component
        expect(result.parts[0]).toMatchObject({
            type: "reasoning",
            text: "Thinking...",
        });
    });

    it("handles tool call without output field", () => {
        // During streaming, output might not exist yet
        const original: UIMessageLike = {
            id: "msg-25",
            role: "assistant",
            parts: [
                {
                    type: "tool-pending",
                    toolCallId: "call-no-output",
                    state: "input-available",
                    input: { param: "value" },
                    // No output field
                },
            ],
        };

        const result = roundTrip(original);

        // Output should not appear after round-trip if it wasn't there
        expect(result.parts[0]).not.toHaveProperty("output");
    });

    it("handles all roles", () => {
        const roles: Array<"user" | "assistant" | "system"> = [
            "user",
            "assistant",
            "system",
        ];

        for (const role of roles) {
            const original: UIMessageLike = {
                id: `msg-role-${role}`,
                role,
                parts: [{ type: "text", text: `Message from ${role}` }],
            };

            const result = roundTrip(original);
            expect(result.role).toBe(role);
        }
    });
});

// ============================================================================
// KNOWN DIFFERENCES (Documenting Expected vs Bug)
// ============================================================================

/**
 * This section documents differences between first-pass and retrieval rendering.
 * Some differences are EXPECTED (streaming-only state), others would be BUGS.
 *
 * EXPECTED DIFFERENCES (streaming context, not data):
 * - isStreaming prop: true during streaming, false after retrieval
 * - wasStopped state: Tracked in React state, not persisted
 * - Transient messages: Status updates like "Searching..." aren't persisted
 * - ThinkingIndicator: Shown during streaming, not after retrieval
 * - PendingAssistantMessage: Shown before first token, not after retrieval
 *
 * WOULD BE BUGS (data differences that affect rendering):
 * - Missing or corrupted text content
 * - Wrong tool state (e.g., output-available becoming input-available)
 * - Missing tool output data
 * - Corrupted nested JSON in tool input/output
 * - Wrong part order
 * - Missing parts entirely
 * - Reasoning content lost or corrupted
 */

describe("Known differences: streaming vs retrieval context", () => {
    it("documents expected loading state difference (not a data bug)", () => {
        // During streaming: component receives isStreaming=true
        // After retrieval: component receives isStreaming=false
        // This is expected and handled by the rendering layer, not a data issue

        const message: UIMessageLike = {
            id: "msg-streaming-test",
            role: "assistant",
            parts: [{ type: "text", text: "Still generating..." }],
        };

        // The data round-trips correctly
        const result = roundTrip(message);
        expect(result.parts[0]).toMatchObject({
            type: "text",
            text: "Still generating...",
        });

        // The rendering difference comes from context (isStreaming prop),
        // not from the message data itself
    });

    it("documents expected data.loading normalization for data parts", () => {
        // During streaming: data.loading might be true or undefined
        // After retrieval: data.loading is always false (completed)
        // This is intentional - we don't persist loading state

        const streamingData: UIMessageLike = {
            id: "msg-loading-test",
            role: "assistant",
            parts: [
                {
                    type: "data-research",
                    id: "research-1",
                    data: {
                        loading: true, // Still loading during stream
                        partial: "Some results...",
                    },
                },
            ],
        };

        const result = roundTrip(streamingData);

        // After round-trip, loading is false (data is complete when persisted)
        expect((result.parts[0] as Record<string, unknown>).data).toMatchObject({
            loading: false,
            partial: "Some results...",
        });
    });
});

// ============================================================================
// toAIMessage INTEGRATION
// ============================================================================

describe("Round-trip through toAIMessage", () => {
    it("produces identical UIMessage for rendering", () => {
        const original: UIMessageLike = {
            id: "msg-full-trip",
            role: "assistant",
            parts: [
                { type: "reasoning", text: "Thinking..." },
                {
                    type: "tool-search",
                    toolCallId: "call-1",
                    state: "output-available",
                    input: { q: "test" },
                    output: { results: [] },
                },
                { type: "text", text: "Here's the answer." },
            ],
        };

        // Simulate first-pass rendering
        const firstPassUIMessage = toAIMessage(original);

        // Simulate round-trip
        const afterRoundTrip = roundTrip(original);
        const roundTripUIMessage = toAIMessage(afterRoundTrip);

        // Compare the two - they should be equivalent for rendering
        expect(roundTripUIMessage.id).toBe(firstPassUIMessage.id);
        expect(roundTripUIMessage.role).toBe(firstPassUIMessage.role);
        expect(roundTripUIMessage.parts).toHaveLength(firstPassUIMessage.parts.length);

        // Check each part
        for (let i = 0; i < firstPassUIMessage.parts.length; i++) {
            const firstPart = firstPassUIMessage.parts[i] as Record<string, unknown>;
            const roundTripPart = roundTripUIMessage.parts[i] as Record<
                string,
                unknown
            >;

            expect(roundTripPart.type).toBe(firstPart.type);

            // For text parts
            if (firstPart.type === "text") {
                expect(roundTripPart.text).toBe(firstPart.text);
            }

            // For reasoning parts
            if (firstPart.type === "reasoning") {
                expect(roundTripPart.text).toBe(firstPart.text);
            }

            // For tool parts
            if (
                typeof firstPart.type === "string" &&
                firstPart.type.startsWith("tool-")
            ) {
                expect(roundTripPart.toolCallId).toBe(firstPart.toolCallId);
                expect(roundTripPart.state).toBe(firstPart.state);
                expect(roundTripPart.input).toEqual(firstPart.input);
                if (firstPart.output !== undefined) {
                    expect(roundTripPart.output).toEqual(firstPart.output);
                }
            }
        }
    });
});
