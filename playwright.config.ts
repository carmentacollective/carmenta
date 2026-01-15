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
    // 1 retry on CI for infrastructure flakiness (browser crashes, network blips)
    // Local stays at 0 - flaky tests should fail loudly during development
    retries: process.env.CI ? 1 : 0,
    // Parallel execution - tests are stateless page loads, no shared DB writes
    workers: process.env.CI ? 4 : undefined,
    reporter: "html",

    // Timeouts optimized for CI (cold start) and local (warm cache)
    // Cold start can be slow, but once warm, pages should be fast
    timeout: 60_000, // 60s per test - SSR pages with auth can be slow
    expect: {
        timeout: 5_000, // 5s for assertions - should be instant
    },

    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        trace: "retain-on-failure", // Captures traces for debugging failed tests
        // Navigation/action timeouts
        actionTimeout: 5_000, // 5s for clicks, fills - should be instant
        navigationTimeout: 45_000, // 45s for page.goto - SSR pages can be slow
    },

    projects: [
        // Global setup initializes Clerk testing token
        {
            name: "setup",
            testMatch: /global\.setup\.ts/,
        },
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
            dependencies: ["setup"],
        },
    ],

    webServer: {
        // Use webpack instead of turbopack for E2E tests
        // Turbopack has tree-shaking issues with Zod v4 that cause
        // "ReferenceError: _check is not defined" errors
        // See: https://github.com/colinhacks/zod/issues/5095
        command: "pnpm next dev --webpack",
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
