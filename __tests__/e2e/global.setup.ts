/**
 * Global Playwright Setup for Clerk Authentication
 *
 * This setup runs before all e2e tests to configure Clerk's Testing Token
 * which bypasses bot detection and allows programmatic sign-in/sign-out.
 *
 * The clerkSetup() function:
 * - Configures the testing environment for Clerk
 * - Enables the clerk.signIn() helper in tests
 * - Provides short-lived session tokens (60 seconds)
 *
 * @see https://clerk.com/docs/testing/playwright/overview
 */

import { clerkSetup } from "@clerk/testing/playwright";

export default async function globalSetup() {
    await clerkSetup();
}
