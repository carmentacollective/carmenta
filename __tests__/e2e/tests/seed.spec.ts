import { clerkSetup, setupClerkTestingToken, clerk } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * Auth Seed - Creates Cached Authentication State
 *
 * This setup file runs once before all tests and:
 * 1. Initializes Clerk testing token
 * 2. Authenticates as the test user
 * 3. Saves auth state (cookies, localStorage) to .auth/user.json
 *
 * All subsequent tests load this cached state, skipping login entirely.
 * This reduces test runtime from ~3min (repeated logins) to ~30s (cached auth).
 *
 * Required environment variables:
 * - CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
 * - CLERK_SECRET_KEY
 * - TEST_USER_EMAIL, TEST_USER_PASSWORD
 *
 * Graceful degradation: Setup is skipped if Clerk keys are not configured.
 * Tests that require auth will fail with a clear message.
 */

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_STATE_PATH = path.join(__dirname, "../.auth/user.json");

const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasTestCredentials = testUserEmail && testUserPassword && hasClerkKeys;

setup.describe.configure({ mode: "serial" });

setup("initialize Clerk testing", async () => {
    if (!hasClerkKeys) {
        console.log(
            "⚠️  Skipping Clerk setup: CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY not set"
        );
        return;
    }

    await clerkSetup();
});

setup("authenticate and cache session", async ({ page }) => {
    // Extended timeout for initial auth - this is a one-time cost
    setup.setTimeout(60_000);

    if (!hasTestCredentials) {
        console.log("⚠️  Skipping auth setup: TEST_USER credentials not set");
        // Create empty auth state so tests can still run (they'll be unauthenticated)
        const authDir = path.dirname(AUTH_STATE_PATH);
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }
        fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
        return;
    }

    console.log("🔐 Authenticating test user...");

    // Set up Clerk testing token
    await setupClerkTestingToken({ page });

    // Navigate to a page first (required before clerk.signIn)
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

    // Verify authentication succeeded
    await expect(page).not.toHaveURL(/sign-in/);
    console.log("✅ Authentication successful");

    // Warm up critical pages to trigger Next.js compilation
    // This is essential in CI where dev server starts fresh
    // FIXME: /knowledge-base excluded - page times out during warmup (#854)
    const pagesToWarmUp = ["/connection", "/ai-team", "/integrations"];

    console.log("🔥 Warming up pages...");
    for (const pagePath of pagesToWarmUp) {
        await page.goto(pagePath, { timeout: 30_000 });
        await expect(page.locator("body")).toBeVisible();
    }

    // Save auth state for reuse by all authenticated tests
    const authDir = path.dirname(AUTH_STATE_PATH);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    await page.context().storageState({ path: AUTH_STATE_PATH });
    console.log(`✅ Auth state saved to ${AUTH_STATE_PATH}`);
});
