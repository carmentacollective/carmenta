import { test, expect } from "@playwright/test";

/**
 * Auth Route Guards Tests
 *
 * Verifies that protected routes properly redirect unauthenticated users to sign-in.
 * These tests validate authorization behavior, not content.
 *
 * Tests behavior: routes requiring auth should redirect to sign-in when accessed anonymously.
 */

test.describe("Protected Route Guards", () => {
    test("/connection redirects to sign-in when not authenticated", async ({
        page,
    }) => {
        await page.goto("/connection");

        // Should redirect to sign-in (Clerk handles this)
        // Uses global navigationTimeout (5s) - redirects should be fast
        await page.waitForURL(/sign-in/);
        expect(page.url()).toContain("sign-in");
    });

    test("/connection?new redirects to sign-in when not authenticated", async ({
        page,
    }) => {
        await page.goto("/connection?new");
        await page.waitForURL(/sign-in/);
        expect(page.url()).toContain("sign-in");
    });

    test("/connection/[slug] redirects to sign-in when not authenticated", async ({
        page,
    }) => {
        await page.goto("/connection/some-random-slug");
        await page.waitForURL(/sign-in/);
        expect(page.url()).toContain("sign-in");
    });

    test("/knowledge-base redirects to sign-in when not authenticated", async ({
        page,
    }) => {
        await page.goto("/knowledge-base");
        await page.waitForURL(/sign-in/);
        expect(page.url()).toContain("sign-in");
    });
});

test.describe("Navigation to Protected Routes", () => {
    test("clicking Connect link triggers auth redirect when not authenticated", async ({
        page,
    }) => {
        await page.goto("/");

        const connectLink = page.getByRole("link", { name: /connect/i }).first();
        await connectLink.click();

        // Should redirect to sign-in when unauthenticated
        await page.waitForURL(/sign-in/);
        expect(page.url()).toContain("sign-in");
    });
});
