import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Connect Page E2E Tests
 *
 * Tests the /connect route which redirects to /connection.
 * Includes both unauthenticated (redirect) and authenticated (chat) flows.
 *
 * Uses Clerk Testing Tokens for authenticated tests.
 * @see https://clerk.com/docs/testing/playwright/overview
 */

const TEST_USER = {
    identifier: process.env.E2E_CLERK_USER_EMAIL ?? "test@example.com",
    password: process.env.E2E_CLERK_USER_PASSWORD ?? "testpassword123",
};

test.describe("Connect Page - Unauthenticated", () => {
    test("redirects to sign-in when not authenticated", async ({ page }) => {
        await page.goto("/connect");

        // Clerk protects /connect, so unauthenticated users get redirected
        await page.waitForURL(/sign-in/, { timeout: 10000 });
        expect(page.url()).toContain("sign-in");
    });
});

test.describe("Connect Page - Authenticated", () => {
    // Setup Clerk testing token for authenticated tests
    test.beforeEach(async ({ page }) => {
        await setupClerkTestingToken({ page });
        await clerk.signIn({
            page,
            signInParams: {
                strategy: "password",
                identifier: TEST_USER.identifier,
                password: TEST_USER.password,
            },
        });
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");
    });

    test("displays the connect page header", async ({ page }) => {
        // Look for the Carmenta branding
        await expect(page.getByText("CARMENTA")).toBeVisible();

        // Look for milestone indicator
        await expect(page.getByText("M1: Soul Proven")).toBeVisible();
    });

    test("displays the page title", async ({ page }) => {
        await expect(page).toHaveTitle(/Connection.*Carmenta/);
    });

    test("has a chat interface", async ({ page }) => {
        // The assistant-ui Thread component should render
        // Look for the composer input area
        const composer = page
            .locator('[data-testid="composer"]')
            .or(page.getByRole("textbox"));

        await expect(composer).toBeVisible({ timeout: 10000 });
    });

    test("can send a message", async ({ page }) => {
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
        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        // Ask about weather to trigger the tool
        await input.fill("What's the weather in London?");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for the weather card to appear
        // The WeatherToolUI renders with these elements
        await expect(page.locator(".glass-card").filter({ hasText: /°C/ })).toBeVisible(
            { timeout: 30000 }
        );
    });

    test("renders comparison table when comparing options", async ({ page }) => {
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
                .or(page.locator(".glass-card").filter({ hasText: /Option/ }))
        ).toBeVisible({ timeout: 30000 });
    });
});
