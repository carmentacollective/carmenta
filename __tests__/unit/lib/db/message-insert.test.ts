/**
 * Message Insert Error Tests
 *
 * Tests for ensuring proper error handling when inserting messages,
 * particularly around foreign key constraints and conflict handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";

setupTestDb();
import {
    upsertMessage,
    createConnection,
    deleteConnection,
} from "@/lib/db/connections";
import { users, connections, messages, messageParts } from "@/lib/db/schema";
import type { UIMessageLike } from "@/lib/db/message-mapping";

describe("Message Insert Error Handling", () => {
    let testUserId: string;
    let testConnectionId: number;

    beforeEach(async () => {
        // Create test user
        const [user] = await db
            .insert(users)
            .values({
                email: `test-${Date.now()}@example.com`,
                clerkId: `clerk_test_${Date.now()}`,
            })
            .returning();
        testUserId = user.id;

        // Create test connection
        const connection = await createConnection(testUserId);
        testConnectionId = connection.id; // Now a number (serial)
    });

    afterEach(async () => {
        // Clean up test data
        if (testConnectionId) {
            await deleteConnection(testConnectionId).catch(() => {});
        }
        if (testUserId) {
            await db
                .delete(users)
                .where(eq(users.id, testUserId))
                .catch(() => {});
        }
    });

    describe("upsertMessage", () => {
        it("should successfully insert a new message", async () => {
            const uiMessage: UIMessageLike = {
                id: `msg_test_${Date.now()}`,
                role: "user",
                parts: [{ type: "text", text: "Hello world" }],
            };

            // Should not throw
            await expect(
                upsertMessage(testConnectionId, uiMessage)
            ).resolves.not.toThrow();

            // Verify message was inserted
            const inserted = await db.query.messages.findFirst({
                where: eq(messages.id, uiMessage.id),
            });
            expect(inserted).toBeDefined();
            expect(inserted?.role).toBe("user");
        });

        it("should handle upserting the same message twice (idempotent)", async () => {
            const uiMessage: UIMessageLike = {
                id: `msg_test_${Date.now()}`,
                role: "user",
                parts: [{ type: "text", text: "Hello world" }],
            };

            // First insert
            await upsertMessage(testConnectionId, uiMessage);

            // Second insert should NOT throw (this was the bug)
            await expect(
                upsertMessage(testConnectionId, uiMessage)
            ).resolves.not.toThrow();
        });

        it("should update message parts on re-upsert", async () => {
            const messageId = `msg_test_${Date.now()}`;

            // First insert with "Hello"
            await upsertMessage(testConnectionId, {
                id: messageId,
                role: "user",
                parts: [{ type: "text", text: "Hello" }],
            });

            // Re-upsert with updated content
            await upsertMessage(testConnectionId, {
                id: messageId,
                role: "user",
                parts: [{ type: "text", text: "Hello world updated" }],
            });

            // Verify parts were updated
            const parts = await db.query.messageParts.findMany({
                where: eq(messageParts.messageId, messageId),
            });
            expect(parts).toHaveLength(1);
            expect(parts[0].textContent).toBe("Hello world updated");
        });

        it("should fail gracefully with invalid connection ID", async () => {
            const uiMessage: UIMessageLike = {
                id: `msg_test_${Date.now()}`,
                role: "user",
                parts: [{ type: "text", text: "Hello world" }],
            };

            // Using a non-existent connection ID should throw a meaningful error
            const invalidConnectionId = 999999999;

            await expect(
                upsertMessage(invalidConnectionId, uiMessage)
            ).rejects.toThrow();
        });

        it("should handle messages with nanoid-style IDs (not UUID)", async () => {
            // The AI SDK generates nanoid-style IDs like "QgGEVohpfiFhLcW3"
            // which are NOT valid UUIDs. This was causing the "Failed query" error.
            const nanoidStyleId = "QgGEVohpfiFhLcW3";

            const uiMessage: UIMessageLike = {
                id: nanoidStyleId,
                role: "user",
                parts: [{ type: "text", text: "Hello with nanoid" }],
            };

            // This should NOT throw - the schema should accept string IDs
            await expect(
                upsertMessage(testConnectionId, uiMessage)
            ).resolves.not.toThrow();
        });
    });
});
