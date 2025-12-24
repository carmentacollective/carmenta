import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for local development (CI uses GitHub secrets)
config({ path: ".env.local" });

/**
 * Playwright configuration for E2E tests
 *
 * CI runs against production build (pnpm start) to catch production-only bugs.
 * Local development uses dev server (pnpm dev) for faster iteration.
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
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",

    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        trace: "on-first-retry",
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
        // CI: Use production server with pre-built .next directory
        // Local: Use dev server for faster iteration
        command: process.env.CI ? "pnpm start" : "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
