import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for local development (CI uses GitHub secrets)
config({ path: ".env.local" });

/**
 * Playwright configuration for E2E tests
 *
 * Uses dev server for both CI and local to enable parallel job execution.
 * The build job separately verifies production builds work.
 *
 * Uses @clerk/testing for authenticated test flows. Requires:
 * - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 * - CLERK_SECRET_KEY
 * - TEST_USER_EMAIL + TEST_USER_PASSWORD (for authenticated tests)
 */
export default defineConfig({
    testDir: "./__tests__/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    // No retries - flaky tests should fail loudly, not hide behind retries
    retries: 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",

    // Aggressive timeouts - fail fast, don't wait around
    timeout: 10_000, // 10s max per test (default is 30s)
    expect: {
        timeout: 3_000, // 3s for assertions (default is 5s)
    },

    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        trace: "retain-on-failure", // Changed from on-first-retry since retries=0
        // Navigation/action timeouts
        actionTimeout: 10_000, // 10s for clicks, fills, etc.
        navigationTimeout: 30_000, // 30s for page.goto - pages can be slow on CI
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    webServer: {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        // Explicitly pass env vars - webServer doesn't inherit by default on CI
        // See: https://github.com/microsoft/playwright/issues/19780
        env: Object.fromEntries(
            Object.entries(process.env).filter(
                (entry): entry is [string, string] => entry[1] !== undefined
            )
        ),
    },
});
