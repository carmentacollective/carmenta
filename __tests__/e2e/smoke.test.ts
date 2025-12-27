import { test, expect } from "@playwright/test";

/**
 * Smoke Tests - Fast, Critical Path Validation
 *
 * These tests catch catastrophic failures:
 * - App loads without JavaScript errors
 * - No network errors on initial page load
 *
 * Run these first in CI - if they fail, nothing else matters.
 */

test.describe("Smoke Tests", () => {
    test("app loads without errors", async ({ page }) => {
        // Listen for console errors
        const errors: string[] = [];
        page.on("pageerror", (error) => {
            errors.push(error.message);
        });

        // Navigate to homepage
        const response = await page.goto("/");

        // Should load successfully
        expect(response?.status()).toBe(200);

        // Should not have JavaScript errors
        expect(errors).toHaveLength(0);
    });

    test("no network errors on initial page load", async ({ page }) => {
        const failedRequests: string[] = [];

        page.on("requestfailed", (request) => {
            const url = request.url();
            // Exclude Clerk auth redirects - these are expected for unauthenticated users
            // and may fail/abort as part of normal redirect flow
            if (url.includes("accounts.dev") || url.includes("clerk.")) {
                return;
            }
            failedRequests.push(url);
        });

        await page.goto("/");

        // Should not have failed requests (excluding expected auth redirects)
        expect(failedRequests).toHaveLength(0);
    });
});
