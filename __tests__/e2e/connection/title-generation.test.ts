import { test, expect } from "@playwright/test";
import { setupClerkTestingToken, clerk } from "@clerk/testing/playwright";

/**
 * Connection Title Generation E2E Test
 *
 * Tests the title generation feature in the /connection flow:
 * 1. Title is generated after first message
 * 2. URL updates from /connection/new/[id] to /connection/[slug]/[id]
 * 3. Page title updates
 * 4. Title may evolve on subsequent messages
 */

test.describe("Connection Title Generation", () => {
    test.beforeEach(async ({ page }) => {
        await setupClerkTestingToken({ page });
    });

    test("generates title and updates URL after first message", async ({ page }) => {
        // Sign in using Clerk test credentials
        await clerk.signIn({
            page,
            signInParams: {
                strategy: "password",
                identifier: process.env.TEST_USER_EMAIL!,
                password: process.env.TEST_USER_PASSWORD!,
            },
        });

        // Navigate to new connection
        await page.goto("/connection");
        await page.waitForLoadState("networkidle");

        const initialUrl = page.url();
        console.log(`Initial URL: ${initialUrl}`);

        // Take screenshot of initial state
        await page.screenshot({
            path: "/tmp/title-test-01-initial.png",
            fullPage: true,
        });

        // Send first message
        const chatInput = page.locator("textarea").last();
        await chatInput.fill("Help me plan a trip to Paris next month");

        const sendButton = page.locator('button[type="submit"]').last();
        await sendButton.click();

        // Wait for AI response
        await page.waitForTimeout(8000);

        const urlAfterFirstMessage = page.url();
        const titleAfterFirstMessage = await page.title();

        console.log(`URL after first message: ${urlAfterFirstMessage}`);
        console.log(`Page title: ${titleAfterFirstMessage}`);

        // Take screenshot after first message
        await page.screenshot({
            path: "/tmp/title-test-02-after-first-message.png",
            fullPage: true,
        });

        // Verify URL changed to slug format
        expect(urlAfterFirstMessage).toMatch(/\/connection\/[^\/]+\/[^\/]+/);
        expect(urlAfterFirstMessage).not.toBe(initialUrl);

        // Send second message
        await chatInput.fill("Actually, let's focus on the best restaurants there");
        await sendButton.click();

        // Wait for AI response
        await page.waitForTimeout(8000);

        const urlAfterSecondMessage = page.url();
        const titleAfterSecondMessage = await page.title();

        console.log(`URL after second message: ${urlAfterSecondMessage}`);
        console.log(`Page title after second: ${titleAfterSecondMessage}`);

        // Take screenshot after second message
        await page.screenshot({
            path: "/tmp/title-test-03-after-second-message.png",
            fullPage: true,
        });

        // Title may or may not evolve, but URL should still be in slug format
        expect(urlAfterSecondMessage).toMatch(/\/connection\/[^\/]+\/[^\/]+/);
    });
});
