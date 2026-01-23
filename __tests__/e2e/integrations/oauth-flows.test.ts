import { test, expect } from "@playwright/test";
import { checkCredentials, warnSkippedTests } from "../lib/credentials";

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
 */

const { shouldSkip, skipReason } = checkCredentials({ requireTestUser: false });

test.describe("OAuth URL Validation", () => {
    test.beforeAll(() => warnSkippedTests("OAuth URL Validation"));
    test.skip(shouldSkip, skipReason);

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
