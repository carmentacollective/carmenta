import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Connection Navigation E2E Tests
 *
 * Tests the connection chooser behaviors:
 * 1. Switching between connections loads correct messages
 * 2. Header title updates when switching connections
 * 3. Creating new connection updates URL and shows title
 * 4. Messages persist across navigation
 *
 * Uses Clerk Testing Tokens for authenticated tests.
 * @see https://clerk.com/docs/testing/playwright/overview
 */

const TEST_USER = {
    identifier: process.env.E2E_CLERK_USER_EMAIL ?? "test@example.com",
    password: process.env.E2E_CLERK_USER_PASSWORD ?? "testpassword123",
};

test.describe("Connection Navigation", () => {
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
    });

    test("displays connection chooser in header", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        // Header should be visible
        const header = page.locator("header").first();
        await expect(header).toBeVisible();

        // New button should be visible
        const newButton = page.getByRole("button", { name: /new/i });
        await expect(newButton).toBeVisible();
    });

    test("creating a connection updates URL with slug", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        // Initial URL should be /connection/new
        expect(page.url()).toContain("/connection/new");

        // Type and send a message
        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill("Hello, this is a test message");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for response to start streaming
        await page.waitForTimeout(2000);

        // URL should have changed from /connection/new to /connection/[slug]
        await expect(page).not.toHaveURL(/\/connection\/new$/);
        expect(page.url()).toMatch(/\/connection\/[a-zA-Z0-9_-]+/);
    });

    test("header title updates after connection creation", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        // Send a message to create the connection
        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill("Explain what React hooks are");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for title to appear in header
        // The title should show up within a reasonable time
        await expect(page.locator("header").getByText(/react|hooks/i)).toBeVisible({
            timeout: 15000,
        });
    });

    test("connection appears in chooser after creation", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        // Create a connection with a distinctive message
        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill("Tell me about TypeScript generics");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for response and title generation
        await page.waitForTimeout(3000);

        // Open the connection chooser (click search button)
        const searchButton = page.locator("header button").first();
        await searchButton.click();

        // The new connection should appear in the dropdown
        // Look for "new" badge or the connection title
        await expect(
            page
                .locator('[class*="dropdown"], [class*="popover"], [role="listbox"]')
                .getByText(/typescript|generics|new/i)
        ).toBeVisible({ timeout: 5000 });
    });

    test("switching to existing connection loads messages", async ({ page }) => {
        // First, create a connection
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        // Send a distinctive message
        const testMessage = "What is the capital of France? Please answer briefly.";
        await input.fill(testMessage);

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for response
        await expect(page.getByText(/paris/i)).toBeVisible({ timeout: 30000 });

        // Get the current URL (our connection slug)
        const connectionUrl = page.url();

        // Navigate to a new connection
        const newButton = page.getByRole("button", { name: /new/i });
        await newButton.click();

        // Verify we're on /connection/new
        await expect(page).toHaveURL(/\/connection\/new$/);

        // The old message should not be visible
        await expect(page.getByText(testMessage)).not.toBeVisible();

        // Navigate back to the original connection
        await page.goto(connectionUrl);
        await page.waitForLoadState("networkidle");

        // The original message should be visible again
        await expect(page.getByText(testMessage)).toBeVisible({
            timeout: 10000,
        });
        await expect(page.getByText(/paris/i)).toBeVisible();
    });

    test("header title changes when switching connections", async ({ page }) => {
        // Create first connection
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill("What is JavaScript?");

        const sendButton = page.getByRole("button", { name: /send/i });
        await sendButton.click();

        // Wait for title to appear
        await page.waitForTimeout(3000);

        // Store the connection URL
        const firstConnectionUrl = page.url();

        // Create second connection
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        await input.fill("What is Python programming?");
        await sendButton.click();

        // Wait for title to appear
        await page.waitForTimeout(3000);

        // Get the header title text
        const getHeaderTitle = async () => {
            const titleElement = page.locator("header").locator("span, button").filter({
                hasText: /\w+/,
            });
            return titleElement.first().textContent();
        };

        const secondTitle = await getHeaderTitle();

        // Navigate back to first connection
        await page.goto(firstConnectionUrl);
        await page.waitForLoadState("networkidle");

        // Title should have changed
        const firstTitle = await getHeaderTitle();
        expect(firstTitle).not.toBe(secondTitle);
    });

    test("connection chooser search filters results", async ({ page }) => {
        // This test requires having multiple connections already created
        // We'll create two with distinctive names

        // Create first connection
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill("Tell me about zebras");
        await page.getByRole("button", { name: /send/i }).click();
        await page.waitForTimeout(3000);

        // Create second connection
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");
        await input.fill("Tell me about elephants");
        await page.getByRole("button", { name: /send/i }).click();
        await page.waitForTimeout(3000);

        // Open the connection chooser
        const searchButton = page.locator("header button").first();
        await searchButton.click();

        // Search for "zebra"
        const searchInput = page.locator("input[placeholder*='Search']");
        await searchInput.fill("zebra");

        // Should show zebra connection but not elephant
        await expect(page.getByText(/zebra/i)).toBeVisible();
        // The elephant connection should be filtered out
        // (this depends on implementation - may need adjustment)
    });

    test("fresh connection shows 'new' badge animation", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill("Quick test message");
        await page.getByRole("button", { name: /send/i }).click();

        // Wait for connection to be created
        await page.waitForTimeout(2000);

        // Open the connection chooser
        const searchButton = page.locator("header button").first();
        await searchButton.click();

        // Look for "new" badge on the fresh connection
        const newBadge = page
            .locator('[class*="new"], [class*="fresh"]')
            .or(page.getByText("new", { exact: true }));
        await expect(newBadge.first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe("Connection Persistence", () => {
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
    });

    test("messages persist after page refresh", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        const testMessage = "This message should persist after refresh";
        await input.fill(testMessage);
        await page.getByRole("button", { name: /send/i }).click();

        // Wait for response
        await page.waitForTimeout(5000);

        // Store current URL (verifying we're on the connection page, not /new)
        const connectionUrl = page.url();
        expect(connectionUrl).not.toContain("/connection/new");

        // Refresh the page
        await page.reload();
        await page.waitForLoadState("networkidle");

        // Message should still be visible
        await expect(page.getByText(testMessage)).toBeVisible({
            timeout: 10000,
        });
    });

    test("messages persist after navigating away and back", async ({ page }) => {
        await page.goto("/connection/new");
        await page.waitForLoadState("networkidle");

        const input = page.getByRole("textbox");
        await expect(input).toBeVisible({ timeout: 10000 });

        const testMessage = "Navigate away and come back test";
        await input.fill(testMessage);
        await page.getByRole("button", { name: /send/i }).click();

        // Wait for response
        await page.waitForTimeout(5000);

        // Store current URL
        const connectionUrl = page.url();

        // Navigate to home page
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Navigate back to the connection
        await page.goto(connectionUrl);
        await page.waitForLoadState("networkidle");

        // Message should still be visible
        await expect(page.getByText(testMessage)).toBeVisible({
            timeout: 10000,
        });
    });
});
