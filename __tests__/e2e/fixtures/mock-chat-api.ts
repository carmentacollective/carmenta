/**
 * Mock Chat API Fixtures for E2E Tests
 *
 * Provides Playwright route handlers that mock the Vercel AI SDK streaming responses.
 * Enables deterministic, fast, and cost-free E2E testing of chat functionality.
 *
 * Usage:
 * ```typescript
 * import { mockChatApi, createMockResponse } from "./fixtures/mock-chat-api";
 *
 * test("chat displays mocked response", async ({ page }) => {
 *     const mockResponse = createMockResponse()
 *         .withText("Hello from mock!")
 *         .withTitle("Test Connection");
 *
 *     await mockChatApi(page, mockResponse);
 *     // ... test the chat UI
 * });
 * ```
 *
 * @see https://playwright.dev/docs/network
 */

import type { Page, Route } from "@playwright/test";

/** Headers returned by the chat API */
interface MockHeaders {
    "X-Connection-Id": string;
    "X-Connection-Is-New"?: string;
    "X-Connection-Slug"?: string;
    "X-Connection-Title"?: string;
    "X-Concierge-Model-Id": string;
    "X-Concierge-Temperature": string;
    "X-Concierge-Explanation": string;
    "X-Concierge-Reasoning": string;
    // Standard SSE headers
    "Content-Type": string;
    "Cache-Control": string;
    Connection: string;
    // AI SDK stream protocol version identifier (required for proper parsing)
    "x-vercel-ai-ui-message-stream": string;
    "x-accel-buffering": string;
}

/**
 * SSE data part types matching AI SDK UIMessageStream protocol.
 *
 * The AI SDK uses a start/delta/end pattern for streaming content:
 * - text-start, text-delta, text-end for text content
 * - reasoning-start, reasoning-delta, reasoning-end for thinking
 * - tool-input-start, tool-input-available for tool calls
 * - tool-output-available for tool results
 * - start, start-step, finish-step, finish for lifecycle
 * - data-* types (like data-transient) for custom data
 */
type SsePartType =
    | "start"
    | "start-step"
    | "text-start"
    | "text-delta"
    | "text-end"
    | "reasoning-start"
    | "reasoning-delta"
    | "reasoning-end"
    | "tool-input-start"
    | "tool-input-available"
    | "tool-output-available"
    | "data-transient"
    | "finish-step"
    | "finish";

interface SsePart {
    type: SsePartType | string; // string allows data-* types
    [key: string]: unknown;
}

/** Counter for generating unique part IDs */
let partIdCounter = 0;
function nextPartId(prefix: string): string {
    return `${prefix}-${++partIdCounter}`;
}

/** Builder for constructing mock chat API responses */
export class MockResponseBuilder {
    private parts: SsePart[] = [];
    private connectionId = "abc123xyz";
    private connectionSlug = "test-connection";
    private connectionTitle = "Test Connection";
    private isNewConnection = true;
    private modelId = "claude-3-5-haiku-20241022";
    private temperature = 0.7;
    private explanation = "Selected for testing";
    private reasoning = { enabled: false };
    private streamDelay = 0;

    /**
     * Add text content to the response.
     * Uses the AI SDK's text-start/text-delta/text-end pattern.
     */
    withText(text: string): this {
        const id = nextPartId("text");
        this.parts.push({ type: "text-start", id });
        this.parts.push({ type: "text-delta", id, delta: text });
        this.parts.push({ type: "text-end", id });
        return this;
    }

    /**
     * Add reasoning/thinking content (shown in thinking indicator).
     * Uses the AI SDK's reasoning-start/reasoning-delta/reasoning-end pattern.
     */
    withReasoning(text: string): this {
        const id = nextPartId("reasoning");
        this.parts.push({ type: "reasoning-start", id });
        this.parts.push({ type: "reasoning-delta", id, delta: text });
        this.parts.push({ type: "reasoning-end", id });
        return this;
    }

    /**
     * Add a transient status message (shown during streaming).
     */
    withStatus(id: string, text: string, icon?: string): this {
        this.parts.push({
            type: "data-transient",
            id,
            data: {
                id,
                type: "status",
                destination: "chat",
                text,
                ...(icon && { icon }),
            },
            transient: true,
        });
        return this;
    }

    /**
     * Add a title update event (for testing URL transitions).
     */
    withTitleUpdate(title: string, slug: string, connectionId?: string): this {
        this.connectionTitle = title;
        this.connectionSlug = slug;
        if (connectionId) this.connectionId = connectionId;

        this.parts.push({
            type: "data-transient",
            id: "title-update",
            data: {
                id: "title-update",
                type: "title-update",
                destination: "chat",
                text: title,
                metadata: {
                    title,
                    slug,
                    connectionId: connectionId ?? this.connectionId,
                },
            },
            transient: true,
        });
        return this;
    }

    /**
     * Add a tool call part.
     * Uses the AI SDK's tool-input-start/tool-input-available pattern.
     */
    withToolCall(
        toolName: string,
        toolCallId: string,
        args: Record<string, unknown>
    ): this {
        this.parts.push({
            type: "tool-input-start",
            toolCallId,
            toolName,
        });
        this.parts.push({
            type: "tool-input-available",
            toolCallId,
            toolName,
            input: args,
        });
        return this;
    }

    /**
     * Add a tool result part.
     * Uses the AI SDK's tool-output-available pattern.
     */
    withToolResult(toolName: string, toolCallId: string, result: unknown): this {
        this.parts.push({
            type: "tool-output-available",
            toolCallId,
            output: result,
        });
        return this;
    }

    /**
     * Set the connection ID returned in headers.
     */
    withConnectionId(id: string): this {
        this.connectionId = id;
        return this;
    }

    /**
     * Set whether this is a new connection (triggers URL update).
     */
    asNewConnection(isNew = true): this {
        this.isNewConnection = isNew;
        return this;
    }

    /**
     * Set the connection title.
     */
    withTitle(title: string): this {
        this.connectionTitle = title;
        this.connectionSlug = generateSlug(title);
        return this;
    }

    /**
     * Set the model ID.
     */
    withModel(modelId: string): this {
        this.modelId = modelId;
        return this;
    }

    /**
     * Add artificial delay between SSE chunks (for testing streaming UI).
     */
    withStreamDelay(ms: number): this {
        this.streamDelay = ms;
        return this;
    }

    /**
     * Build the headers object.
     */
    buildHeaders(): MockHeaders {
        const headers: MockHeaders = {
            "X-Connection-Id": this.connectionId,
            "X-Concierge-Model-Id": this.modelId,
            "X-Concierge-Temperature": String(this.temperature),
            "X-Concierge-Explanation": encodeURIComponent(this.explanation),
            "X-Concierge-Reasoning": encodeURIComponent(JSON.stringify(this.reasoning)),
            // Standard SSE headers (matching AI SDK's UI_MESSAGE_STREAM_HEADERS)
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            // AI SDK stream protocol version - required for client to parse correctly
            "x-vercel-ai-ui-message-stream": "v1",
            "x-accel-buffering": "no",
        };

        if (this.isNewConnection) {
            headers["X-Connection-Is-New"] = "true";
            headers["X-Connection-Slug"] = this.connectionSlug;
            headers["X-Connection-Title"] = encodeURIComponent(this.connectionTitle);
        }

        return headers;
    }

    /**
     * Build the SSE body string following AI SDK UIMessageStream protocol.
     *
     * The protocol expects:
     * 1. start - stream initialization
     * 2. start-step - beginning of a processing step
     * 3. content parts (text-*, reasoning-*, tool-*, data-*)
     * 4. finish-step - end of processing step
     * 5. finish - stream completion
     * 6. [DONE] - SSE terminator
     */
    buildBody(): string {
        const lines: string[] = [];

        // Stream lifecycle start
        lines.push(`data: ${JSON.stringify({ type: "start" })}`);
        lines.push("");
        lines.push(`data: ${JSON.stringify({ type: "start-step" })}`);
        lines.push("");

        // Content parts
        for (const part of this.parts) {
            lines.push(`data: ${JSON.stringify(part)}`);
            lines.push("");
        }

        // Stream lifecycle end
        lines.push(`data: ${JSON.stringify({ type: "finish-step" })}`);
        lines.push("");
        lines.push(
            `data: ${JSON.stringify({
                type: "finish",
                finishReason: "stop",
            })}`
        );
        lines.push("");

        // SSE terminator
        lines.push("data: [DONE]");
        lines.push("");

        return lines.join("\n");
    }

    /**
     * Get stream delay for use in route handler.
     */
    getStreamDelay(): number {
        return this.streamDelay;
    }
}

/**
 * Create a new mock response builder.
 */
export function createMockResponse(): MockResponseBuilder {
    return new MockResponseBuilder();
}

/**
 * Generate a URL-safe slug from a title.
 * Simplified version matching the production implementation.
 */
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50);
}

/**
 * Mock the chat API endpoint with a prepared response.
 *
 * @param page - Playwright page object
 * @param response - MockResponseBuilder with configured response
 *
 * @example
 * ```typescript
 * const mockResponse = createMockResponse()
 *     .withText("Hello!")
 *     .withTitle("My Chat");
 *
 * await mockChatApi(page, mockResponse);
 * await page.goto("/connection/new/new");
 * // ... interact with chat
 * ```
 */
export async function mockChatApi(
    page: Page,
    response: MockResponseBuilder
): Promise<void> {
    await page.route("**/api/connection", async (route: Route) => {
        const headers = response.buildHeaders();
        const body = response.buildBody();
        const delay = response.getStreamDelay();

        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        await route.fulfill({
            status: 200,
            headers: headers as unknown as Record<string, string>,
            body,
        });
    });
}

/**
 * Mock the chat API to return an error response.
 *
 * @param page - Playwright page object
 * @param statusCode - HTTP status code (default: 500)
 * @param message - Error message
 */
export async function mockChatApiError(
    page: Page,
    statusCode = 500,
    message = "Internal server error"
): Promise<void> {
    await page.route("**/api/connection", async (route: Route) => {
        await route.fulfill({
            status: statusCode,
            contentType: "application/json",
            body: JSON.stringify({ error: message }),
        });
    });
}

/**
 * Clear any mocked routes for the chat API.
 */
export async function clearChatApiMock(page: Page): Promise<void> {
    await page.unroute("**/api/connection");
}

/**
 * Pre-built mock responses for common test scenarios.
 */
export const MOCK_RESPONSES = {
    /**
     * Simple greeting response.
     */
    greeting: () =>
        createMockResponse()
            .withText("Hello! How can we help you today?")
            .withTitle("New Connection"),

    /**
     * Response with title generation (tests URL update).
     */
    withTitleGeneration: (title: string) =>
        createMockResponse()
            .withText(`Let me help you with that.`)
            .withTitle(title)
            .withTitleUpdate(title, generateSlug(title)),

    /**
     * Response with thinking/reasoning indicator.
     */
    withThinking: () =>
        createMockResponse()
            .withReasoning("Let me think about this...")
            .withText("After careful consideration, here's my answer."),

    /**
     * Response with status updates during streaming.
     */
    withStatusUpdates: () =>
        createMockResponse()
            .withStatus("search", "Searching...", "🔍")
            .withStatus("search", "Found 3 results", "✓")
            .withText("Based on my search, here's what I found."),

    /**
     * Response with tool call and result.
     */
    withToolCall: (toolName: string, args: Record<string, unknown>) =>
        createMockResponse()
            .withToolCall(toolName, `call_${Date.now()}`, args)
            .withText("I used a tool to help answer your question."),
} as const;
