import { test, expect } from "@playwright/test";

/**
 * Public Assets Tests
 *
 * Verifies that public static assets (favicons, logos, images) are accessible
 * and serve with correct content types.
 *
 * Tests behavior: Asset files should return 200 with appropriate content-type headers,
 * and URLs should use public domain (not internal hostnames).
 */

test.describe("Favicons and Icons", () => {
    test("favicon.ico is accessible", async ({ page }) => {
        const response = await page.goto("/favicon.ico");
        expect(response?.status()).toBe(200);
    });

    test("favicon.png is accessible", async ({ page }) => {
        const response = await page.goto("/favicon.png");
        expect(response?.status()).toBe(200);
    });

    test("apple-touch-icon.png is accessible", async ({ page }) => {
        const response = await page.goto("/apple-touch-icon.png");
        expect(response?.status()).toBe(200);
    });
});

test.describe("Logo Assets", () => {
    test("at least one logo file is accessible", async ({ page }) => {
        // Test logo files used in the app
        const logoFiles = ["/logos/icon-transparent.png", "/logos/carmenta-logo.svg"];

        let accessibleCount = 0;
        for (const logo of logoFiles) {
            const response = await page.goto(logo);

            if (response?.status() === 200) {
                // Verify correct content type for images
                expect(response.headers()["content-type"]).toMatch(/image|svg|png/);
                accessibleCount++;
            }
        }

        // Ensure at least one logo file is accessible
        expect(accessibleCount).toBeGreaterThan(0);
    });
});

test.describe("Service Worker", () => {
    test("service worker sw.js is accessible", async ({ page }) => {
        const response = await page.goto("/sw.js");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("javascript");
    });
});

test.describe("Asset URL Configuration", () => {
    test("public asset URLs use correct domain (no internal hostnames)", async ({
        page,
    }) => {
        // Test various public assets to ensure they don't redirect to internal hostnames
        const publicUrls = ["/favicon.ico", "/robots.txt", "/sitemap.xml"];

        for (const url of publicUrls) {
            await page.goto(url);

            // ✅ Verify URL doesn't contain internal service hostname
            const currentUrl = page.url();
            expect(currentUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

            // Verify uses public domain (localhost in dev, carmenta.ai in prod)
            expect(currentUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        }
    });
});
