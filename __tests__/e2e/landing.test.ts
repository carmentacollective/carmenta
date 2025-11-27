import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
    test("displays the main heading", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carmenta");
    });

    test("displays the tagline", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("The best interface to AI")).toBeVisible();
    });

    test("has a link to GitHub", async ({ page }) => {
        await page.goto("/");
        const githubLink = page.getByRole("link", { name: /github/i });
        await expect(githubLink).toBeVisible();
        await expect(githubLink).toHaveAttribute(
            "href",
            "https://github.com/carmentacollective/carmenta"
        );
    });

    test("has proper page title", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Carmenta/);
    });
});
