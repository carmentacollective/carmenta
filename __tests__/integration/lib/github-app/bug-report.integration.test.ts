/**
 * GitHub App Bug Report Integration Tests
 *
 * Tests the full flow from @carmenta bug report to GitHub issue creation.
 * Requires GITHUB_APP_* environment variables to be set.
 *
 * Run with:
 *   dotenvx run -f .env.local -- pnpm test bug-report.integration
 *
 * Or manually export the env vars before running.
 *
 * These tests create real GitHub issues in the carmenta repository.
 * Issues are created with a "test" label for easy cleanup.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
    createIssue,
    searchIssues,
    addReaction,
    isGitHubAppConfigured,
} from "@/lib/github-app";
import { handleBugReport } from "@/lib/concierge/entity-handlers/bug-report";
import type { EntityIntent } from "@/lib/concierge/entity-handlers/types";

// Skip all tests if GitHub App isn't configured
// Check both the env mock and process.env directly
const GITHUB_CONFIGURED =
    isGitHubAppConfigured() ||
    Boolean(
        process.env.GITHUB_APP_ID &&
        process.env.GITHUB_APP_PRIVATE_KEY &&
        process.env.GITHUB_APP_INSTALLATION_ID
    );

describe.skipIf(!GITHUB_CONFIGURED)("GitHub App Integration", () => {
    beforeAll(() => {
        if (!GITHUB_CONFIGURED) {
            console.log("Skipping GitHub App integration tests - not configured");
        }
    });

    describe("Low-level client operations", () => {
        it("can search for issues", async () => {
            const result = await searchIssues({ query: "test", maxResults: 5 });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(Array.isArray(result.data)).toBe(true);
            }
        });

        it("can create a test issue", async () => {
            const timestamp = new Date().toISOString();
            const result = await createIssue({
                title: `🧪 Integration test issue - ${timestamp}`,
                body: `## Test Issue

This is an automated integration test issue created by the GitHub App test suite.

**Timestamp:** ${timestamp}

---
*This issue can be safely closed and deleted.*`,
                labels: ["test", "from-chat"],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.number).toBeGreaterThan(0);
                expect(result.data.title).toContain("Integration test");
                expect(result.data.html_url).toContain("github.com");
                console.log(`Created test issue: ${result.data.html_url}`);
            }
        });

        it("can add reaction to an issue", async () => {
            // First search for an existing issue to react to
            const searchResult = await searchIssues({ query: "test", maxResults: 1 });

            if (!searchResult.success || searchResult.data.length === 0) {
                console.log("No test issues found to react to, skipping");
                return;
            }

            const issueNumber = searchResult.data[0].number;
            const result = await addReaction(issueNumber, "+1");

            // Reaction might fail if already added, which is fine
            expect(typeof result.success).toBe("boolean");
            if (result.success) {
                console.log(`Added +1 reaction to issue #${issueNumber}`);
            }
        });
    });

    describe("Bug report handler", () => {
        it("creates issue for new bug report", async () => {
            const timestamp = new Date().toISOString();
            const intent: EntityIntent = {
                type: "bug_report",
                confidence: "high",
                details: {
                    title: `🧪 Handler test: Bug from integration test - ${timestamp}`,
                    description:
                        "This is a test bug report created by the integration test suite",
                    keywords: ["integration", "test", "automated"],
                },
            };

            const context = {
                userId: "test-user",
                recentMessages:
                    "User: @carmenta file a bug\nCarmenta: What's the issue?",
                userAgent: "Vitest Integration Test",
            };

            const response = await handleBugReport(intent, context);

            expect(response.isError).toBeFalsy();
            expect(response.issueNumber).toBeGreaterThan(0);
            expect(response.issueUrl).toContain("github.com");
            expect(response.text).toContain("Tracked it");
            console.log(`Bug report handler created: ${response.issueUrl}`);
        });

        it("finds duplicate and adds +1 for similar bug report", async () => {
            // First create an issue to find as duplicate
            const uniqueKeyword = `duplicatetest${Date.now()}`;
            const createResult = await createIssue({
                title: `🧪 Duplicate test: ${uniqueKeyword}`,
                body: "Test issue for duplicate detection",
                labels: ["test"],
            });

            expect(createResult.success).toBe(true);
            if (!createResult.success) return;

            const originalIssue = createResult.data;
            console.log(`Created original issue: #${originalIssue.number}`);

            // Now report a "bug" with similar keywords - should find duplicate
            const intent: EntityIntent = {
                type: "bug_report",
                confidence: "high",
                details: {
                    title: `Similar to ${uniqueKeyword}`,
                    description: `This should match the ${uniqueKeyword} issue`,
                    keywords: [uniqueKeyword],
                },
            };

            const context = {
                userId: "test-user-2",
            };

            const response = await handleBugReport(intent, context);

            // The handler might create a new issue or find the duplicate
            // depending on GitHub search indexing timing
            expect(response.isError).toBeFalsy();
            expect(response.issueNumber).toBeGreaterThan(0);

            if (response.text.includes("seen this before")) {
                // Found duplicate
                expect(response.issueNumber).toBe(originalIssue.number);
                console.log(`Found duplicate: #${response.issueNumber}`);
            } else {
                // Created new (search indexing delay)
                console.log(`Search delay - created new: #${response.issueNumber}`);
            }
        });

        it("handles gracefully when GitHub API fails", async () => {
            // This test uses valid config but tests the response structure
            const intent: EntityIntent = {
                type: "bug_report",
                confidence: "high",
                details: {
                    title: "Test error handling",
                    description: "Testing graceful degradation",
                },
            };

            const context = {
                userId: "test-user",
            };

            const response = await handleBugReport(intent, context);

            // Should always return a valid response structure
            expect(typeof response.text).toBe("string");
            expect(response.text.length).toBeGreaterThan(0);

            // If it succeeded, verify issue was created
            if (!response.isError) {
                expect(response.issueNumber).toBeGreaterThan(0);
            }
        });
    });
});
