import { test, expect } from "@playwright/test";

/**
 * Public Route Access Tests
 *
 * Verifies that public routes are accessible without authentication.
 * Tests HTTP responses and accessibility, not content.
 *
 * Tests behavior: public routes should return 200 and load without requiring auth.
 */

test.describe("Public Routes", () => {
    test("home page is accessible without authentication", async ({ page }) => {
        const response = await page.goto("/");

        expect(response?.status()).toBe(200);
        // Should not redirect to sign-in
        expect(page.url()).not.toContain("sign-in");
    });

    test("sign-in page is accessible without authentication", async ({ page }) => {
        const response = await page.goto("/sign-in");

        expect(response?.status()).toBe(200);
    });

    test("sign-up page is accessible without authentication", async ({ page }) => {
        const response = await page.goto("/sign-up");

        expect(response?.status()).toBe(200);
    });

    test("ai-first-development page is accessible without authentication", async ({
        page,
    }) => {
        const response = await page.goto("/ai-first-development");

        expect(response?.status()).toBe(200);
        // Should not redirect to sign-in
        expect(page.url()).not.toContain("sign-in");
    });
});
