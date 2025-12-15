import { test, expect } from "@playwright/test";

/**
 * Smoke Tests - Fast, Critical Path Validation
 *
 * These tests catch catastrophic failures:
 * - App loads without errors
 * - Public routes return 200
 * - Core assets are accessible
 * - No JavaScript errors on page load
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

    test("public homepage returns 200", async ({ page }) => {
        const response = await page.goto("/");
        expect(response?.status()).toBe(200);
    });

    test("core static assets load", async ({ page }) => {
        const coreAssets = ["/favicon.ico", "/manifest.webmanifest", "/robots.txt"];

        for (const asset of coreAssets) {
            const response = await page.goto(asset);
            expect(response?.status()).toBe(200);
        }
    });

    test("sitemap.xml returns valid XML", async ({ page }) => {
        const response = await page.goto("/sitemap.xml");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("xml");
    });

    test("no network errors on initial page load", async ({ page }) => {
        const failedRequests: string[] = [];

        page.on("requestfailed", (request) => {
            failedRequests.push(request.url());
        });

        await page.goto("/");

        // Should not have failed requests
        expect(failedRequests).toHaveLength(0);
    });
});
