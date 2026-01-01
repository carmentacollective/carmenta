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
            const failure = request.failure();

            // Exclude expected failure scenarios:
            // 1. Clerk auth redirects - abort as part of normal auth flow
            // 2. Aborted requests - often from navigation/redirect (not actual errors)
            // 3. Root URL redirects - authenticated users get redirected from /
            if (url.includes("accounts.dev") || url.includes("clerk.")) {
                return;
            }
            if (failure?.errorText === "net::ERR_ABORTED") {
                return; // Navigation cancellations, not errors
            }
            failedRequests.push(`${url} (${failure?.errorText || "unknown"})`);
        });

        await page.goto("/");

        // Should not have failed requests (excluding expected auth redirects and cancellations)
        expect(failedRequests).toHaveLength(0);
    });
});
