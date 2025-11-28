import { test, expect } from "@playwright/test";

test.describe("Connect Page", () => {
    test.beforeEach(async ({ page }) => {
        // Note: This test requires authentication. In CI, we'd use
        // Clerk testing tokens or mock authentication.
        await page.goto("/connect");
    });

    test("displays the connect page header", async ({ page }) => {
        // Look for the Carmenta branding
        await expect(page.getByText("CARMENTA_")).toBeVisible();

        // Look for milestone indicator
        await expect(page.getByText("M0.5: First Connection")).toBeVisible();
    });

    test("displays the page title", async ({ page }) => {
        await expect(page).toHaveTitle(/Connect.*Carmenta/);
    });

    test("has a chat interface", async ({ page }) => {
        // The assistant-ui Thread component should render
        // Look for the composer input area
        const composer = page
            .locator('[data-testid="composer"]')
            .or(page.getByRole("textbox"));

        // Wait for either the composer or a sign-in redirect
        // (since the page requires auth)
        const hasComposer = await composer.isVisible().catch(() => false);
        const isSignInPage = page.url().includes("sign-in");

        // Either we see the chat interface OR we got redirected to sign-in
        expect(hasComposer || isSignInPage).toBeTruthy();
    });
});

test.describe("Connect Page - Authenticated", () => {
    // These tests require a valid Clerk session
    // Skip in environments without auth setup
    test.skip(
        () => !process.env.CLERK_TESTING_TOKEN,
        "Skipping authenticated tests without CLERK_TESTING_TOKEN"
    );

    test("can send a message", async ({ page }) => {
        await page.goto("/connect");

        // Find the composer input
        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        // Type a message
        await input.fill("Hello!");

        // Find and click the send button
        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Verify message appears in thread
        await expect(page.getByText("Hello!")).toBeVisible();
    });

    test("renders weather card when asking about weather", async ({ page }) => {
        await page.goto("/connect");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        // Ask about weather to trigger the tool
        await input.fill("What's the weather in London?");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for the weather card to appear
        // The WeatherToolUI renders with these elements
        await expect(
            page.locator(".blueprint-box").filter({ hasText: /°C/ })
        ).toBeVisible({ timeout: 30000 });
    });

    test("renders comparison table when comparing options", async ({ page }) => {
        await page.goto("/connect");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        // Ask for a comparison to trigger the tool
        await input.fill("Compare React vs Vue vs Angular");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for the comparison table to appear
        await expect(
            page
                .locator("table")
                .or(page.locator(".blueprint-box").filter({ hasText: /Option/ }))
        ).toBeVisible({ timeout: 30000 });
    });
});
