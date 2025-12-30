import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect } from "@playwright/test";

/**
 * Manual browser verification test
 *
 * This test opens a browser and pauses, allowing visual inspection
 * of the code mode UI.
 */

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasCredentials = testUserEmail && testUserPassword;

test.describe("Code Mode Browser Verification", () => {
    test.skip(!hasCredentials, "Skipping: TEST_USER_* credentials not set");

    test("visual verification of code mode streaming", async ({ page }) => {
        // Set longer timeout for manual inspection
        test.setTimeout(300000); // 5 minutes

        // Capture console logs from the browser
        const consoleLogs: string[] = [];
        page.on("console", (msg) => {
            if (msg.text().includes("CodeModeMessage")) {
                consoleLogs.push(msg.text());
            }
        });

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

        // Navigate to code mode for this project
        await page.goto("/code/carmenta-code/new");

        // Wait for the page to load
        await expect(page.getByRole("textbox")).toBeVisible({ timeout: 15000 });

        console.log("=== PAGE LOADED ===");
        console.log("URL:", page.url());

        // Take screenshot of initial state
        await page.screenshot({
            path: "__tests__/screenshots/browser-check-initial.png",
            fullPage: true,
        });

        // Send a simple test message
        const input = page.getByRole("textbox").first();
        await input.fill("What files are in the lib directory?");
        await input.press("Enter");

        console.log("=== MESSAGE SENT ===");

        // Wait 2 seconds and take screenshot
        await page.waitForTimeout(2000);
        await page.screenshot({
            path: "__tests__/screenshots/browser-check-2sec.png",
            fullPage: true,
        });

        // Wait another 3 seconds and take screenshot
        await page.waitForTimeout(3000);
        await page.screenshot({
            path: "__tests__/screenshots/browser-check-5sec.png",
            fullPage: true,
        });

        // Wait another 5 seconds and take screenshot
        await page.waitForTimeout(5000);
        await page.screenshot({
            path: "__tests__/screenshots/browser-check-10sec.png",
            fullPage: true,
        });

        // Wait up to 30 seconds for any assistant message
        try {
            await page
                .locator('[data-role="assistant"]')
                .first()
                .waitFor({ timeout: 30000 });
            console.log("=== ASSISTANT RESPONSE FOUND ===");
        } catch {
            console.log("=== NO ASSISTANT RESPONSE AFTER 30s ===");
        }

        // Final screenshot
        await page.screenshot({
            path: "__tests__/screenshots/browser-check-final.png",
            fullPage: true,
        });

        // Log page state
        const html = await page.content();
        if (html.includes('data-role="assistant"')) {
            console.log("Assistant message found in HTML");
        } else {
            console.log("No assistant message in HTML");
        }

        // Check for any error messages
        const errors = await page.locator("text=error").count();
        console.log(`Error text count: ${errors}`);

        // Check for transient messages
        const transient = await page.locator('[class*="animate-"]').count();
        console.log(`Animated elements count: ${transient}`);

        // Log success
        console.log("=== TEST COMPLETE ===");

        // Print captured CodeModeMessage logs
        console.log("=== CONSOLE LOGS ===");
        consoleLogs.forEach((log) => console.log(log));
    });
});
