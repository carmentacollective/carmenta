import { test, expect } from "@playwright/test";

/**
 * Authentication Flow E2E Tests
 *
 * Tests public route accessibility and auth guard redirects.
 * These tests do NOT require authentication - they verify that:
 * 1. Public routes are accessible without auth
 * 2. Protected routes properly redirect to sign-in
 *
 * For tests that require actual authentication, see:
 * - Unit tests with mocked Clerk (fast, no external deps)
 * - Manual testing with real Clerk credentials
 */

test.describe("Public Routes", () => {
    test("home page is accessible without authentication", async ({ page }) => {
        await page.goto("/");

        // Home page should load with greeting
        const heading = page.getByRole("heading", { level: 1 });
        await expect(heading).toBeVisible();
        await expect(heading).toHaveText(/Good (morning|afternoon|evening)/);
    });

    test("sign-in page is accessible", async ({ page }) => {
        await page.goto("/sign-in");

        // Sign-in page should show Carmenta branding (use heading to avoid title tag match)
        await expect(page.getByRole("heading", { name: "Carmenta" })).toBeVisible();
        await expect(
            page.getByText("Welcome back. Pick up where we left off.")
        ).toBeVisible();
    });

    test("sign-up page is accessible", async ({ page }) => {
        await page.goto("/sign-up");

        // Sign-up page should be visible
        await expect(page).toHaveTitle(/Sign Up/);
    });

    test("ai-first-development page is public", async ({ page }) => {
        await page.goto("/ai-first-development");

        // Should be accessible without auth
        await expect(page).not.toHaveURL(/sign-in/);
    });
});

test.describe("Protected Route Guards", () => {
    test("/connection redirects unauthenticated users to sign-in", async ({ page }) => {
        await page.goto("/connection");

        // Should redirect to sign-in
        await page.waitForURL(/sign-in/, { timeout: 10000 });
        expect(page.url()).toContain("sign-in");
    });

    test("/connection/new redirects unauthenticated users to sign-in", async ({
        page,
    }) => {
        await page.goto("/connection/new");

        // Should redirect to sign-in
        await page.waitForURL(/sign-in/, { timeout: 10000 });
        expect(page.url()).toContain("sign-in");
    });

    test("/connection/[slug] redirects unauthenticated users to sign-in", async ({
        page,
    }) => {
        await page.goto("/connection/some-random-slug");

        // Should redirect to sign-in
        await page.waitForURL(/sign-in/, { timeout: 10000 });
        expect(page.url()).toContain("sign-in");
    });
});

test.describe("Navigation Flow (Unauthenticated)", () => {
    test("clicking Connect link from home page triggers auth redirect", async ({
        page,
    }) => {
        // Start at home page
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        // Click first connect link (header button)
        const connectLink = page.getByRole("link", { name: /connect/i }).first();
        await connectLink.click();

        // Should redirect to sign-in (unauthenticated)
        await page.waitForURL(/sign-in/, { timeout: 10000 });
        expect(page.url()).toContain("sign-in");
    });
});
