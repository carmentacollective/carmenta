import { chromium, Browser, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3002";
const TEST_EMAIL = "care@carmenta.ai";
const TEST_PASSWORD = "buildwithlove";
const SCREENSHOTS_DIR = "/tmp/title-generation-test";

async function takeScreenshot(page: Page, name: string) {
    const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filepath}`);
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    // Create screenshots directory
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
        console.log("\n🚀 Starting title generation test...\n");

        // Navigate directly to /connection which should redirect to auth or show auth form
        console.log("📍 Navigating to /connection...");
        await page.goto(`${BASE_URL}/connection`);
        await page.waitForLoadState("networkidle");
        await sleep(2000);
        await takeScreenshot(page, "01-auth-page");

        // Sign in with Clerk (multi-step)
        console.log("🔐 Step 1: Enter email...");
        const emailInput = page
            .locator('input[type="email"], input[placeholder*="email" i]')
            .first();
        await emailInput.fill(TEST_EMAIL);

        const continueButton = page.locator('button:has-text("Continue")').first();
        await continueButton.click();
        await sleep(2000);
        await page.waitForLoadState("networkidle");
        await takeScreenshot(page, "01b-password-page");

        console.log("🔐 Step 2: Enter password...");
        const passwordInput = page
            .locator('input[type="password"]')
            .filter({ hasNot: page.locator('[aria-hidden="true"]') });
        await passwordInput.waitFor({ state: "visible", timeout: 10000 });
        await passwordInput.fill(TEST_PASSWORD);

        const signInButton = page
            .locator('button:has-text("Continue"), button:has-text("Sign in")')
            .first();
        await signInButton.click();

        console.log("⏳ Waiting for authentication...");
        await page.waitForLoadState("networkidle");
        await sleep(2000);
        await takeScreenshot(page, "02-after-login");

        const currentUrl = page.url();
        console.log(`✅ Signed in. Current URL: ${currentUrl}`);

        // Start a new connection
        console.log("\n📝 TEST 1: Title Generation on First Message\n");
        console.log("🔍 Looking for new connection button...");

        // Try different selectors for new connection
        const newConnectionButton = page
            .locator(
                'button:has-text("New connection"), a:has-text("New connection"), button:has-text("New"), [data-testid="new-connection"]'
            )
            .first();

        await newConnectionButton.click();
        await page.waitForLoadState("networkidle");
        await sleep(1000);

        const newConnectionUrl = page.url();
        console.log(`📍 New connection URL: ${newConnectionUrl}`);
        await takeScreenshot(page, "03-new-connection");

        // Send first message
        console.log(
            '💬 Sending first message: "Help me plan a trip to Paris next month"'
        );
        const chatInput = page.locator('textarea, input[type="text"]').last();
        await chatInput.fill("Help me plan a trip to Paris next month");

        // Find and click send button
        const sendButton = page
            .locator('button[type="submit"], button:has-text("Send")')
            .last();
        await sendButton.click();

        console.log("⏳ Waiting for response and title generation...");
        await sleep(5000); // Wait for AI response
        await page.waitForLoadState("networkidle");

        const urlAfterFirstMessage = page.url();
        const titleAfterFirstMessage = await page.title();

        console.log("\n📊 RESULTS - Test 1:\n");
        console.log(`  URL before: ${newConnectionUrl}`);
        console.log(`  URL after:  ${urlAfterFirstMessage}`);
        console.log(`  Page title: ${titleAfterFirstMessage}`);

        // Check if URL changed to slug format
        const hasSlug = /\/connection\/[^\/]+\/[^\/]+/.test(urlAfterFirstMessage);
        const urlChanged = urlAfterFirstMessage !== newConnectionUrl;

        console.log(`  URL changed: ${urlChanged ? "✅" : "❌"}`);
        console.log(`  Has slug format: ${hasSlug ? "✅" : "❌"}`);

        await takeScreenshot(page, "04-after-first-message");

        // Extract visible title from UI if present
        const visibleTitle = await page
            .locator('h1, h2, [data-testid="connection-title"]')
            .first()
            .textContent()
            .catch(() => null);
        if (visibleTitle) {
            console.log(`  Visible title in UI: "${visibleTitle}"`);
        }

        // Wait a bit before second message
        await sleep(2000);

        // Send second message
        console.log("\n📝 TEST 2: Title Evolution on Second Message\n");
        console.log(
            '💬 Sending second message: "Actually, let\'s focus on the best restaurants there"'
        );

        await chatInput.fill("Actually, let's focus on the best restaurants there");
        await sendButton.click();

        console.log("⏳ Waiting for response and potential title evolution...");
        await sleep(5000);
        await page.waitForLoadState("networkidle");

        const urlAfterSecondMessage = page.url();
        const titleAfterSecondMessage = await page.title();

        console.log("\n📊 RESULTS - Test 2:\n");
        console.log(`  URL after first:  ${urlAfterFirstMessage}`);
        console.log(`  URL after second: ${urlAfterSecondMessage}`);
        console.log(`  Page title after first:  ${titleAfterFirstMessage}`);
        console.log(`  Page title after second: ${titleAfterSecondMessage}`);

        const titleEvolved = titleAfterSecondMessage !== titleAfterFirstMessage;
        const slugEvolved = urlAfterSecondMessage !== urlAfterFirstMessage;

        console.log(`  Title evolved: ${titleEvolved ? "✅" : "❌"}`);
        console.log(`  URL slug evolved: ${slugEvolved ? "✅" : "❌"}`);

        await takeScreenshot(page, "05-after-second-message");

        // Check browser console for errors
        console.log("\n🔍 Checking browser console...");
        const logs: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                logs.push(`ERROR: ${msg.text()}`);
            }
        });

        if (logs.length > 0) {
            console.log("⚠️  Console errors found:");
            logs.forEach((log) => console.log(`  ${log}`));
        } else {
            console.log("✅ No console errors detected");
        }

        console.log("\n✨ Test complete! Screenshots saved to:", SCREENSHOTS_DIR);
    } catch (error) {
        console.error("\n❌ Test failed with error:", error);
        await takeScreenshot(page, "99-error-state");
        throw error;
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
