import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
    test("displays the greeting heading", async ({ page }) => {
        await page.goto("/");
        // Greeting component renders an h1 (content varies by auth state)
        const heading = page.getByRole("heading", { level: 1 });
        await expect(heading).toBeVisible();
    });

    test("displays the value proposition", async ({ page }) => {
        await page.goto("/");
        await expect(
            page.getByText("AI that remembers. Voice that works. Interfaces that fit.")
        ).toBeVisible();
    });

    test("has a link to GitHub in footer", async ({ page }) => {
        await page.goto("/");
        // GitHub link is in footer with text "Source"
        const githubLink = page.getByRole("link", { name: /source/i });
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

    test("shows the vision section", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "The Vision" })).toBeVisible();
    });

    test("shows the philosophy section", async ({ page }) => {
        await page.goto("/");
        await expect(
            page.getByRole("heading", { name: "The Philosophy" })
        ).toBeVisible();
    });

    test("has a connect link in header", async ({ page }) => {
        await page.goto("/");
        const connectLink = page.getByRole("link", { name: /connect/i }).first();
        await expect(connectLink).toBeVisible();
        await expect(connectLink).toHaveAttribute("href", "/connection/new");
    });

    test("shows milestone indicator", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("M0: Stake in the Ground")).toBeVisible();
    });
});
