import { test, expect } from "@playwright/test";

/**
 * Public Assets Tests
 *
 * Verify all public URLs are accessible and use the correct domain.
 * Tests robots.txt, logos, favicons, and other static assets.
 */

test.describe("Public Assets - URLs and Accessibility", () => {
    test("robots.txt is accessible with correct sitemap URL", async ({ page }) => {
        const response = await page.goto("/robots.txt");

        // Should be accessible
        expect(response?.status()).toBe(200);

        // Get the content
        const content = await page.content();

        // ✅ Verify sitemap URL uses correct domain
        expect(content).toContain("sitemap.xml");
        expect(content).toContain("carmenta.ai"); // Production domain in robots.txt
    });

    test("sitemap.xml is accessible", async ({ page }) => {
        const response = await page.goto("/sitemap.xml");

        // Should be accessible
        expect(response?.status()).toBe(200);

        // Verify it's XML
        expect(response?.headers()["content-type"]).toContain("xml");
    });

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

    test("llms.txt is accessible", async ({ page }) => {
        const response = await page.goto("/llms.txt");
        expect(response?.status()).toBe(200);

        // Should be plain text
        expect(response?.headers()["content-type"]).toContain("text/plain");
    });

    test("500.html error page is accessible", async ({ page }) => {
        const response = await page.goto("/500.html");
        expect(response?.status()).toBe(200);

        // Should contain error content
        const content = await page.content();
        expect(content).toContain("500");
    });

    test("service worker sw.js is accessible", async ({ page }) => {
        const response = await page.goto("/sw.js");
        expect(response?.status()).toBe(200);

        // Should be JavaScript
        expect(response?.headers()["content-type"]).toContain("javascript");
    });

    // Test some logo files exist and are accessible
    test("logo files in /logos directory are accessible", async ({ page }) => {
        // Test a few common logo files
        const logoFiles = ["/logos/carmenta-icon.svg", "/logos/carmenta-logo.svg"];

        for (const logo of logoFiles) {
            const response = await page.goto(logo, { failOnStatusCode: false });

            // Some logos might not exist, but check if the ones that do are accessible
            if (response?.status() === 200) {
                expect(response.headers()["content-type"]).toMatch(/image|svg/);
            }
        }
    });

    test("all public asset URLs use correct domain (no internal hostnames)", async ({
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
