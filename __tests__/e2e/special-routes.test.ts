import { test, expect } from "@playwright/test";

/**
 * E2E tests for special routes (robots.txt, sitemap.xml)
 *
 * These routes are publicly accessible and return specific formats
 * that search engines and crawlers expect.
 */

test.describe("Special Routes", () => {
    test("robots.txt returns valid robots file", async ({ page }) => {
        const response = await page.goto("/robots.txt");

        // Should return 200 OK
        expect(response?.status()).toBe(200);

        // Should have text content type
        const contentType = response?.headers()["content-type"];
        expect(contentType).toContain("text");

        // Should contain required robots.txt directives
        const text = await page.textContent("body");
        expect(text).toContain("User-agent:");
        expect(text).toContain("sitemap:");
        expect(text).toContain("carmenta.ai");
    });

    test("sitemap.xml returns valid XML", async ({ page }) => {
        const response = await page.goto("/sitemap.xml");

        // Should return 200 OK
        expect(response?.status()).toBe(200);

        // Should have XML content type
        const contentType = response?.headers()["content-type"];
        expect(contentType).toContain("xml");

        // Should contain valid sitemap XML structure
        const text = await page.textContent("body");
        expect(text).toContain("<urlset");
        expect(text).toContain("<url>");
        expect(text).toContain("<loc>");
        expect(text).toContain("carmenta.ai");
    });

    test("sitemap.xml includes main pages", async ({ page }) => {
        await page.goto("/sitemap.xml");

        const text = await page.textContent("body");

        // Should include key public pages
        expect(text).toContain("carmenta.ai/connection/new");
        expect(text).toContain("carmenta.ai/ai-first-development");
    });

    test("robots.txt references sitemap.xml", async ({ page }) => {
        await page.goto("/robots.txt");

        const text = await page.textContent("body");

        // Should reference the sitemap
        expect(text).toContain("sitemap:");
        expect(text).toContain("/sitemap.xml");
    });
});
