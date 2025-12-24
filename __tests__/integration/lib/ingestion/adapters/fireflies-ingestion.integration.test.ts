/**
 * Integration tests for Fireflies Ingestion Adapter
 *
 * These tests make actual API calls to Fireflies.ai and are skipped unless FIREFLIES_API_KEY is set.
 * To run: FIREFLIES_API_KEY=your_key_here pnpm test fireflies-ingestion.integration
 *
 * Note: Fireflies uses a GraphQL API. Free plan has 50 calls/day limit.
 * Tests are designed to be conservative with API calls.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { FirefliesAdapter } from "@/lib/ingestion/adapters/fireflies";
import {
    createTestUser,
    createTestApiKeyIntegration,
} from "@/__tests__/fixtures/integration-fixtures";

// Skip these tests unless FIREFLIES_API_KEY environment variable is set
const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;
const describeIf = FIREFLIES_API_KEY ? describe : describe.skip;

setupTestDb();

describeIf("FirefliesAdapter (Ingestion) - Real API Integration", () => {
    let adapter: FirefliesAdapter;
    const testUserEmail = "fireflies-ingestion-test@carmenta.ai";
    const apiKey = FIREFLIES_API_KEY as string;

    beforeEach(async () => {
        adapter = new FirefliesAdapter();

        // Create test user and integration with real API key
        const user = await createTestUser({ email: testUserEmail });
        await createTestApiKeyIntegration(user.email, "fireflies", apiKey, {
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
        it("fetches transcripts from Fireflies API", async () => {
            // Use recent date to limit results (faster)
            const since = new Date();
            since.setDate(since.getDate() - 30); // Last 30 days

            const rawContents = await adapter.fetchNewContent(testUserEmail, since);

            // Should return an array (may be empty if no transcripts)
            expect(Array.isArray(rawContents)).toBe(true);

            // If there are results, verify structure
            if (rawContents.length > 0) {
                const firstContent = rawContents[0];
                expect(firstContent).toHaveProperty("content");
                expect(firstContent).toHaveProperty("sourceType", "fireflies");
                expect(firstContent).toHaveProperty("sourceId");
                expect(firstContent).toHaveProperty("timestamp");
                expect(firstContent.timestamp).toBeInstanceOf(Date);

                // Verify metadata
                expect(firstContent.metadata).toBeDefined();
                expect(firstContent.metadata).toHaveProperty("title");
                expect(firstContent.metadata).toHaveProperty("duration");

                // Content should be well-structured markdown
                expect(firstContent.content).toContain("# Meeting:");
            }
        }, 60000); // Longer timeout for API calls

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

        it("returns empty array when user has no Fireflies connection", async () => {
            // Create a user without Fireflies connected
            const noConnectionEmail = "no-fireflies-connection@test.com";
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
            const otherUserEmail = "other-user-fireflies@test.com";
            const otherUser = await createTestUser({ email: otherUserEmail });
            await createTestApiKeyIntegration(otherUser.email, "fireflies", apiKey, {
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
        it("produces well-structured RawContent with meeting metadata", async () => {
            // Use recent date to limit API calls
            const since = new Date();
            since.setDate(since.getDate() - 30);

            const rawContents = await adapter.fetchNewContent(testUserEmail, since);

            if (rawContents.length === 0) {
                // Skip if no transcripts available
                console.log(
                    "No transcripts available - skipping content structure test"
                );
                return;
            }

            const content = rawContents[0];

            // Verify content structure - header should always be present
            expect(content.content).toContain("# Meeting:");
            expect(content.content).toContain("Date:");
            expect(content.content).toContain("Duration:");

            // Should have some content section (summary, transcript, action items, or topics)
            const hasSummary = content.content.includes("## Summary");
            const hasTranscript = content.content.includes("## Transcript");
            const hasActionItems = content.content.includes("## Action Items");
            const hasTopics = content.content.includes("## Topics");
            expect(hasSummary || hasTranscript || hasActionItems || hasTopics).toBe(
                true
            );

            // Metadata should be populated
            expect(content.metadata).toHaveProperty("title");
            expect(typeof content.metadata?.title).toBe("string");
        }, 60000);
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
                        eq(schema.integrations.service, "fireflies")
                    )
                );

            const rawContents = await adapter.fetchNewContent(testUserEmail);
            expect(rawContents).toEqual([]);
        });
    });
});

// Unit tests that don't require API key
describe("FirefliesAdapter (Ingestion) - Unit Tests", () => {
    let adapter: FirefliesAdapter;

    beforeEach(() => {
        adapter = new FirefliesAdapter();
    });

    it("has correct serviceId", () => {
        expect(adapter.serviceId).toBe("fireflies");
    });

    it("transformContent returns empty array (transformation happens in evaluation)", async () => {
        const result = await adapter.transformContent({
            content: "test content",
            sourceType: "fireflies",
            timestamp: new Date(),
        });
        expect(result).toEqual([]);
    });
});
