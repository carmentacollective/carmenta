import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect } from "@playwright/test";

/**
 * Authenticated User Redirect Tests
 *
 * Tests that authenticated users are correctly redirected from the homepage
 * to /connection. This catches production-only proxy bugs like the
 * Next.js 16 export default vs export const proxy issue.
 *
 * Requires environment variables:
 * - E2E_CLERK_USER_EMAIL: Test user email
 * - E2E_CLERK_USER_PASSWORD: Test user password
 *
 * Tests are skipped if credentials are not configured.
 */

const testUserEmail = process.env.E2E_CLERK_USER_EMAIL;
const testUserPassword = process.env.E2E_CLERK_USER_PASSWORD;
const hasCredentials = testUserEmail && testUserPassword;

test.describe("Authenticated User Redirects", () => {
    test.skip(!hasCredentials, "Skipping: E2E_CLERK_USER_* credentials not set");

    test("authenticated users on homepage are redirected to /connection", async ({
        page,
    }) => {
        // Initialize Clerk testing token for this test
        await setupClerkTestingToken({ page });

        // Navigate to a public page first (required before clerk.signIn)
        await page.goto("/");

        // Sign in with test user
        await clerk.signIn({
            page,
            signInParams: {
                strategy: "password",
                identifier: testUserEmail!,
                password: testUserPassword!,
            },
        });

        // Navigate to homepage as authenticated user
        // This should trigger the redirect in proxy.ts
        await page.goto("/");

        // Should be redirected to /connection
        await page.waitForURL(/\/connection/, { timeout: 10000 });
        expect(page.url()).toContain("/connection");
    });

    test("authenticated users stay on /connection after redirect", async ({
        page,
    }) => {
        await setupClerkTestingToken({ page });
        await page.goto("/");

        await clerk.signIn({
            page,
            signInParams: {
                strategy: "password",
                identifier: testUserEmail!,
                password: testUserPassword!,
            },
        });

        // Go directly to /connection
        await page.goto("/connection");

        // Should stay on /connection (not redirect loop)
        expect(page.url()).toContain("/connection");

        // Page should load without errors
        const response = await page.reload();
        expect(response?.status()).toBe(200);
    });
});
