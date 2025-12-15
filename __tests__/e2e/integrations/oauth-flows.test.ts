import { test, expect } from "@playwright/test";

/**
 * OAuth Flow Tests
 *
 * Verifies that OAuth flows use correct public domain URLs and never leak
 * internal service hostnames (like srv-xxx:10000 from Render).
 *
 * Critical regression tests: These caught bugs where request.url was used
 * instead of NEXT_PUBLIC_APP_URL, causing redirects to internal hostnames.
 *
 * Tests behavior: OAuth redirects should use public domain (localhost|carmenta.ai),
 * never internal service hostnames.
 *
 * Note: These tests require Clerk authentication to be configured.
 * They will be skipped in environments without Clerk secrets (e.g., fork PRs).
 */

const hasClerkSecrets =
    !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

test.describe("OAuth URL Validation", () => {
    test.skip(!hasClerkSecrets, "Skipping: Clerk secrets not available (fork PR)");

    test("authorize route requires auth and redirects with public URL", async ({
        page,
    }) => {
        // Without Clerk authentication, should redirect to sign-in
        await page.goto("/integrations/oauth/authorize/notion");

        // Should redirect to sign-in (requires Clerk auth)
        await page.waitForURL(/sign-in/);

        const finalUrl = page.url();

        // ✅ Verify uses public domain, not internal hostname
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);
        expect(finalUrl).toContain("/sign-in");

        // NOTE: Testing actual OAuth callback URL construction requires Clerk auth.
        // Covered by unit tests in the authorize route handler.
    });

    test("callback route redirects to public domain on success", async ({ page }) => {
        // Simulate successful OAuth callback from provider
        await page.goto("/integrations/oauth/callback?code=MOCK_CODE&state=MOCK_STATE");

        // Wait for client-side redirect to complete
        await page.waitForURL(/\/integrations/);

        const finalUrl = page.url();

        // ✅ THIS WOULD HAVE CAUGHT THE BUG
        // Verify redirect uses public domain, not internal hostname
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
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

        // ✅ Verify error redirect uses public domain
        expect(finalUrl).toMatch(/^https?:\/\/(localhost|carmenta\.ai)/);
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);
        expect(finalUrl).toContain("/integrations");
    });

    test("callback route handles invalid state with public URL", async ({ page }) => {
        // Simulate callback with invalid/expired state
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

    test("unauthorized OAuth attempt redirects with public URL", async ({ page }) => {
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
