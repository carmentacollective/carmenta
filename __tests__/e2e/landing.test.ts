import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
    test("displays the greeting heading", async ({ page }) => {
        await page.goto("/");
        // Greeting component shows time-based greeting (Good morning/afternoon/evening)
        const heading = page.getByRole("heading", { level: 1 });
        await expect(heading).toBeVisible();
        await expect(heading).toHaveText(/Good (morning|afternoon|evening)/);
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
        const connectLink = page.getByRole("link", { name: /connect/i });
        await expect(connectLink).toBeVisible();
        await expect(connectLink).toHaveAttribute("href", "/connect");
    });

    test("shows milestone indicator", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("M0: Stake in the Ground")).toBeVisible();
    });
});
