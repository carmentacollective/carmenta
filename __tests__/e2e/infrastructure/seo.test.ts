import { test, expect } from "@playwright/test";

/**
 * SEO Infrastructure Tests
 *
 * Verifies that SEO-critical files are accessible and properly configured.
 * Tests HTTP responses, content types, and essential SEO configuration.
 *
 * Tests behavior: SEO files should return 200 with correct content-type headers,
 * and contain required configuration (e.g., sitemap URL in robots.txt).
 */

test.describe("SEO Files", () => {
    test("robots.txt is accessible", async ({ page }) => {
        const response = await page.goto("/robots.txt");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("text");
    });

    test("robots.txt contains sitemap URL with correct domain", async ({ page }) => {
        await page.goto("/robots.txt");
        const content = await page.content();

        // Should reference sitemap.xml
        expect(content).toContain("sitemap.xml");
        // Should use production domain in robots.txt
        expect(content).toContain("carmenta.ai");
    });

    test("robots.txt allows /connection/ for shared connections", async ({ page }) => {
        await page.goto("/robots.txt");
        const text = await page.textContent("body");

        // Explicitly allows shared connection URLs to be crawled
        expect(text).toContain("Allow: /connection/");
    });

    test("sitemap.xml is accessible", async ({ page }) => {
        const response = await page.goto("/sitemap.xml");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("xml");
    });

    test("manifest.webmanifest is accessible", async ({ page }) => {
        const response = await page.goto("/manifest.webmanifest");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("json");
    });

    test("llms.txt is accessible", async ({ page }) => {
        const response = await page.goto("/llms.txt");

        expect(response?.status()).toBe(200);
        expect(response?.headers()["content-type"]).toContain("text/plain");
    });
});

test.describe("SEO URL Configuration", () => {
    test("SEO files use correct domain (no internal hostnames)", async ({ page }) => {
        // Test various SEO files to ensure they don't redirect to internal hostnames
        const seoFiles = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];

        for (const file of seoFiles) {
            await page.goto(file);

            // ✅ Verify URL doesn't contain internal service hostname
            const currentUrl = page.url();
            expect(currentUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

            // Verify uses public domain (localhost in dev, carmenta.ai in prod)
            expect(currentUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        }
    });
});
