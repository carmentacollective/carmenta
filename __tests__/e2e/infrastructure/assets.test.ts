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

test.describe("Favicons and Icons (Legacy)", () => {
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

test.describe("Next.js Metadata Images", () => {
    test("icon.png is accessible", async ({ page }) => {
        // Next.js serves app/icon.png at /icon.png
        const response = await page.goto("/icon.png");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toMatch(/^image\/(png|x-icon)/);
    });

    test("apple-icon.png is accessible", async ({ page }) => {
        // Next.js serves app/apple-icon.png at /apple-icon.png
        const response = await page.goto("/apple-icon.png");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toMatch(/^image\/(png|x-icon)/);
    });

    test("opengraph-image.png is accessible", async ({ page }) => {
        // Next.js serves app/opengraph-image.png at /opengraph-image.png
        // Critical for social media sharing (Open Graph protocol)
        const response = await page.goto("/opengraph-image.png");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toMatch(/^image\/(png|jpeg)/);
    });
});

test.describe("Logo Assets", () => {
    test("icon-transparent.png is accessible", async ({ page }) => {
        // Primary logo used throughout the application
        const response = await page.goto("/logos/icon-transparent.png");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toMatch(/^image\/png/);
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
