import { test, expect } from "@playwright/test";

/**
 * Connect Page E2E Tests
 *
 * Tests that /connection properly redirects to sign-in for unauthenticated users.
 * Authenticated chat functionality is tested via unit tests with mocked Clerk.
 */

test.describe("Connect Page", () => {
    test("redirects to sign-in when not authenticated", async ({ page }) => {
        await page.goto("/connection");

        // Clerk protects /connection, so unauthenticated users get redirected
        await page.waitForURL(/sign-in/, { timeout: 10000 });
        expect(page.url()).toContain("sign-in");
    });
});
