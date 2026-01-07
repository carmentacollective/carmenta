import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect } from "@playwright/test";

/**
 * Recent Changes E2E Tests
 *
 * Tests features from commits in the past 72 hours:
 * - CarmentaSheet on AI Team and Integrations pages (PR #662)
 * - Knowledge Base page access
 * - Header navigation (Oracle Menu)
 * - Integration cards layout
 *
 * Required environment variables:
 * - CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
 * - CLERK_SECRET_KEY
 * - TEST_USER_EMAIL, TEST_USER_PASSWORD
 */

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;
const hasCredentials = testUserEmail && testUserPassword && hasClerkKeys;

/**
 * Helper to sign in before tests
 */
async function signIn(page: import("@playwright/test").Page) {
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

    // Verify authentication succeeded (not redirected to sign-in)
    await expect(page).not.toHaveURL(/sign-in/);
}

test.describe("AI Team Page", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("loads without console errors", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        await signIn(page);
        await page.goto("/ai-team");

        // Page should load successfully
        await expect(page).toHaveURL(/\/ai-team/);

        // Check for critical console errors (filter out known noise)
        const criticalErrors = consoleErrors.filter(
            (err) =>
                !err.includes("ResizeObserver") && // Known React noise
                !err.includes("Script error") && // Cross-origin noise
                !err.includes("WebSocket") // Dev server noise
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test("shows page header with title", async ({ page }) => {
        await signIn(page);
        await page.goto("/ai-team");

        // Should have the page heading
        const heading = page.getByRole("heading", { level: 1 });
        await expect(heading).toBeVisible();
    });
});

test.describe("Integrations Page", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("loads without console errors", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        await signIn(page);
        await page.goto("/integrations");

        // Page should load successfully
        await expect(page).toHaveURL(/\/integrations/);

        // Check for critical console errors
        const criticalErrors = consoleErrors.filter(
            (err) =>
                !err.includes("ResizeObserver") &&
                !err.includes("Script error") &&
                !err.includes("WebSocket")
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test("displays integration cards", async ({ page }) => {
        await signIn(page);
        await page.goto("/integrations");

        // Should have integration cards visible
        // The cards are typically article elements or divs with specific patterns
        const content = page.locator("main");
        await expect(content).toBeVisible();

        // Page should have meaningful content (not empty or error state)
        const bodyText = await page.locator("body").textContent();
        expect(bodyText).toBeTruthy();
        expect(bodyText!.length).toBeGreaterThan(100);
    });
});

test.describe("Knowledge Base Page", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("loads without console errors", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        await signIn(page);
        await page.goto("/knowledge-base");

        // Page should load successfully
        await expect(page).toHaveURL(/\/knowledge-base/);

        // Check for critical console errors
        const criticalErrors = consoleErrors.filter(
            (err) =>
                !err.includes("ResizeObserver") &&
                !err.includes("Script error") &&
                !err.includes("WebSocket")
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test("shows librarian or knowledge content", async ({ page }) => {
        await signIn(page);
        await page.goto("/knowledge-base");

        // Page should have main content area (may have multiple main elements)
        const main = page.locator("main").first();
        await expect(main).toBeVisible();
    });
});

test.describe("Header Navigation", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("header is visible on authenticated pages", async ({ page }) => {
        await signIn(page);
        await page.goto("/connection");

        // Header should be present
        const header = page.locator("header");
        await expect(header).toBeVisible();
    });

    test("can navigate between main sections", async ({ page }) => {
        await signIn(page);
        await page.goto("/connection");

        // Should be able to navigate to AI Team
        const aiTeamLink = page.getByRole("link", { name: /ai team/i });
        if ((await aiTeamLink.count()) > 0) {
            await expect(aiTeamLink).toBeVisible();
            await aiTeamLink.click();
            await expect(page).toHaveURL(/\/ai-team/);
        }

        // Should be able to navigate to Knowledge Base
        const kbLink = page.getByRole("link", { name: /knowledge/i });
        if ((await kbLink.count()) > 0) {
            await expect(kbLink).toBeVisible();
            await kbLink.click();
            await expect(page).toHaveURL(/\/knowledge/);
        }
    });
});

test.describe("Connection/Chat Page", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("loads without console errors", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        await signIn(page);
        await page.goto("/connection");

        // Page should load successfully
        await expect(page).toHaveURL(/\/connection/);

        // Check for critical console errors
        const criticalErrors = consoleErrors.filter(
            (err) =>
                !err.includes("ResizeObserver") &&
                !err.includes("Script error") &&
                !err.includes("WebSocket")
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test("shows chat composer", async ({ page }) => {
        await signIn(page);
        await page.goto("/connection");

        // Should have a text input or textarea for composing messages
        const composer = page.locator(
            'textarea, input[type="text"], [contenteditable="true"]'
        );
        await expect(composer.first()).toBeVisible();
    });
});

test.describe("Visual Consistency", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

    test("no broken images on main pages", async ({ page }) => {
        await signIn(page);

        const pages = ["/connection", "/ai-team", "/integrations", "/knowledge-base"];

        for (const pagePath of pages) {
            await page.goto(pagePath);
            await page.waitForLoadState("networkidle");

            // Check for broken images
            const brokenImages = await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll("img"));
                return images.filter(
                    (img) =>
                        img.complete === false ||
                        (img.naturalHeight === 0 && img.src !== "")
                ).length;
            });

            expect(brokenImages).toBe(0);
        }
    });

    test("all main pages respond with 200", async ({ page }) => {
        await signIn(page);

        const pages = ["/connection", "/ai-team", "/integrations", "/knowledge-base"];

        for (const pagePath of pages) {
            const response = await page.goto(pagePath);
            expect(response?.status()).toBe(200);
        }
    });
});
