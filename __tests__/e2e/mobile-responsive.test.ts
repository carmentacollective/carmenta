import { test, expect } from "@playwright/test";

/**
 * Mobile and Responsive Design Tests
 *
 * Validates viewport configuration, responsive behavior,
 * and basic mobile optimizations.
 */

test.describe("Mobile Viewport and Meta Tags", () => {
    test("should have proper viewport configuration", async ({ page }) => {
        await page.goto("/");

        const viewport = await page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveAttribute(
            "content",
            /width=device-width.*initial-scale=1/
        );
    });

    test("should have theme-color meta tag", async ({ page }) => {
        await page.goto("/");

        const themeColor = await page.locator('meta[name="theme-color"]');
        await expect(themeColor).toHaveCount(2); // One for light, one for dark
    });
});

test.describe("Responsive Breakpoints", () => {
    test("should render correctly on mobile (375px)", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375);

        await expect(page.locator("body")).toBeVisible();
    });

    test("should render correctly on tablet (768px)", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(768);

        await expect(page.locator("body")).toBeVisible();
    });

    test("should render correctly on desktop (1440px)", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto("/");

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(1440);

        await expect(page.locator("body")).toBeVisible();
    });

    test("should handle orientation change", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        const portraitWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(portraitWidth).toBeLessThanOrEqual(375);

        await page.setViewportSize({ width: 667, height: 375 });

        const landscapeWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(landscapeWidth).toBeLessThanOrEqual(667);
    });

    test("should have no horizontal scroll on mobile", async ({ page }) => {
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

test.describe("Touch Interactions", () => {
    test("should have transparent tap highlight", async ({ page }) => {
        await page.goto("/");

        const tapHighlight = await page.evaluate(() => {
            const html = document.documentElement;
            return window
                .getComputedStyle(html)
                .getPropertyValue("-webkit-tap-highlight-color");
        });

        expect(tapHighlight).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
    });

    test("should prevent text size adjustment on orientation change", async ({
        page,
    }) => {
        await page.goto("/");

        const textSizeAdjust = await page.evaluate(() => {
            const html = document.documentElement;
            return window
                .getComputedStyle(html)
                .getPropertyValue("-webkit-text-size-adjust");
        });

        expect(textSizeAdjust).toBe("100%");
    });
});

test.describe("Accessibility", () => {
    test("should have smooth scrolling", async ({ page }) => {
        await page.goto("/");

        const scrollBehavior = await page.evaluate(() => {
            const html = document.documentElement;
            return window.getComputedStyle(html).getPropertyValue("scroll-behavior");
        });

        expect(scrollBehavior).toBe("smooth");
    });
});

test.describe("Font Loading", () => {
    test("should have font CSS variables defined", async ({ page }) => {
        await page.goto("/");

        const fontVars = await page.evaluate(() => {
            const html = document.documentElement;
            const styles = window.getComputedStyle(html);
            return {
                hasOutfit: styles.getPropertyValue("--font-outfit").length > 0,
                hasMono: styles.getPropertyValue("--font-mono").length > 0,
            };
        });

        expect(fontVars.hasOutfit).toBe(true);
        expect(fontVars.hasMono).toBe(true);
    });
});
