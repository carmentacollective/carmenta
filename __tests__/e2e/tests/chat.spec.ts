import { test, expect } from "@playwright/test";
import {
    mockChatApi,
    mockChatApiWithRetry,
    createMockResponse,
    MOCK_RESPONSES,
} from "../fixtures/mock-chat-api";

/**
 * Chat E2E Tests
 *
 * Tests core chat functionality using mocked API responses for deterministic testing.
 * These tests require authentication (uses cached auth state from seed.spec.ts).
 *
 * @tags @chat @authenticated
 */

test.describe("Chat - Core Functionality", () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to new connection page using the ?new query param
        // This ensures a fresh conversation state
        await page.goto("/connection?new");
        // Wait for composer to be ready
        await expect(page.getByTestId("composer-input")).toBeVisible({
            timeout: 10000,
        });
    });

    test("can send a message and receive a response", async ({ page }) => {
        // Set up mock API to intercept chat requests
        const cleanup = await mockChatApi(page, MOCK_RESPONSES.greeting());

        try {
            // Type and send message
            const composer = page.getByTestId("composer-input");
            await composer.fill("Hello, Carmenta!");
            await page.getByTestId("send-button").click();

            // Verify user message appears (uses .user-message-bubble class)
            await expect(page.locator(".user-message-bubble").first()).toContainText(
                "Hello, Carmenta!",
                { timeout: 10000 }
            );

            // Verify assistant response appears
            // The assistant response may take time to process through the mock
            await expect(
                page
                    .locator('[class*="assistant-message"], [class*="markdown"]')
                    .first()
            ).toBeVisible({ timeout: 10000 });

            // Verify stop button is no longer visible (streaming complete)
            await expect(page.getByTestId("stop-button")).not.toBeVisible();
        } finally {
            await cleanup();
        }
    });

    test("can send message with Enter key", async ({ page }) => {
        const cleanup = await mockChatApi(page, MOCK_RESPONSES.greeting());

        try {
            const composer = page.getByTestId("composer-input");
            await composer.fill("Testing Enter key");
            await composer.press("Enter");

            // Verify message was sent (user message bubble appears)
            await expect(page.locator(".user-message-bubble").first()).toContainText(
                "Testing Enter key",
                { timeout: 10000 }
            );
        } finally {
            await cleanup();
        }
    });

    // Note: This test requires the mock API to trigger actual streaming behavior.
    // Currently skipped because the Vercel AI SDK streaming format isn't fully mocked.
    test.skip("stop button appears during streaming and works", async ({ page }) => {
        // TODO: Fix mock API to properly trigger streaming state
        // The stop button only appears when isLoading=true during active streaming
        const cleanup = await mockChatApi(
            page,
            createMockResponse()
                .withText(
                    "This is a longer response that should take a moment to stream. " +
                        Array(20).fill("More content here. ").join("")
                )
                .withChunkDelay(50) // 50ms between chunks
                .build()
        );

        const composer = page.getByTestId("composer-input");
        await composer.fill("Tell me something long");
        await page.getByTestId("send-button").click();

        // Stop button should appear during streaming
        const stopButton = page.getByTestId("stop-button");
        await expect(stopButton).toBeVisible({ timeout: 5000 });

        // Click stop
        await stopButton.click();

        // Stop button should disappear
        await expect(stopButton).not.toBeVisible({ timeout: 5000 });

        await cleanup();
    });
});

test.describe("Chat - Error Handling and Retry", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/connection?new");
        await expect(page.getByTestId("composer-input")).toBeVisible({
            timeout: 10000,
        });
    });

    // Note: These tests require the mock API to properly trigger the real error handling flow.
    // The RuntimeErrorBanner shows a Retry button when hasFailedMessage is true.
    // Currently skipped because the mock API doesn't fully simulate the Vercel AI SDK response format.

    test.skip("displays error state and retry button on failure", async ({ page }) => {
        // TODO: Fix mock API to properly trigger error banner with retry button
        // The mock returns 500 JSON but the UI expects streaming SSE errors
        const cleanup = await mockChatApi(
            page,
            MOCK_RESPONSES.error("Connection failed")
        );

        const composer = page.getByTestId("composer-input");
        await composer.fill("This will fail");
        await page.getByTestId("send-button").click();

        // The error banner appears and has a Retry button (aria-label="Retry your message")
        const retryButton = page.getByRole("button", { name: /retry/i });
        await expect(retryButton).toBeVisible({ timeout: 10000 });

        await cleanup();
    });

    test.skip("retry button actually resends the message (PR #844 regression)", async ({
        page,
    }) => {
        // TODO: Fix mock API to properly trigger error+retry flow
        // This test validates the fix for PR #844 where retry was broken
        const cleanup = await mockChatApiWithRetry(
            page,
            MOCK_RESPONSES.error("Temporary failure"),
            MOCK_RESPONSES.retrySuccess()
        );

        const composer = page.getByTestId("composer-input");
        await composer.fill("Retry test message");
        await page.getByTestId("send-button").click();

        const retryButton = page.getByRole("button", { name: /retry/i });
        await retryButton.click();

        // Success state should appear after retry
        await expect(
            page.locator('[class*="assistant-message"], [class*="markdown"]').first()
        ).toBeVisible({ timeout: 10000 });

        await cleanup();
    });
});

test.describe("Chat - Message Queue", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/connection?new");
        await expect(page.getByTestId("composer-input")).toBeVisible({
            timeout: 10000,
        });
    });

    // Note: This test requires the mock API to trigger actual streaming behavior.
    // The queue button only appears during active streaming (when stop button is visible).
    test.skip("can queue messages while streaming", async ({ page }) => {
        // TODO: Fix mock API to properly trigger streaming state
        const cleanup = await mockChatApi(
            page,
            createMockResponse()
                .withText("First response that takes a while...")
                .withChunkDelay(100)
                .build()
        );

        // Send first message
        const composer = page.getByTestId("composer-input");
        await composer.fill("First message");
        await page.getByTestId("send-button").click();

        // Wait for streaming to start (stop button appears)
        await expect(page.getByTestId("stop-button")).toBeVisible({ timeout: 5000 });

        // While streaming, type another message
        await composer.fill("Second message to queue");

        // Queue button should be visible during streaming
        const queueButton = page.getByTestId("queue-button");
        await expect(queueButton).toBeVisible({ timeout: 5000 });

        await queueButton.click();
        await cleanup();
    });
});

test.describe("Chat - No JS Errors", () => {
    test("chat page loads without JavaScript errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => {
            errors.push(error.message);
        });

        await page.goto("/connection?new");
        await expect(page.getByTestId("composer-input")).toBeVisible({
            timeout: 10000,
        });

        expect(errors).toHaveLength(0);
    });
});
