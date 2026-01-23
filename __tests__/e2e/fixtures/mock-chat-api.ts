/**
 * Mock Chat API for E2E Tests
 *
 * Intercepts /api/connection requests and returns deterministic SSE responses.
 * This enables fast, reliable, and cost-free E2E testing of chat functionality.
 *
 * The mock uses the same Vercel AI SDK streaming format as the real API:
 * - text-start, text-delta, text-end for text content
 * - tool-call, tool-result for tool execution
 * - Custom data-* events for UI parts
 *
 * @example
 * ```typescript
 * // Option 1: Build custom response
 * await mockChatApi(page, createMockResponse()
 *     .withText("Hello from mock!")
 *     .withTitle("Test Chat"));
 *
 * // Option 2: Use pre-built response
 * await mockChatApi(page, MOCK_RESPONSES.greeting());
 * ```
 */

import type { Page, Route } from "@playwright/test";
import { nanoid } from "nanoid";

/**
 * Tool call configuration for mock responses
 */
export interface MockToolCall {
    name: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
}

/**
 * Configuration for a mock chat response
 */
export interface MockChatResponse {
    /** The text content to stream */
    text: string;
    /** Connection ID to return in headers */
    connectionId?: string;
    /** Connection slug for new connections */
    connectionSlug?: string;
    /** Connection title for new connections */
    title?: string;
    /** Model ID to return in concierge headers */
    modelId?: string;
    /** Tool calls to include in response */
    toolCalls?: MockToolCall[];
    /** Simulate an error response */
    error?: { message: string; status: number };
    /** Delay between text chunks (ms) - simulates streaming */
    chunkDelay?: number;
}

/**
 * Fluent builder for creating mock responses
 */
export class MockResponseBuilder {
    private config: MockChatResponse = {
        text: "",
        modelId: "anthropic/claude-haiku-4.5",
    };

    /** Set the text content to stream */
    withText(text: string): this {
        this.config.text = text;
        return this;
    }

    /** Set the connection ID */
    withConnectionId(id: string): this {
        this.config.connectionId = id;
        return this;
    }

    /** Set connection slug (for new connections) */
    withSlug(slug: string): this {
        this.config.connectionSlug = slug;
        return this;
    }

    /** Set connection title (for new connections) */
    withTitle(title: string): this {
        this.config.title = title;
        return this;
    }

    /** Set the model ID in response headers */
    withModel(modelId: string): this {
        this.config.modelId = modelId;
        return this;
    }

    /** Add a tool call to the response */
    withToolCall(
        name: string,
        input: Record<string, unknown>,
        output: Record<string, unknown>
    ): this {
        if (!this.config.toolCalls) {
            this.config.toolCalls = [];
        }
        this.config.toolCalls.push({ name, input, output });
        return this;
    }

    /** Simulate an error response */
    withError(message: string, status = 500): this {
        this.config.error = { message, status };
        return this;
    }

    /** Set delay between text chunks to simulate streaming */
    withChunkDelay(delayMs: number): this {
        this.config.chunkDelay = delayMs;
        return this;
    }

    /** Build the final configuration */
    build(): MockChatResponse {
        return { ...this.config };
    }
}

/**
 * Create a new mock response builder
 */
export function createMockResponse(): MockResponseBuilder {
    return new MockResponseBuilder();
}

/**
 * Pre-built mock responses for common scenarios
 */
export const MOCK_RESPONSES = {
    /** Simple greeting response */
    greeting: () =>
        createMockResponse()
            .withText("Hello! How can I help you today?")
            .withTitle("Greeting")
            .build(),

    /** Response with a web search tool call */
    webSearch: (query: string, results: string) =>
        createMockResponse()
            .withText(`Here's what I found about "${query}":\n\n${results}`)
            .withToolCall(
                "webSearch",
                { query },
                {
                    results: [
                        {
                            title: "Result",
                            snippet: results,
                            url: "https://example.com",
                        },
                    ],
                }
            )
            .build(),

    /** Error response - simulates API failure */
    error: (message = "Something went wrong") =>
        createMockResponse().withError(message, 500).build(),

    /** Retry scenario - first fails, then succeeds */
    retrySuccess: () =>
        createMockResponse().withText("Successfully processed after retry!").build(),

    /** Long response for testing scroll behavior */
    longResponse: () =>
        createMockResponse()
            .withText(
                "This is a longer response that tests scroll behavior.\n\n" +
                    Array(10)
                        .fill(null)
                        .map(
                            (_, i) =>
                                `Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`
                        )
                        .join("\n\n")
            )
            .build(),

    /** Response for testing message editing */
    editedResponse: (originalQuery: string, editedQuery: string) =>
        createMockResponse()
            .withText(
                `You edited your message from "${originalQuery}" to "${editedQuery}". Here's my updated response.`
            )
            .build(),
};

/**
 * Convert mock config to SSE stream body
 */
function buildSSEBody(config: MockChatResponse): string {
    const events: string[] = [];
    const messageId = `msg-${nanoid(8)}`;
    const textId = `text-${nanoid(8)}`;

    // Message start
    events.push(`data: {"type":"message-start","id":"${messageId}"}\n\n`);

    // Text content
    if (config.text) {
        events.push(`data: {"type":"text-start","id":"${textId}"}\n\n`);

        // Stream text in chunks for more realistic simulation
        const chunkSize = 50;
        for (let i = 0; i < config.text.length; i += chunkSize) {
            const chunk = config.text.slice(i, i + chunkSize);
            // Escape special characters for JSON
            const escaped = JSON.stringify(chunk).slice(1, -1);
            events.push(
                `data: {"type":"text-delta","id":"${textId}","delta":"${escaped}"}\n\n`
            );
        }

        events.push(`data: {"type":"text-end","id":"${textId}"}\n\n`);
    }

    // Tool calls
    if (config.toolCalls) {
        for (const tool of config.toolCalls) {
            const toolCallId = `call-${nanoid(8)}`;

            // Tool call event
            events.push(
                `data: {"type":"tool-call","toolCallId":"${toolCallId}","toolName":"${tool.name}","args":${JSON.stringify(tool.input)}}\n\n`
            );

            // Tool result event
            events.push(
                `data: {"type":"tool-result","toolCallId":"${toolCallId}","result":${JSON.stringify(tool.output)}}\n\n`
            );
        }
    }

    // Message end
    events.push(`data: {"type":"message-end","id":"${messageId}"}\n\n`);

    // Done signal
    events.push("data: [DONE]\n\n");

    return events.join("");
}

/**
 * Build response headers for mock
 */
function buildHeaders(config: MockChatResponse): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Concierge-Model-Id": config.modelId || "anthropic/claude-haiku-4.5",
        "X-Concierge-Temperature": "0.7",
        "X-Concierge-Explanation": encodeURIComponent("Mock response for E2E testing"),
    };

    if (config.connectionId) {
        headers["X-Connection-Id"] = config.connectionId;
    }

    if (config.connectionSlug) {
        headers["X-Connection-Slug"] = config.connectionSlug;
        headers["X-Connection-Is-New"] = "true";
    }

    if (config.title) {
        headers["X-Connection-Title"] = encodeURIComponent(config.title);
    }

    return headers;
}

/**
 * Set up mock for the chat API endpoint
 *
 * @param page - Playwright page instance
 * @param config - Mock response configuration
 * @returns Cleanup function to remove the mock
 */
export async function mockChatApi(
    page: Page,
    config: MockChatResponse
): Promise<() => Promise<void>> {
    const handler = async (route: Route) => {
        // Handle error responses
        if (config.error) {
            await route.fulfill({
                status: config.error.status,
                contentType: "application/json",
                body: JSON.stringify({ error: config.error.message }),
            });
            return;
        }

        // Build and return SSE response
        const body = buildSSEBody(config);
        const headers = buildHeaders(config);

        await route.fulfill({
            status: 200,
            headers,
            body,
        });
    };

    // Route pattern matches the connection API
    await page.route("**/api/connection", handler);

    // Return cleanup function
    return async () => {
        await page.unroute("**/api/connection", handler);
    };
}

/**
 * Mock that fails on first request, succeeds on retry
 *
 * Useful for testing retry functionality (e.g., the retry button from PR 844)
 */
export async function mockChatApiWithRetry(
    page: Page,
    errorConfig: MockChatResponse,
    successConfig: MockChatResponse
): Promise<() => Promise<void>> {
    let callCount = 0;

    const handler = async (route: Route) => {
        callCount++;

        const config = callCount === 1 ? errorConfig : successConfig;

        if (config.error) {
            await route.fulfill({
                status: config.error.status,
                contentType: "application/json",
                body: JSON.stringify({ error: config.error.message }),
            });
            return;
        }

        const body = buildSSEBody(config);
        const headers = buildHeaders(config);

        await route.fulfill({
            status: 200,
            headers,
            body,
        });
    };

    await page.route("**/api/connection", handler);

    return async () => {
        await page.unroute("**/api/connection", handler);
    };
}
