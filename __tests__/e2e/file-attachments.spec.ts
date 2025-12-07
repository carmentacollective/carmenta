import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("File Attachments", () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        await page.goto("http://localhost:3001/connection");

        // Wait for the composer to be visible
        await page.waitForSelector('[data-testid="composer-input"]');
    });

    test("should upload file via file picker", async ({ page }) => {
        // Click the file picker button (paperclip icon)
        await page.click("button:has(svg)"); // Find button with SVG (paperclip)

        // Create a test image file
        const testImagePath = path.join(__dirname, "../fixtures/test-image.png");

        // Upload the file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testImagePath);

        // Wait for upload progress to appear
        await expect(page.locator("text=/Uploading|Complete/")).toBeVisible({
            timeout: 10000,
        });

        // Type a message
        await page.fill('[data-testid="composer-input"]', "What is in this image?");

        // Send the message
        await page.click('[data-testid="send-button"]');

        // Verify the message was sent with the file
        await expect(page.locator(".user-message-bubble")).toBeVisible({
            timeout: 5000,
        });

        // Check if file preview appears in the message
        await expect(page.locator('img[alt*="test"]')).toBeVisible({ timeout: 5000 });
    });

    test("should upload file via drag and drop", async ({ page }) => {
        const testImagePath = path.join(__dirname, "../fixtures/test-image.png");

        // Create a data transfer object
        const dataTransfer = await page.evaluateHandle((filePath) => {
            const dt = new DataTransfer();
            // Note: In real Playwright, we'd use actual file data
            // This is a simplified version
            return dt;
        }, testImagePath);

        // Drag file onto composer
        const composer = page.locator('[data-testid="composer-input"]');
        await composer.dispatchEvent("drop", { dataTransfer });

        // Wait for upload to complete
        await expect(page.locator("text=/Complete/")).toBeVisible({ timeout: 10000 });
    });

    test("should show upload progress", async ({ page }) => {
        // Click file picker
        await page.click("button:has(svg)");

        const testImagePath = path.join(__dirname, "../fixtures/test-image.png");
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testImagePath);

        // Check for progress indicator
        await expect(page.locator("text=/Uploading/")).toBeVisible({ timeout: 2000 });

        // Wait for completion
        await expect(page.locator("text=/Complete/")).toBeVisible({ timeout: 10000 });
    });

    test("should handle multiple file uploads", async ({ page }) => {
        await page.click("button:has(svg)");

        const files = [
            path.join(__dirname, "../fixtures/test-image.png"),
            path.join(__dirname, "../fixtures/test-image-2.png"),
        ];

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(files);

        // Should show multiple upload progress indicators
        const progressItems = page.locator('[data-testid="upload-item"]');
        await expect(progressItems).toHaveCount(2, { timeout: 5000 });
    });

    test("should clear files after successful send", async ({ page }) => {
        // Upload a file
        await page.click("button:has(svg)");
        const testImagePath = path.join(__dirname, "../fixtures/test-image.png");
        await page.locator('input[type="file"]').setInputFiles(testImagePath);

        // Wait for upload to complete
        await expect(page.locator("text=/Complete/")).toBeVisible({ timeout: 10000 });

        // Type and send message
        await page.fill('[data-testid="composer-input"]', "Test message");
        await page.click('[data-testid="send-button"]');

        // Upload progress should disappear after send
        await expect(page.locator("text=/Complete/")).not.toBeVisible({
            timeout: 5000,
        });
    });
});
