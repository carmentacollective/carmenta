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
 */

setup.describe.configure({ mode: "serial" });

setup("initialize Clerk testing", async () => {
    await clerkSetup();
});
