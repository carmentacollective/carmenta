/**
 * Knowledge Librarian Tools Tests
 *
 * Tests each tool in isolation against a test database.
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb } from "@/lib/kb";
import {
    listKnowledgeTool,
    readDocumentTool,
    createDocumentTool,
    updateDocumentTool,
    appendToDocumentTool,
    moveDocumentTool,
    notifyUserTool,
} from "@/lib/ai-team/librarian/tools";
import type {
    ListKnowledgeOutput,
    ReadDocumentOutput,
    CreateDocumentOutput,
    UpdateDocumentOutput,
    AppendToDocumentOutput,
    MoveDocumentOutput,
    NotifyUserOutput,
} from "@/lib/ai-team/librarian/types";

// Enable database for these tests
setupTestDb();

// Helper to create a test user
const uuid = () => crypto.randomUUID();

async function createTestUser(email = `test-${uuid()}@example.com`) {
    const [user] = await db
        .insert(schema.users)
        .values({
            email,
            clerkId: `clerk_${uuid()}`,
            firstName: "Test",
            lastName: "User",
        })
        .returning();
    return user;
}

/**
 * Helper to call tool execute
 * AI SDK tools have execute?: (params, context) => Output | AsyncIterable<Output>
 * For our tools, we know execute exists and returns Output (not AsyncIterable)
 * Using 'any' to simplify test typing - the runtime behavior is what matters
 */

async function executeTool<TOutput>(tool: any, params: unknown): Promise<TOutput> {
    if (!tool.execute) {
        throw new Error("Tool has no execute function");
    }
    return tool.execute(params, {}) as Promise<TOutput>;
}

describe("Knowledge Librarian Tools", () => {
    describe("listKnowledgeTool", () => {
        it("should list all documents for a user", async () => {
            const user = await createTestUser();

            await kb.create(user.id, {
                path: "knowledge.identity",
                name: "Who I Am",
                content: "Name: Test User",
            });
            await kb.create(user.id, {
                path: "knowledge.people.Sarah",
                name: "Sarah",
                content: "Close friend from college",
                description: "Friend relationship",
            });

            const result = await executeTool<ListKnowledgeOutput>(listKnowledgeTool, {
                userId: user.id,
            });

            expect(result.documents).toHaveLength(2);
            expect(result.documents[0]).toMatchObject({
                path: "knowledge.identity",
                name: "Who I Am",
                content: "Name: Test User",
            });
            expect(result.documents[1]).toMatchObject({
                path: "knowledge.people.Sarah",
                name: "Sarah",
                content: "Close friend from college",
                description: "Friend relationship",
            });
        });

        it("should return empty array for user with no documents", async () => {
            const user = await createTestUser();

            const result = await executeTool<ListKnowledgeOutput>(listKnowledgeTool, {
                userId: user.id,
            });

            expect(result.documents).toEqual([]);
        });
    });

    describe("readDocumentTool", () => {
        it("should read an existing document", async () => {
            const user = await createTestUser();

            await kb.create(user.id, {
                path: "knowledge.identity",
                name: "Who I Am",
                content: "Name: Test User\nRole: Engineer",
                description: "Core identity facts",
            });

            const result = await executeTool<ReadDocumentOutput>(readDocumentTool, {
                userId: user.id,
                path: "knowledge.identity",
            });

            expect(result.found).toBe(true);
            expect(result.document).toMatchObject({
                path: "knowledge.identity",
                name: "Who I Am",
                content: "Name: Test User\nRole: Engineer",
                description: "Core identity facts",
            });
        });

        it("should return not found for non-existent document", async () => {
            const user = await createTestUser();

            const result = await executeTool<ReadDocumentOutput>(readDocumentTool, {
                userId: user.id,
                path: "knowledge.nonexistent",
            });

            expect(result.found).toBe(false);
            expect(result.document).toBeUndefined();
        });
    });

    describe("createDocumentTool", () => {
        it("should create a new document", async () => {
            const user = await createTestUser();

            const result = await executeTool<CreateDocumentOutput>(createDocumentTool, {
                userId: user.id,
                path: "knowledge.projects.carmenta",
                name: "Carmenta Project",
                content: "Heart-centered AI interface for builders",
                description: "Main project context",
            });

            expect(result.success).toBe(true);
            expect(result.path).toBe("knowledge.projects.carmenta");
            expect(result.message).toContain("Created document");

            // Verify document was created
            const doc = await kb.read(user.id, "knowledge.projects.carmenta");
            expect(doc).toBeTruthy();
            expect(doc?.name).toBe("Carmenta Project");
            expect(doc?.content).toBe("Heart-centered AI interface for builders");
        });

        it("should handle creation errors gracefully", async () => {
            const user = await createTestUser();

            // Try to create with invalid path (contains disallowed characters)
            const result = await executeTool<CreateDocumentOutput>(createDocumentTool, {
                userId: user.id,
                path: "knowledge%invalid%path", // % not allowed in paths
                name: "Invalid",
                content: "Test",
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain("Failed to create document");
        });
    });

    describe("updateDocumentTool", () => {
        it("should update an existing document", async () => {
            const user = await createTestUser();

            await kb.create(user.id, {
                path: "knowledge.identity",
                name: "Who I Am",
                content: "Original content",
            });

            const result = await executeTool<UpdateDocumentOutput>(updateDocumentTool, {
                userId: user.id,
                path: "knowledge.identity",
                content: "Updated content with new details",
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Updated document");

            // Verify update
            const doc = await kb.read(user.id, "knowledge.identity");
            expect(doc?.content).toBe("Updated content with new details");
        });

        it("should return failure for non-existent document", async () => {
            const user = await createTestUser();

            const result = await executeTool<UpdateDocumentOutput>(updateDocumentTool, {
                userId: user.id,
                path: "knowledge.nonexistent",
                content: "New content",
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain("not found");
        });
    });

    describe("appendToDocumentTool", () => {
        it("should append content to an existing document", async () => {
            const user = await createTestUser();

            await kb.create(user.id, {
                path: "knowledge.people.Sarah",
                name: "Sarah",
                content: "Met at college in 2010",
            });

            const result = await executeTool<AppendToDocumentOutput>(
                appendToDocumentTool,
                {
                    userId: user.id,
                    path: "knowledge.people.Sarah",
                    content: "Now works as a software engineer at Google",
                }
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain("Appended content");

            // Verify append
            const doc = await kb.read(user.id, "knowledge.people.Sarah");
            expect(doc?.content).toBe(
                "Met at college in 2010\n\nNow works as a software engineer at Google"
            );
        });

        it("should return failure for non-existent document", async () => {
            const user = await createTestUser();

            const result = await executeTool<AppendToDocumentOutput>(
                appendToDocumentTool,
                {
                    userId: user.id,
                    path: "knowledge.nonexistent",
                    content: "New content",
                }
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain("not found");
        });
    });

    describe("moveDocumentTool", () => {
        it("should move a document to a new path", async () => {
            const user = await createTestUser();

            await kb.create(user.id, {
                path: "knowledge.old-path",
                name: "Document",
                content: "Content to move",
                description: "Test description",
            });

            const result = await executeTool<MoveDocumentOutput>(moveDocumentTool, {
                userId: user.id,
                fromPath: "knowledge.old-path",
                toPath: "knowledge.new-path",
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Moved document");

            // Verify old path is gone
            const oldDoc = await kb.read(user.id, "knowledge.old-path");
            expect(oldDoc).toBeNull();

            // Verify new path exists with same content
            const newDoc = await kb.read(user.id, "knowledge.new-path");
            expect(newDoc).toBeTruthy();
            expect(newDoc?.name).toBe("Document");
            expect(newDoc?.content).toBe("Content to move");
            expect(newDoc?.description).toBe("Test description");
        });

        it("should return failure for non-existent source document", async () => {
            const user = await createTestUser();

            const result = await executeTool<MoveDocumentOutput>(moveDocumentTool, {
                userId: user.id,
                fromPath: "knowledge.nonexistent",
                toPath: "knowledge.new-path",
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain("not found");
        });

        it("should return failure when destination path is occupied", async () => {
            const user = await createTestUser();

            // Create source document
            await kb.create(user.id, {
                path: "knowledge.source",
                name: "Source Doc",
                content: "Source content",
            });

            // Create document at destination
            await kb.create(user.id, {
                path: "knowledge.destination",
                name: "Existing Doc",
                content: "Existing content",
            });

            const result = await executeTool<MoveDocumentOutput>(moveDocumentTool, {
                userId: user.id,
                fromPath: "knowledge.source",
                toPath: "knowledge.destination",
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain("already exists");

            // Verify neither document was affected
            const source = await kb.read(user.id, "knowledge.source");
            expect(source?.content).toBe("Source content");

            const dest = await kb.read(user.id, "knowledge.destination");
            expect(dest?.content).toBe("Existing content");
        });

        it("should handle move errors gracefully", async () => {
            const user = await createTestUser();

            await kb.create(user.id, {
                path: "knowledge.source",
                name: "Source",
                content: "Content",
            });

            // Try to move to invalid path
            const result = await executeTool<MoveDocumentOutput>(moveDocumentTool, {
                userId: user.id,
                fromPath: "knowledge.source",
                toPath: "invalid%path%format", // % not allowed in paths
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain("Failed to move document");
        });
    });

    describe("notifyUserTool", () => {
        it("should queue a notification", async () => {
            const user = await createTestUser();

            const result = await executeTool<NotifyUserOutput>(notifyUserTool, {
                userId: user.id,
                message: "Important update about your knowledge base",
            });

            expect(result.success).toBe(true);
            expect(result.message).toBe("Notification queued");

            // Verify notification was created in DB
            const notifications = await db.query.notifications.findMany({
                where: (n, { eq }) => eq(n.userId, user.id),
            });
            expect(notifications).toHaveLength(1);
            expect(notifications[0].message).toBe(
                "Important update about your knowledge base"
            );
            expect(notifications[0].type).toBe("insight");
            expect(notifications[0].read).toBe(false);
        });

        it("should handle any message content", async () => {
            const user = await createTestUser();

            const result = await executeTool<NotifyUserOutput>(notifyUserTool, {
                userId: user.id,
                message: "Complex message with\nnewlines and special chars: @#$%",
            });

            expect(result.success).toBe(true);
        });

        it("should include document path if provided", async () => {
            const user = await createTestUser();

            const result = await executeTool<NotifyUserOutput>(notifyUserTool, {
                userId: user.id,
                message: "Document created",
                documentPath: "knowledge.people.Sarah",
            });

            expect(result.success).toBe(true);

            // Verify document path was saved
            const notifications = await db.query.notifications.findMany({
                where: (n, { eq }) => eq(n.userId, user.id),
            });
            expect(notifications[0].documentPath).toBe("knowledge.people.Sarah");
        });
    });
});
