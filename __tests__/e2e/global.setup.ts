import { clerkSetup, setupClerkTestingToken, clerk } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";

/**
 * Global Setup for E2E Tests
 *
 * Two-phase initialization:
 * 1. Initialize Clerk testing token for authenticated test flows
 * 2. Warm up pages with authenticated user to trigger Next.js compilation
 *
 * The warm-up phase is critical for CI where the dev server starts fresh.
 * Without it, the first authenticated request to /connection triggers
 * compilation that can exceed the 20s navigation timeout.
 *
 * Required environment variables:
 * - CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
 * - CLERK_SECRET_KEY
 * - TEST_USER_EMAIL, TEST_USER_PASSWORD (for authenticated warm-up)
 *
 * Graceful degradation: Setup is skipped if Clerk keys are not configured.
 * This allows fork PRs and contributors without secrets to run other E2E tests.
 */

const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;
const hasTestCredentials = testUserEmail && testUserPassword && hasClerkKeys;

setup.describe.configure({ mode: "serial" });

setup("initialize Clerk testing", async () => {
    // Skip Clerk setup if keys aren't configured
    // This prevents fork PRs from failing when they don't have access to secrets
    if (!hasClerkKeys) {
        console.log(
            "⚠️  Skipping Clerk setup: CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY not set"
        );
        return;
    }

    await clerkSetup();
});

/**
 * Warm up pages as authenticated user to trigger Next.js compilation.
 *
 * In CI, the dev server starts fresh with no compiled pages. The first
 * authenticated request to /connection can take 30+ seconds to compile.
 * This warm-up step triggers that compilation during setup, not during tests.
 *
 * Timeout is generous (60s) because this is a one-time setup cost.
 */
setup("warm up authenticated pages", async ({ page }) => {
    setup.setTimeout(180_000); // 3 minutes for warming up multiple pages

    if (!hasTestCredentials) {
        console.log("⚠️  Skipping page warm-up: TEST_USER credentials not set");
        return;
    }

    console.log("🔥 Warming up pages with authenticated user...");

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

    // Navigate to pages as authenticated user to trigger compilation
    // This is the slow operation that was timing out in tests
    const pagesToWarmUp = [
        "/connection",
        "/ai-team",
        "/integrations",
        "/knowledge-base",
    ];

    for (const pagePath of pagesToWarmUp) {
        console.log(`  Warming up ${pagePath}...`);
        await page.goto(pagePath, { timeout: 45_000 });
        await expect(page.locator("body")).toBeVisible();
    }

    console.log("✅ Page warm-up complete");
});
