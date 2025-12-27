import { test, expect } from "@playwright/test";

/**
 * Responsive Design and Viewport Tests
 *
 * Validates viewport configuration and responsive behavior across breakpoints.
 *
 * Tests behavior: Layout should adapt to different viewport sizes without horizontal
 * scroll, and meta tags should be configured correctly.
 */

test.describe("Viewport Configuration", () => {
    test("proper viewport meta tag is present", async ({ page }) => {
        await page.goto("/");

        const viewport = await page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveAttribute(
            "content",
            /width=device-width.*initial-scale=1/
        );
    });

    test("theme-color meta tags are present", async ({ page }) => {
        await page.goto("/");

        const themeColor = await page.locator('meta[name="theme-color"]');
        // One for light mode, one for dark mode
        await expect(themeColor).toHaveCount(2);
    });
});

test.describe("Responsive Breakpoints", () => {
    test("renders correctly on mobile viewport (375px)", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        // Should not overflow viewport width
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375);

        await expect(page.locator("body")).toBeVisible();
    });

    test("renders correctly on tablet viewport (768px)", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");

        // Should not overflow viewport width
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(768);

        await expect(page.locator("body")).toBeVisible();
    });

    test("renders correctly on desktop viewport (1440px)", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto("/");

        // Should not overflow viewport width
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(1440);

        await expect(page.locator("body")).toBeVisible();
    });

    test("handles orientation change without breaking layout", async ({ page }) => {
        // Portrait
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        const portraitWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(portraitWidth).toBeLessThanOrEqual(375);

        // Landscape
        await page.setViewportSize({ width: 667, height: 375 });

        const landscapeWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(landscapeWidth).toBeLessThanOrEqual(667);
    });

    test("no horizontal scroll on mobile viewport", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        const hasHorizontalScroll = await page.evaluate(() => {
            return (
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth
            );
        });

        expect(hasHorizontalScroll).toBe(false);
    });
});
