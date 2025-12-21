import { test, expect } from "@playwright/test";

/**
 * Public Route Access Tests
 *
 * Verifies that public routes are accessible without authentication.
 * Tests HTTP responses and accessibility, not content.
 *
 * Tests behavior: public routes should return 200 and load without requiring auth.
 */

const marketingPages = [
    "/",
    "/ai-first-development",
    "/brand",
    "/guide",
    "/offline",
    "/privacy",
    "/security",
    "/terms",
];

const authPages = ["/sign-in", "/sign-up"];

test.describe("Public Routes", () => {
    for (const route of marketingPages) {
        test(`${route} is accessible without authentication`, async ({ page }) => {
            const response = await page.goto(route);

            expect(response?.status()).toBe(200);
            expect(page.url()).not.toContain("sign-in");
        });
    }

    for (const route of authPages) {
        test(`${route} is accessible without authentication`, async ({ page }) => {
            const response = await page.goto(route);

            expect(response?.status()).toBe(200);
        });
    }
});
