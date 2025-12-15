import { test, expect } from "@playwright/test";

/**
 * Error Page Tests
 *
 * Verifies that error pages and offline fallbacks are accessible and configured.
 * These pages are served when the application encounters errors or is offline.
 *
 * Tests behavior: Error pages should return 200 when accessed directly
 * (they're static HTML files, not error responses).
 */

test.describe("Error Pages", () => {
    test("404 not-found page renders for non-existent routes", async ({ page }) => {
        const response = await page.goto("/this-route-definitely-does-not-exist");

        // Next.js renders app/not-found.tsx and returns 404
        expect(response?.status()).toBe(404);

        // Should render without crashing (page loads)
        await expect(page.locator("body")).toBeVisible();
    });

    test("500.html static error page is accessible", async ({ page }) => {
        // Static fallback for when Next.js crashes
        const response = await page.goto("/500.html");

        expect(response?.status()).toBe(200);

        // Should contain error indicator in content
        const content = await page.content();
        expect(content).toContain("500");
    });
});
