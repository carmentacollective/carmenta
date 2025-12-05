import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Authentication Flow E2E Tests
 *
 * Tests the complete authentication journey:
 * 1. Public routes accessible without auth
 * 2. Protected routes redirect to sign-in
 * 3. Sign-in flow with Clerk Testing Tokens
 * 4. Post-auth access to protected routes
 *
 * These tests use Clerk's Testing Token feature which bypasses bot detection
 * and allows programmatic authentication.
 *
 * @see https://clerk.com/docs/testing/playwright/test-authenticated-flows
 */

/**
 * Test user credentials - should be a user in your Clerk test instance.
 * Set these via environment variables for CI/CD security.
 */
const TEST_USER = {
    identifier: process.env.E2E_CLERK_USER_EMAIL ?? "test@example.com",
    password: process.env.E2E_CLERK_USER_PASSWORD ?? "testpassword123",
};

test.describe("Authentication Flow", () => {
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

            // Sign-in page should show Carmenta branding and Clerk form
            await expect(page.getByText("Carmenta")).toBeVisible();
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
        test("connection page redirects unauthenticated users to sign-in", async ({
            page,
        }) => {
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
            await page.goto("/connection/some-slug");

            // Should redirect to sign-in
            await page.waitForURL(/sign-in/, { timeout: 10000 });
            expect(page.url()).toContain("sign-in");
        });
    });

    test.describe("Authenticated Access", () => {
        // Setup Clerk testing token for authenticated tests
        test.beforeEach(async ({ page }) => {
            await setupClerkTestingToken({ page });
        });

        test("can access /connection/new after sign-in", async ({ page }) => {
            // Sign in using Clerk testing helper
            await clerk.signIn({
                page,
                signInParams: {
                    strategy: "password",
                    identifier: TEST_USER.identifier,
                    password: TEST_USER.password,
                },
            });

            // Navigate to protected route
            await page.goto("/connection/new");
            await page.waitForLoadState("networkidle");

            // Should not redirect to sign-in
            expect(page.url()).not.toContain("sign-in");
            expect(page.url()).toContain("/connection");

            // Page should render the chat interface
            const input = page.getByRole("textbox");
            await expect(input).toBeVisible({ timeout: 10000 });
        });

        test("can sign out and lose access to protected routes", async ({ page }) => {
            // Sign in first
            await clerk.signIn({
                page,
                signInParams: {
                    strategy: "password",
                    identifier: TEST_USER.identifier,
                    password: TEST_USER.password,
                },
            });

            // Verify authenticated access
            await page.goto("/connection/new");
            await page.waitForLoadState("networkidle");
            expect(page.url()).not.toContain("sign-in");

            // Sign out
            await clerk.signOut({ page });

            // Try to access protected route again
            await page.goto("/connection/new");
            await page.waitForURL(/sign-in/, { timeout: 10000 });

            // Should be back at sign-in
            expect(page.url()).toContain("sign-in");
        });
    });

    test.describe("Full User Journey", () => {
        test.beforeEach(async ({ page }) => {
            await setupClerkTestingToken({ page });
        });

        test("complete flow: home -> connect -> sign-in -> chat", async ({ page }) => {
            // 1. Start at home page
            await page.goto("/");
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

            // 2. Click connect link in header
            const connectLink = page.getByRole("link", { name: /connect/i });
            await connectLink.click();

            // 3. Should redirect to sign-in (unauthenticated)
            await page.waitForURL(/sign-in/, { timeout: 10000 });
            expect(page.url()).toContain("sign-in");

            // 4. Sign in using Clerk
            await clerk.signIn({
                page,
                signInParams: {
                    strategy: "password",
                    identifier: TEST_USER.identifier,
                    password: TEST_USER.password,
                },
            });

            // 5. After sign-in, should be redirected to /connection
            await page.waitForURL(/\/connection/, { timeout: 10000 });
            expect(page.url()).toContain("/connection");

            // 6. Chat interface should be visible
            const input = page.getByRole("textbox");
            await expect(input).toBeVisible({ timeout: 10000 });
        });

        test("direct navigation to protected route triggers auth then returns", async ({
            page,
        }) => {
            // Navigate directly to protected route while unauthenticated
            await page.goto("/connection/new");

            // Should redirect to sign-in
            await page.waitForURL(/sign-in/, { timeout: 10000 });

            // Sign in
            await clerk.signIn({
                page,
                signInParams: {
                    strategy: "password",
                    identifier: TEST_USER.identifier,
                    password: TEST_USER.password,
                },
            });

            // After sign-in, should be at connection page
            await page.waitForURL(/\/connection/, { timeout: 10000 });
            expect(page.url()).toContain("/connection");
        });
    });
});
