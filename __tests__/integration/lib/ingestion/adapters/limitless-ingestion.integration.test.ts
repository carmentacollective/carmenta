/**
 * Integration tests for Limitless Ingestion Adapter
 *
 * These tests make actual API calls to Limitless and are skipped unless LIMITLESS_API_KEY is set.
 * To run: LIMITLESS_API_KEY=your_key_here pnpm test limitless-ingestion.integration
 *
 * Tests are designed to be conservative with API calls and protect real user data.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { LimitlessAdapter } from "@/lib/ingestion/adapters/limitless";
import {
    createTestUser,
    createTestApiKeyIntegration,
} from "@/__tests__/fixtures/integration-fixtures";

// Skip these tests unless LIMITLESS_API_KEY environment variable is set
const LIMITLESS_API_KEY = process.env.LIMITLESS_API_KEY;
const describeIf = LIMITLESS_API_KEY ? describe : describe.skip;

setupTestDb();

describeIf("LimitlessAdapter (Ingestion) - Real API Integration", () => {
    let adapter: LimitlessAdapter;
    const testUserEmail = "limitless-ingestion-test@carmenta.ai";
    const apiKey = LIMITLESS_API_KEY as string;

    beforeEach(async () => {
        adapter = new LimitlessAdapter();

        // Create test user and integration with real API key
        const user = await createTestUser({ email: testUserEmail });
        await createTestApiKeyIntegration(user.email, "limitless", apiKey, {
            accountId: "test-account",
            isDefault: true,
        });
    });

    afterEach(async () => {
        // Clean up test data
        await db
            .delete(schema.integrations)
            .where(eq(schema.integrations.userEmail, testUserEmail));
        await db.delete(schema.users).where(eq(schema.users.email, testUserEmail));
    });

    describe("fetchNewContent", () => {
        it("fetches recordings from Limitless API", async () => {
            // Use recent date to limit results (faster)
            const since = new Date();
            since.setDate(since.getDate() - 14); // Last 14 days

            const rawContents = await adapter.fetchNewContent(testUserEmail, since);

            // Should return an array (may be empty if no recordings)
            expect(Array.isArray(rawContents)).toBe(true);

            // If there are results, verify structure
            if (rawContents.length > 0) {
                const firstContent = rawContents[0];
                expect(firstContent).toHaveProperty("content");
                expect(firstContent).toHaveProperty("sourceType", "limitless");
                expect(firstContent).toHaveProperty("sourceId");
                expect(firstContent).toHaveProperty("timestamp");
                expect(firstContent.timestamp).toBeInstanceOf(Date);

                // Verify metadata
                expect(firstContent.metadata).toBeDefined();
                expect(firstContent.metadata).toHaveProperty("duration");
                expect(firstContent.metadata).toHaveProperty("startedAt");
                expect(firstContent.metadata).toHaveProperty("endedAt");

                // Content should be well-structured markdown
                expect(firstContent.content).toContain("# Recording:");
            }
        }, 90000); // Longer timeout for API calls

        it("supports incremental sync with since parameter", async () => {
            // Use a recent date to limit results
            const since = new Date();
            since.setDate(since.getDate() - 7); // Last 7 days

            const rawContents = await adapter.fetchNewContent(testUserEmail, since);

            // Should return an array
            expect(Array.isArray(rawContents)).toBe(true);

            // All returned items should be after the since date
            for (const content of rawContents) {
                expect(content.timestamp.getTime()).toBeGreaterThan(since.getTime());
            }
        }, 30000);

        it("returns empty array when user has no Limitless connection", async () => {
            // Create a user without Limitless connected
            const noConnectionEmail = "no-limitless-connection@test.com";
            await createTestUser({ email: noConnectionEmail });

            const rawContents = await adapter.fetchNewContent(noConnectionEmail);

            expect(rawContents).toEqual([]);

            // Cleanup
            await db
                .delete(schema.users)
                .where(eq(schema.users.email, noConnectionEmail));
        });
    });

    describe("sync state tracking", () => {
        it("getLastSyncTime returns null for fresh integration", async () => {
            const lastSync = await adapter.getLastSyncTime(testUserEmail);
            expect(lastSync).toBeNull();
        });

        it("updateSyncTime persists and retrieves correctly", async () => {
            const syncTime = new Date("2024-12-15T10:30:00Z");

            await adapter.updateSyncTime(testUserEmail, syncTime);

            const retrieved = await adapter.getLastSyncTime(testUserEmail);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.getTime()).toBe(syncTime.getTime());
        });

        it("sync time is per-user isolated", async () => {
            const otherUserEmail = "other-user-limitless@test.com";
            const otherUser = await createTestUser({ email: otherUserEmail });
            await createTestApiKeyIntegration(otherUser.email, "limitless", apiKey, {
                accountId: "other-account",
            });

            // Set sync time for test user
            const syncTime = new Date("2024-12-15T10:30:00Z");
            await adapter.updateSyncTime(testUserEmail, syncTime);

            // Other user should still have null
            const otherLastSync = await adapter.getLastSyncTime(otherUserEmail);
            expect(otherLastSync).toBeNull();

            // Test user should have the sync time
            const testLastSync = await adapter.getLastSyncTime(testUserEmail);
            expect(testLastSync).not.toBeNull();

            // Cleanup
            await db
                .delete(schema.integrations)
                .where(eq(schema.integrations.userEmail, otherUserEmail));
            await db.delete(schema.users).where(eq(schema.users.email, otherUserEmail));
        });
    });

    describe("content transformation", () => {
        it("produces well-structured RawContent with recording metadata", async () => {
            // Use recent date to limit API calls
            const since = new Date();
            since.setDate(since.getDate() - 14);

            const rawContents = await adapter.fetchNewContent(testUserEmail, since);

            if (rawContents.length === 0) {
                // Skip if no recordings available
                console.log(
                    "No recordings available - skipping content structure test"
                );
                return;
            }

            const content = rawContents[0];

            // Verify content structure - header should always be present
            expect(content.content).toContain("# Recording:");
            expect(content.content).toContain("Date:");
            expect(content.content).toContain("Duration:");

            // Should have content or summary sections
            const hasContent = content.content.includes("## Content");
            const hasTranscript = content.content.includes("## Transcript");
            const hasSummary = content.content.includes("## Summary");
            const hasTopics = content.content.includes("## Topics Discussed");
            expect(hasContent || hasTranscript || hasSummary || hasTopics).toBe(true);

            // Metadata quality indicators should be populated
            expect(content.metadata).toHaveProperty("hasStructuredContent");
            expect(content.metadata).toHaveProperty("hasTranscript");
        }, 90000);

        it("captures topic headings when available", async () => {
            // Use recent date to limit API calls
            const since = new Date();
            since.setDate(since.getDate() - 14);

            const rawContents = await adapter.fetchNewContent(testUserEmail, since);

            if (rawContents.length === 0) {
                console.log("No recordings available - skipping headings test");
                return;
            }

            // Find a recording with headings
            const contentWithHeadings = rawContents.find(
                (c) => c.metadata?.hasHeadings === true
            );

            if (contentWithHeadings) {
                expect(contentWithHeadings.content).toContain("## Topics Discussed");
                expect(contentWithHeadings.metadata?.topics).toBeDefined();
                expect(Array.isArray(contentWithHeadings.metadata?.topics)).toBe(true);
            }
        }, 90000);
    });

    describe("error handling", () => {
        it("handles disconnected integration gracefully", async () => {
            // Update integration to disconnected status
            await db
                .update(schema.integrations)
                .set({ status: "disconnected" })
                .where(
                    and(
                        eq(schema.integrations.userEmail, testUserEmail),
                        eq(schema.integrations.service, "limitless")
                    )
                );

            const rawContents = await adapter.fetchNewContent(testUserEmail);
            expect(rawContents).toEqual([]);
        });
    });
});

// Unit tests that don't require API key
describe("LimitlessAdapter (Ingestion) - Unit Tests", () => {
    let adapter: LimitlessAdapter;

    beforeEach(() => {
        adapter = new LimitlessAdapter();
    });

    it("has correct serviceId", () => {
        expect(adapter.serviceId).toBe("limitless");
    });

    it("transformContent returns empty array (transformation happens in evaluation)", async () => {
        const result = await adapter.transformContent({
            content: "test content",
            sourceType: "limitless",
            timestamp: new Date(),
        });
        expect(result).toEqual([]);
    });
});
