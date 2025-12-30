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
 * - CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
 * - CLERK_SECRET_KEY
 * - TEST_USER_EMAIL: Test user email
 * - TEST_USER_PASSWORD: Test user password
 *
 * Tests are skipped if any required credentials are not configured.
 */

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;
const hasCredentials = testUserEmail && testUserPassword && hasClerkKeys;

test.describe("Authenticated User Redirects", () => {
    test.skip(
        !hasCredentials,
        "Skipping: Clerk API keys or TEST_USER_* credentials not set"
    );

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
        await expect(page).toHaveURL(/\/connection/);
    });

    test("authenticated users stay on /connection after redirect", async ({ page }) => {
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
        await expect(page).toHaveURL(/\/connection/);

        // Page should load without errors
        const response = await page.reload();
        expect(response).not.toBeNull();
        expect(response?.status()).toBe(200);
    });
});
