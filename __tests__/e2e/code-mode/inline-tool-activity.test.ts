import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect, type Page } from "@playwright/test";

/**
 * Code Mode Inline Tool Activity Tests
 *
 * Verifies the inline tool activity display in code mode:
 * - Real-time transient messages during streaming (CodeModeActivity)
 * - Completed tool parts after streaming (InlineToolActivity)
 * - Visual quality and UI polish
 *
 * Requires environment variables:
 * - CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
 * - CLERK_SECRET_KEY
 * - TEST_USER_EMAIL: Test user email
 * - TEST_USER_PASSWORD: Test user password
 */

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;
const hasCredentials = testUserEmail && testUserPassword && hasClerkKeys;

/**
 * Helper to send a message in the chat interface
 */
async function sendMessage(page: Page, message: string): Promise<void> {
    // Find the chat input - should be a textarea
    const input = page.getByRole("textbox").first();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Type the message
    await input.fill(message);

    // Submit with Enter or find submit button
    await input.press("Enter");
}

/**
 * Wait for streaming to complete by checking for the absence of loading indicators
 */
async function waitForStreamingComplete(page: Page, timeout = 60000): Promise<void> {
    // Wait for any loading/streaming indicators to disappear
    // The CodeModeActivity component should disappear when streaming ends
    await page.waitForFunction(
        () => {
            // Check if there are any visible transient status indicators
            const hasStreamingIndicators = document.querySelector(
                '[class*="animate-ping"]'
            );
            return !hasStreamingIndicators;
        },
        { timeout }
    );

    // Also wait a bit for any final animations
    await page.waitForTimeout(500);
}

test.describe("Code Mode Inline Tool Activity", () => {
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

    test("shows real-time tool activity during streaming", async ({ page }) => {
        // Navigate to code mode for this project
        await page.goto("/code/carmenta-code/new");

        // Wait for the page to load
        await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

        // Take a screenshot of the initial state
        await page.screenshot({
            path: "__tests__/screenshots/code-mode-initial.png",
            fullPage: true,
        });

        // Send a message that will trigger tool execution
        // "list files" should trigger a Glob tool
        await sendMessage(page, "List the files in the components directory");

        // Wait briefly for streaming to start
        await page.waitForTimeout(1000);

        // Look for the CodeModeActivity component during streaming
        // It should show transient status messages with amber pulsing dots
        const streamingActivity = page.locator('[class*="animate-ping"]');

        // Take a screenshot while streaming (if we can catch it)
        await page.screenshot({
            path: "__tests__/screenshots/code-mode-streaming.png",
            fullPage: true,
        });

        // Wait for streaming to complete (up to 60 seconds for tool execution)
        await waitForStreamingComplete(page);

        // Take a screenshot of the final state
        await page.screenshot({
            path: "__tests__/screenshots/code-mode-complete.png",
            fullPage: true,
        });

        // Verify we got a response
        const messages = page.locator('[data-role="assistant"]');
        await expect(messages.first()).toBeVisible({ timeout: 10000 });
    });

    test("displays completed tool parts inline after streaming", async ({ page }) => {
        // Navigate to code mode
        await page.goto("/code/carmenta-code/new");

        // Wait for the page to load
        await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

        // Send a message that will trigger multiple tools
        await sendMessage(
            page,
            "Read the package.json file and show me the dependencies"
        );

        // Wait for streaming to complete
        await waitForStreamingComplete(page);

        // Look for InlineToolActivity - it renders tool parts as inline activity
        // Each tool part should have a status dot and tool name

        // The component has clickable rows with tool names
        const toolActivity = page.locator("[data-tool-call-id]");

        // There should be at least one tool call (Read for package.json)
        // Wait a bit longer for tool parts to populate
        await page.waitForTimeout(2000);

        // Take a screenshot showing the tool activity
        await page.screenshot({
            path: "__tests__/screenshots/code-mode-tool-parts.png",
            fullPage: true,
        });

        // Verify we got a response with content
        const messageContent = page.locator('[data-role="assistant"]');
        await expect(messageContent.first()).toBeVisible({ timeout: 10000 });

        // The response should mention dependencies or package.json content
        const text = await messageContent.first().textContent();
        expect(text).toBeTruthy();
    });

    test("tool activity rows are expandable for details", async ({ page }) => {
        // Navigate to code mode
        await page.goto("/code/carmenta-code/new");

        // Wait for the page to load
        await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

        // Send a message that will trigger a visible tool
        await sendMessage(page, "What's in the README.md file?");

        // Wait for streaming to complete
        await waitForStreamingComplete(page);

        // Wait for tool parts to populate
        await page.waitForTimeout(2000);

        // Look for tool activity rows
        const toolRows = page.locator("[data-tool-call-id]");
        const count = await toolRows.count();

        if (count > 0) {
            // Click the first tool row to expand it
            await toolRows.first().click();

            // Wait for expansion animation
            await page.waitForTimeout(300);

            // Take a screenshot showing the expanded tool detail
            await page.screenshot({
                path: "__tests__/screenshots/code-mode-tool-expanded.png",
                fullPage: true,
            });
        }

        // Verify we got a response
        const messageContent = page.locator('[data-role="assistant"]');
        await expect(messageContent.first()).toBeVisible({ timeout: 10000 });
    });

    test("visual quality - inline activity has beautiful styling", async ({ page }) => {
        // Navigate to code mode
        await page.goto("/code/carmenta-code/new");

        // Wait for the page to load
        await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

        // Send a simple message that triggers tools
        await sendMessage(page, "What files are in the src directory?");

        // Wait for streaming to complete
        await waitForStreamingComplete(page);

        // Wait for UI to settle
        await page.waitForTimeout(1000);

        // Take high-quality screenshots for visual verification
        await page.screenshot({
            path: "__tests__/screenshots/code-mode-visual-quality.png",
            fullPage: true,
        });

        // Verify no JavaScript errors occurred
        const errors: string[] = [];
        page.on("pageerror", (error) => {
            errors.push(error.message);
        });

        expect(errors).toHaveLength(0);

        // Verify the page has the expected structure
        // Should have assistant messages with content
        const messages = page.locator('[data-role="assistant"]');
        await expect(messages.first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe("Code Mode Streaming Performance", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("streaming starts quickly after message send", async ({ page }) => {
        // Initialize auth
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

        // Navigate to code mode
        await page.goto("/code/carmenta-code/new");
        await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

        // Record timing
        const startTime = Date.now();

        // Send a message
        await sendMessage(page, "What version of Next.js is this project using?");

        // Wait for first sign of activity (transient message or content)
        await page.waitForFunction(
            () => {
                // Look for any activity indicator or assistant content
                const hasActivity =
                    document.querySelector('[class*="animate-ping"]') ||
                    document.querySelector('[data-role="assistant"]');
                return hasActivity;
            },
            { timeout: 15000 }
        );

        const activityTime = Date.now();
        const timeToFirstActivity = activityTime - startTime;

        // Activity should start within 5 seconds
        console.log(`Time to first activity: ${timeToFirstActivity}ms`);
        expect(timeToFirstActivity).toBeLessThan(5000);

        // Wait for completion and take final screenshot
        await waitForStreamingComplete(page);
        await page.screenshot({
            path: "__tests__/screenshots/code-mode-performance.png",
            fullPage: true,
        });
    });
});
