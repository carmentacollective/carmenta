import { test, expect } from "@playwright/test";

/**
 * OAuth URL Validation Tests
 *
 * Verifies that OAuth routes don't leak internal service hostnames.
 * These are regression tests that caught bugs where request.url was used
 * instead of NEXT_PUBLIC_APP_URL, causing redirects to internal hostnames
 * like srv-xxx:10000 from Render.
 *
 * Tests behavior: Routes should never expose internal hostnames in URLs.
 * Clerk handles authentication and redirects to its own domain - this is expected.
 *
 * Note: These tests require Clerk secrets and will be skipped in fork PRs.
 */

const hasClerkSecrets =
    !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

test.describe("OAuth URL Validation", () => {
    test.skip(!hasClerkSecrets, "Skipping: Clerk secrets not available (fork PR)");

    test("authorize route redirects without exposing internal hostnames", async ({
        page,
    }) => {
        // Try to access OAuth authorize endpoint
        await page.goto("/integrations/oauth/authorize/notion");

        // Should redirect (Clerk handles auth)
        await page.waitForURL(/sign-in/);

        const finalUrl = page.url();

        // ✅ Critical: Verify no internal hostname leak
        expect(finalUrl).not.toMatch(/srv-[a-z0-9-]+:[0-9]+/);

        // Should contain sign-in (Clerk or app sign-in page)
        expect(finalUrl).toContain("/sign-in");
    });
});
