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
// Path to cached auth state - shared across all authenticated tests
const AUTH_STATE_PATH = "./__tests__/e2e/.auth/user.json";

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

    // Timeouts reduced - auth caching eliminates login overhead
    // Tests should be fast once initial setup is complete
    timeout: 30_000, // 30s per test (down from 60s)
    expect: {
        timeout: 5_000, // 5s for assertions - should be instant
    },

    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        trace: "retain-on-failure", // Captures traces for debugging failed tests
        // Navigation/action timeouts - reduced for faster feedback
        actionTimeout: 5_000, // 5s for clicks, fills - should be instant
        navigationTimeout: 30_000, // 30s for page.goto (down from 45s)
    },

    projects: [
        // Auth setup - creates cached auth state for all authenticated tests
        // This runs once, then all tests reuse the saved session
        {
            name: "setup",
            testMatch: /seed\.spec\.ts/,
        },
        // Unauthenticated tests - legacy *.test.ts files (smoke tests, public pages, etc.)
        // These do NOT require cached auth state
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /\.test\.ts$/, // Only legacy test files
            testIgnore: [/seed\.spec\.ts/, /global\.setup\.ts/],
            dependencies: ["setup"],
        },
        // Authenticated tests - new *.spec.ts files that use cached auth state
        // These REQUIRE authentication via storageState
        {
            name: "chromium-authenticated",
            use: {
                ...devices["Desktop Chrome"],
                // Load cached auth state - skips login entirely
                storageState: AUTH_STATE_PATH,
            },
            testMatch: /\.spec\.ts$/, // Only new spec files
            testIgnore: /seed\.spec\.ts/, // Exclude setup
            dependencies: ["setup"],
        },
    ],

    // WebServer management:
    // - If BASE_URL is set, assume server is already running (skip webServer entirely)
    // - Otherwise, start dev server on port 3000
    // This handles multi-repo workflows where different servers run on different ports
    ...(process.env.BASE_URL
        ? {} // Skip webServer when BASE_URL is explicitly set
        : {
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
          }),
});
