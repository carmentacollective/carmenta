import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E tests
 *
 * Tests public routes and auth redirects. No authentication required.
 * Authenticated functionality is tested via unit tests with mocked Clerk.
 */
export default defineConfig({
    testDir: "./__tests__/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",

    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        trace: "on-first-retry",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    // Run dev server before starting tests
    webServer: {
        command: "bun dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
