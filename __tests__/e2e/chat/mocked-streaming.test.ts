import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect } from "@playwright/test";

import {
    mockChatApi,
    mockChatApiError,
    createMockResponse,
    MOCK_RESPONSES,
} from "../fixtures/mock-chat-api";

/**
 * Deterministic Chat E2E Tests with Mocked Streaming
 *
 * Tests the chat UI end-to-end using Playwright network interception to mock
 * LLM streaming responses. This enables:
 * - Fast execution (no LLM inference time)
 * - Deterministic results (same response every time)
 * - Cost-free testing (no API calls)
 * - Reliable CI (no rate limits or API availability issues)
 *
 * @see https://github.com/carmentacollective/carmenta/issues/557
 * @see https://playwright.dev/docs/network
 */

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;
const hasCredentials = testUserEmail && testUserPassword && hasClerkKeys;

test.describe("Chat with Mocked Streaming", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test.beforeEach(async ({ page }) => {
        // Initialize Clerk testing token
        await setupClerkTestingToken({ page });

        // Navigate to a public page first (required before clerk.signIn)
        await page.goto("/");

        // Sign in with test user
        await clerk.signIn({
            page,
            signInParams: {
                strategy: "password",
                identifier: testUserEmail!,
                password: testUserPassword!,
            },
        });
    });

    test.afterEach(async ({ page }) => {
        // Clear any route mocks to ensure test isolation
        await page.unroute("**/api/connection");
    });

    test("sends message and receives mocked response", async ({ page }) => {
        // Set up mock to intercept chat API
        const mockResponse = createMockResponse()
            .withText("Hello from mock! This is a deterministic test response.")
            .withTitle("Test Chat Session");

        await mockChatApi(page, mockResponse);

        // Navigate to new connection page
        await page.goto("/connection/new/new");

        // Wait for composer to be ready
        const composer = page.getByTestId("composer-input");
        await expect(composer).toBeVisible();

        // Type and send a message
        await composer.fill("Hello, can you help me?");

        // Click send button
        const sendButton = page.getByTestId("send-button");
        await sendButton.click();

        // Wait for the mocked response to appear
        await expect(
            page.locator("text=Hello from mock! This is a deterministic test response.")
        ).toBeVisible({ timeout: 10000 });
    });

    test("displays title and updates URL after response", async ({ page }) => {
        // Set up mock with title generation
        const title = "Weather Discussion";
        const expectedSlug = "weather-discussion";

        const mockResponse = createMockResponse()
            .withText("The weather today is sunny with a chance of testing.")
            .withTitle(title)
            .withTitleUpdate(title, expectedSlug);

        await mockChatApi(page, mockResponse);

        // Start at new connection URL
        await page.goto("/connection/new/new");

        // Send a message
        const composer = page.getByTestId("composer-input");
        await composer.fill("What's the weather like?");
        await page.getByTestId("send-button").click();

        // Wait for response to appear
        await expect(page.locator("text=The weather today is sunny")).toBeVisible({
            timeout: 10000,
        });

        // Verify URL was updated with the new slug
        // Note: The actual connection ID is set by the mock (abc123xyz by default)
        await expect(page).toHaveURL(new RegExp(`/connection/${expectedSlug}/`));
    });

    test("shows greeting response from pre-built mock", async ({ page }) => {
        // Use pre-built mock response
        await mockChatApi(page, MOCK_RESPONSES.greeting());

        await page.goto("/connection/new/new");

        const composer = page.getByTestId("composer-input");
        await composer.fill("Hi there!");
        await page.getByTestId("send-button").click();

        await expect(
            page.locator("text=Hello! How can we help you today?")
        ).toBeVisible({ timeout: 10000 });
    });

    test("displays user message immediately in chat thread", async ({ page }) => {
        // Set up a mock that takes a moment to "respond"
        const mockResponse = createMockResponse()
            .withStreamDelay(100)
            .withText("Response after delay");

        await mockChatApi(page, mockResponse);

        await page.goto("/connection/new/new");

        const userMessage = "This is my test message";
        const composer = page.getByTestId("composer-input");
        await composer.fill(userMessage);
        await page.getByTestId("send-button").click();

        // User message should appear immediately (before response)
        await expect(page.locator(`text=${userMessage}`)).toBeVisible();
    });

    test("clears composer input after sending", async ({ page }) => {
        await mockChatApi(page, MOCK_RESPONSES.greeting());

        await page.goto("/connection/new/new");

        const composer = page.getByTestId("composer-input");
        await composer.fill("Test message");

        // Verify input has content
        await expect(composer).toHaveValue("Test message");

        // Send the message
        await page.getByTestId("send-button").click();

        // Composer should be cleared
        await expect(composer).toHaveValue("");
    });

    test("submits message with Enter key", async ({ page }) => {
        await mockChatApi(page, MOCK_RESPONSES.greeting());

        await page.goto("/connection/new/new");

        const composer = page.getByTestId("composer-input");
        await composer.fill("Submitted via Enter");

        // Press Enter to submit (not Shift+Enter which adds newline)
        await composer.press("Enter");

        // User message should appear
        await expect(page.locator("text=Submitted via Enter")).toBeVisible();

        // Response should appear
        await expect(
            page.locator("text=Hello! How can we help you today?")
        ).toBeVisible({ timeout: 10000 });
    });

    test("handles multiple messages in conversation", async ({ page }) => {
        let requestCount = 0;

        // Set up mock that returns different responses for each request
        await page.route("**/api/connection", async (route) => {
            requestCount++;
            const response =
                requestCount === 1
                    ? createMockResponse()
                          .withText("First response")
                          .withTitle("Multi-turn Chat")
                    : createMockResponse()
                          .withText("Second response")
                          .asNewConnection(false);

            await route.fulfill({
                status: 200,
                headers: response.buildHeaders() as unknown as Record<string, string>,
                body: response.buildBody(),
            });
        });

        await page.goto("/connection/new/new");

        // Send first message
        const composer = page.getByTestId("composer-input");
        await composer.fill("First question");
        await page.getByTestId("send-button").click();

        // Wait for first response
        await expect(page.locator("text=First response")).toBeVisible({
            timeout: 10000,
        });

        // Send second message
        await composer.fill("Second question");
        await page.getByTestId("send-button").click();

        // Wait for second response
        await expect(page.locator("text=Second response")).toBeVisible({
            timeout: 10000,
        });

        // Both messages should be visible in thread
        await expect(page.locator("text=First question")).toBeVisible();
        await expect(page.locator("text=Second question")).toBeVisible();
    });
});

test.describe("Chat Error Handling", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test.beforeEach(async ({ page }) => {
        await setupClerkTestingToken({ page });
        await page.goto("/");
        await clerk.signIn({
            page,
            signInParams: {
                strategy: "password",
                identifier: testUserEmail!,
                password: testUserPassword!,
            },
        });
    });

    test.afterEach(async ({ page }) => {
        // Clear any route mocks to ensure test isolation
        await page.unroute("**/api/connection");
    });

    test("handles API error gracefully", async ({ page }) => {
        // Use the fixture helper for error mocking
        await mockChatApiError(page, 500, "Internal server error");

        await page.goto("/connection/new/new");

        const composer = page.getByTestId("composer-input");
        await composer.fill("This should fail");
        await page.getByTestId("send-button").click();

        // User message should still appear
        await expect(page.locator("text=This should fail")).toBeVisible();

        // Should show some error indication (toast or inline)
        // The exact error UI depends on implementation
        // We just verify the page doesn't crash
        await expect(page.getByTestId("composer-input")).toBeVisible();
    });
});
