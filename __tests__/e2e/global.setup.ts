import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

/**
 * Global Setup for Clerk Testing
 *
 * Initializes Clerk testing token before the test suite runs.
 * This token allows tests to bypass Clerk's bot detection and
 * enables authenticated test flows.
 *
 * Required environment variables:
 * - CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
 * - CLERK_SECRET_KEY
 *
 * Graceful degradation: Setup is skipped if Clerk keys are not configured.
 * This allows fork PRs and contributors without secrets to run other E2E tests.
 */

const hasClerkKeys =
    (process.env.CLERK_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    process.env.CLERK_SECRET_KEY;

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
