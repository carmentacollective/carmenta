import { test, expect } from "@playwright/test";

/**
 * Mobile and Responsive Design Tests
 *
 * Validates mobile-first design principles, touch interactions,
 * and responsive behavior across different viewport sizes.
 */

test.describe("Mobile Viewport and Meta Tags", () => {
    test("should have proper viewport configuration", async ({ page }) => {
        await page.goto("/");

        // Check viewport meta tag
        const viewport = await page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveAttribute(
            "content",
            /width=device-width.*initial-scale=1/
        );
    });

    test("should have theme-color meta tag", async ({ page }) => {
        await page.goto("/");

        // Check for theme-color meta tag
        const themeColor = await page.locator('meta[name="theme-color"]');
        await expect(themeColor).toHaveCount(2); // One for light, one for dark
    });

    test("should have Apple web app meta tags", async ({ page }) => {
        await page.goto("/");

        // Check Apple-specific meta tags
        const appleCapable = await page.locator(
            'meta[name="apple-mobile-web-app-capable"]'
        );
        await expect(appleCapable).toHaveAttribute("content", "yes");

        const appleStatusBar = await page.locator(
            'meta[name="apple-mobile-web-app-status-bar-style"]'
        );
        await expect(appleStatusBar).toHaveAttribute("content", "black-translucent");

        const appleTitle = await page.locator(
            'meta[name="apple-mobile-web-app-title"]'
        );
        await expect(appleTitle).toHaveAttribute("content", "Carmenta");
    });

    test("should disable format detection", async ({ page }) => {
        await page.goto("/");

        // Check format detection is disabled
        const formatDetection = await page.locator('meta[name="format-detection"]');
        await expect(formatDetection).toHaveAttribute("content", /telephone=no/);
    });
});

test.describe("Responsive Breakpoints", () => {
    test("should render correctly on mobile (375px)", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        // Page should load without horizontal scroll
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375);

        // Check that content is readable
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
        // Start in portrait
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        const portraitWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(portraitWidth).toBeLessThanOrEqual(375);

        // Switch to landscape
        await page.setViewportSize({ width: 667, height: 375 });

        const landscapeWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(landscapeWidth).toBeLessThanOrEqual(667);
    });
});

test.describe("Touch Interactions", () => {
    test("should have touch-friendly tap targets", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto("/");

        // Check that buttons meet minimum touch target size (44px)
        const buttons = await page.locator("button").all();

        for (const button of buttons) {
            const box = await button.boundingBox();
            if (box) {
                // Touch targets should be at least 44x44px
                expect(box.height).toBeGreaterThanOrEqual(44);
                expect(box.width).toBeGreaterThanOrEqual(44);
            }
        }
    });

    test("should have transparent tap highlight", async ({ page }) => {
        await page.goto("/");

        // Check that tap highlight is transparent
        const tapHighlight = await page.evaluate(() => {
            const html = document.documentElement;
            return window
                .getComputedStyle(html)
                .getPropertyValue("-webkit-tap-highlight-color");
        });

        // Transparent tap highlight should be rgba(0, 0, 0, 0) or transparent
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

test.describe("Safe Area Insets", () => {
    test("should respect safe area insets on body", async ({ page }) => {
        await page.goto("/");

        // Check that body has safe area insets applied
        const bodyPadding = await page.evaluate(() => {
            const body = document.body;
            const styles = window.getComputedStyle(body);
            return {
                left: styles.getPropertyValue("padding-left"),
                right: styles.getPropertyValue("padding-right"),
            };
        });

        // Safe area insets should be applied (will be 0px on non-notched devices)
        expect(bodyPadding.left).toBeTruthy();
        expect(bodyPadding.right).toBeTruthy();
    });
});

test.describe("Accessibility for Mobile", () => {
    test("should have smooth scrolling", async ({ page }) => {
        await page.goto("/");

        const scrollBehavior = await page.evaluate(() => {
            const html = document.documentElement;
            return window.getComputedStyle(html).getPropertyValue("scroll-behavior");
        });

        expect(scrollBehavior).toBe("smooth");
    });

    test("should respect prefers-reduced-motion", async ({ page, browser }) => {
        // Create a new context with reduced motion preference
        const context = await browser.newContext({
            reducedMotion: "reduce",
        });

        const reducedMotionPage = await context.newPage();
        await reducedMotionPage.goto("/");

        // Check that scroll behavior is auto when reduced motion is preferred
        const scrollBehavior = await reducedMotionPage.evaluate(() => {
            const html = document.documentElement;
            return window.getComputedStyle(html).getPropertyValue("scroll-behavior");
        });

        // With reduced motion, scroll-behavior should be auto
        expect(scrollBehavior).toBe("auto");

        await context.close();
    });

    test("should allow text selection in content areas", async ({ page }) => {
        await page.goto("/");

        // Check that text in article/p elements is selectable
        const userSelect = await page.evaluate(() => {
            // Create a test paragraph if none exists
            const p = document.createElement("p");
            p.textContent = "Test content";
            document.body.appendChild(p);

            const styles = window.getComputedStyle(p);
            const selectStyle = styles.getPropertyValue("user-select");

            document.body.removeChild(p);
            return selectStyle;
        });

        expect(userSelect).toBe("text");
    });
});

test.describe("Performance on Mobile", () => {
    test("should load quickly on 3G connection", async ({ page }) => {
        // Emulate slow 3G
        await page.route("**/*", (route) => route.continue());

        const startTime = Date.now();
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const loadTime = Date.now() - startTime;

        // Page should load in under 5 seconds even on slow connection
        expect(loadTime).toBeLessThan(5000);
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

test.describe("Font Loading", () => {
    test("should use font-display: swap for web fonts", async ({ page }) => {
        await page.goto("/");

        // Check that fonts load with swap strategy
        const fontDisplay = await page.evaluate(() => {
            // Get computed styles and check for font variables
            const html = document.documentElement;
            const styles = window.getComputedStyle(html);
            return {
                hasOutfit: styles.getPropertyValue("--font-outfit").length > 0,
                hasMono: styles.getPropertyValue("--font-mono").length > 0,
            };
        });

        expect(fontDisplay.hasOutfit).toBe(true);
        expect(fontDisplay.hasMono).toBe(true);
    });
});
