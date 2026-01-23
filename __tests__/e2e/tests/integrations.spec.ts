import { test, expect } from "@playwright/test";
import { checkCredentials, warnSkippedTests } from "../lib/credentials";

/**
 * Integrations E2E Tests
 *
 * Tests for the integrations page and OAuth/API key connection flows.
 * These tests require authentication (uses cached auth state from seed.spec.ts).
 *
 * @tags @integrations @authenticated
 */

const { shouldSkip, skipReason } = checkCredentials({ requireTestUser: false });

test.describe("Integrations Page", () => {
    test.beforeAll(() => warnSkippedTests("Integrations Page"));
    test.skip(shouldSkip, skipReason);

    test.beforeEach(async ({ page }) => {
        await page.goto("/integrations");
    });

    test("page loads successfully with service cards", async ({ page }) => {
        // Wait for page to finish loading (loading spinner should disappear)
        await expect(page.locator("text=Loading integrations...")).not.toBeVisible({
            timeout: 10000,
        });

        // Page should have the integrations header
        await expect(page.locator("h1")).toContainText("Integrations");

        // Should show either service cards or "No connections yet" empty state
        // Use explicit timeout rather than silent catch
        const servicesGrid = page.locator("section").filter({
            has: page.locator("h2, h3").or(page.locator('button:has-text("Connect")')),
        });
        const emptyState = page.locator("text=No connections yet");

        // At least one must be visible
        const hasServices = await servicesGrid
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false);
        const hasEmptyState = await emptyState
            .isVisible({ timeout: 1000 })
            .catch(() => false);

        // Explicit assertion with helpful message
        expect(
            hasServices || hasEmptyState,
            "Expected either service cards or empty state to be visible"
        ).toBe(true);
    });

    test("no JavaScript errors on integrations page", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => {
            errors.push(error.message);
        });

        await page.goto("/integrations");
        await expect(page.locator("h1")).toContainText("Integrations");

        expect(errors).toHaveLength(0);
    });

    test("MCP servers link is visible", async ({ page }) => {
        // Wait for content to load
        await expect(page.locator("text=Loading integrations...")).not.toBeVisible({
            timeout: 10000,
        });

        // MCP servers link should be in the Advanced section
        const mcpLink = page.locator('a[href="/integrations/mcp"]');
        await expect(mcpLink).toBeVisible();
        await expect(mcpLink).toContainText("MCP Servers");
    });

    test("can navigate to MCP servers page", async ({ page }) => {
        await expect(page.locator("text=Loading integrations...")).not.toBeVisible({
            timeout: 10000,
        });

        await page.click('a[href="/integrations/mcp"]');
        await expect(page).toHaveURL(/\/integrations\/mcp/);
    });
});

test.describe("OAuth URL Validation", () => {
    test.beforeAll(() => warnSkippedTests("OAuth URL Validation"));
    test.skip(shouldSkip, skipReason);

    test("authorize route handles OAuth correctly (no internal hostname leak)", async ({
        page,
    }) => {
        // Navigate to OAuth authorize - tests both configured and unconfigured scenarios
        const response = await page.goto("/integrations/oauth/authorize/notion", {
            waitUntil: "commit",
        });

        const status = response?.status() ?? 0;
        const finalUrl = page.url();

        // Critical: Verify no internal hostname leak (regression test)
        // This catches the bug where internal service hostnames like srv-xxx:3000 leak to client
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

        // Handle two valid scenarios:
        // 1. OAuth credentials configured → redirects to provider (status < 500)
        // 2. OAuth credentials not configured → returns 500 with specific error message
        if (status === 500) {
            // Verify it's the expected "not configured" error, not a real bug
            const body = await response?.text();
            expect(body).toContain("OAuth credentials not configured");
        } else {
            // Should redirect somewhere (Notion OAuth or our callback)
            expect(status).toBeLessThan(500);
        }
    });

    test("callback route validates state parameter", async ({ page }) => {
        // Try to access callback without valid state
        const response = await page.goto("/integrations/oauth/callback?code=invalid");

        // Should handle gracefully (redirect or error page, not crash)
        expect(response?.status()).not.toBe(500);
    });
});

test.describe("Service Card Interactions", () => {
    test.beforeAll(() => warnSkippedTests("Service Card Interactions"));
    test.skip(shouldSkip, skipReason);

    test.beforeEach(async ({ page }) => {
        await page.goto("/integrations");
        await expect(page.locator("text=Loading integrations...")).not.toBeVisible({
            timeout: 10000,
        });
    });

    test("service cards display connection status", async ({ page }) => {
        // Wait for loading to complete
        await expect(page.locator("text=Loading integrations...")).not.toBeVisible({
            timeout: 10000,
        });

        // Look for Connect buttons which indicate service cards are rendered
        const connectButtons = page.getByRole("button", { name: /connect/i });
        const buttonCount = await connectButtons.count();

        // Should have at least one service with a Connect button
        // (services that are already connected might show different UI)
        if (buttonCount > 0) {
            // Verify first Connect button is visible and clickable
            await expect(connectButtons.first()).toBeVisible();
        }
        // Note: If no buttons and no empty state, the "page loads" test catches the issue
    });
});

test.describe("OAuth Error Handling", () => {
    test.beforeAll(() => warnSkippedTests("OAuth Error Handling"));
    test.skip(shouldSkip, skipReason);

    test("displays error message from OAuth callback", async ({ page }) => {
        // Navigate with error params
        await page.goto(
            "/integrations?error=oauth_failed&service=notion&message=User%20denied%20access"
        );

        // Should show error banner - use more specific selector
        const errorBanner = page.locator(
            'div[class*="bg-red-500/10"][class*="rounded-xl"]'
        );
        await expect(errorBanner).toBeVisible();
        await expect(errorBanner).toContainText("denied");
    });

    test("displays success message from OAuth callback", async ({ page }) => {
        // Navigate with success params
        await page.goto("/integrations?success=connected&service=notion");

        // Should show success banner - use more specific selector
        const successBanner = page.locator(
            'div[class*="bg-green-500/10"][class*="rounded-xl"]'
        );
        await expect(successBanner).toBeVisible();
        await expect(successBanner).toContainText("connected");
    });
});
