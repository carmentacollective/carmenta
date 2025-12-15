import { test, expect } from "@playwright/test";

/**
 * OAuth URL Validation Tests
 *
 * These tests verify that OAuth flows use the correct public domain URLs
 * and never leak internal service hostnames (like srv-xxx:10000 from Render).
 *
 * This catches bugs where request.url was used instead of NEXT_PUBLIC_APP_URL,
 * causing redirects to internal hostnames instead of the public domain.
 *
 * Note: These tests require Clerk authentication to be configured.
 * They will be skipped in environments without Clerk secrets (e.g., fork PRs).
 */

const hasClerkSecrets =
    !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

test.describe("OAuth URL Validation", () => {
    test.skip(!hasClerkSecrets, "Skipping: Clerk secrets not available (fork PR)");
    test("authorize route requires auth and redirects with correct URL", async ({
        page,
    }) => {
        // Without Clerk authentication, the authorize route should redirect to sign-in
        // This tests that the redirect uses the public domain (not internal hostname)

        await page.goto("/integrations/oauth/authorize/notion");

        // Should redirect to sign-in (requires Clerk auth)
        await page.waitForURL(/sign-in/);

        const finalUrl = page.url();

        // ✅ Verify unauthorized redirect uses public domain
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

        // Should redirect to sign-in page
        expect(finalUrl).toContain("/sign-in");

        // NOTE: Testing the actual OAuth callback URL construction requires Clerk authentication.
        // This is covered by unit tests in the authorize route handler.
        // E2E tests focus on verifying public domain usage in redirect paths.
    });

    test("callback route redirects to public domain on success", async ({ page }) => {
        // Simulate successful OAuth callback from provider
        // (In reality, this would come from Notion with a real code)
        await page.goto("/integrations/oauth/callback?code=MOCK_CODE&state=MOCK_STATE");

        // Wait for client-side redirect to complete
        await page.waitForURL(/\/integrations/);

        // Get the final URL (after client-side redirect from HTML)
        const finalUrl = page.url();

        // ✅ THIS WOULD HAVE CAUGHT THE BUG
        // Verify redirect uses public domain
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);

        // Verify NO internal service hostnames
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);
    });

    test("callback route redirects to public domain on error", async ({ page }) => {
        // Simulate OAuth error from provider
        await page.goto(
            "/integrations/oauth/callback?error=access_denied&error_description=User+cancelled"
        );

        // Wait for client-side redirect to complete
        await page.waitForURL(/\/integrations/);

        const finalUrl = page.url();

        // ✅ Verify error redirect uses public domain (main goal of this test)
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

        // Should redirect to integrations page
        expect(finalUrl).toContain("/integrations");
    });

    test("callback route handles invalid state with correct URL", async ({ page }) => {
        // Simulate callback with invalid/expired state
        // Without auth, this will redirect to Clerk sign-in, which then redirects to /integrations
        await page.goto(
            "/integrations/oauth/callback?code=MOCK_CODE&state=INVALID_STATE"
        );

        // Wait for redirect (may go to Clerk sign-in first)
        await page.waitForLoadState("networkidle");

        const finalUrl = page.url();

        // ✅ Verify redirect doesn't use internal hostname
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

        // Will either be at /integrations or Clerk sign-in (both valid)
        // The key is that it didn't use an internal hostname
    });

    test("unauthorized OAuth attempt redirects to sign-in with correct URL", async ({
        page,
    }) => {
        // Try to access OAuth authorize without being logged in
        await page.goto("/integrations/oauth/authorize/notion");

        // Should redirect to sign-in
        await page.waitForURL(/sign-in/);

        const finalUrl = page.url();

        // ✅ Verify sign-in redirect uses public domain
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);
    });
});
