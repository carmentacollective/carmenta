/**
 * Knowledge Base CRUD Operations Tests
 *
 * Tests cover:
 * - Document creation with various path formats
 * - Single document and folder reads
 * - Document updates and upserts (atomic operations)
 * - Document deletion
 * - Listing and existence checks
 * - Keyword search functionality
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb, toPath, toDisplayPath, PROFILE_PATHS } from "@/lib/kb/index";

setupTestDb();

// ============================================================================
// FIXTURES
// ============================================================================

const uuid = () => crypto.randomUUID();

async function createTestUser(email = "test@example.com") {
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

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

describe("KB Create Operations", () => {
    it("creates a document with normalized path", async () => {
        const user = await createTestUser();

        const doc = await kb.create(user.id, {
            path: "/profile/identity.txt",
            name: "identity.txt",
            content: "Name: Test User",
        });

        expect(doc).toMatchObject({
            userId: user.id,
            path: "profile.identity",
            name: "identity.txt",
            content: "Name: Test User",
            sourceType: "manual",
        });
        expect(doc.id).toBeDefined();
        expect(doc.createdAt).toBeInstanceOf(Date);
    });

    it("creates document with dot notation path directly", async () => {
        const user = await createTestUser();

        const doc = await kb.create(user.id, {
            path: "profile.preferences",
            name: "preferences.txt",
            content: "Communication style: Direct",
        });

        expect(doc.path).toBe("profile.preferences");
    });

    it("creates document with custom sourceType", async () => {
        const user = await createTestUser();

        const doc = await kb.create(user.id, {
            path: "notes.meeting",
            name: "meeting.txt",
            content: "Meeting notes",
            sourceType: "conversation_extraction",
            sourceId: "conv_12345",
        });

        expect(doc.sourceType).toBe("conversation_extraction");
        expect(doc.sourceId).toBe("conv_12345");
    });

    it("creates document with tags", async () => {
        const user = await createTestUser();

        const doc = await kb.create(user.id, {
            path: "profile.people.sarah",
            name: "sarah.txt",
            content: "Sarah - colleague",
            tags: ["person", "colleague"],
        });

        expect(doc.tags).toEqual(["person", "colleague"]);
    });

    it("creates documents for different users independently", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "User 1 identity",
        });

        await kb.create(user2.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "User 2 identity",
        });

        const doc1 = await kb.read(user1.id, "profile.identity");
        const doc2 = await kb.read(user2.id, "profile.identity");

        expect(doc1?.content).toBe("User 1 identity");
        expect(doc2?.content).toBe("User 2 identity");
    });
});

// ============================================================================
// READ OPERATIONS
// ============================================================================

describe("KB Read Operations", () => {
    it("reads a single document by path", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Name: Test User",
        });

        const doc = await kb.read(user.id, "profile.identity");

        expect(doc).toMatchObject({
            path: "profile.identity",
            content: "Name: Test User",
        });
    });

    it("returns null for non-existent document", async () => {
        const user = await createTestUser();

        const doc = await kb.read(user.id, "nonexistent.path");

        expect(doc).toBeNull();
    });

    it("accepts filesystem-style path for reading", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Name: Test User",
        });

        const doc = await kb.read(user.id, "/profile/identity.txt");

        expect(doc?.content).toBe("Name: Test User");
    });

    it("does not return documents from other users", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "secret.document",
            name: "document.txt",
            content: "User 1 secret",
        });

        const doc = await kb.read(user2.id, "secret.document");

        expect(doc).toBeNull();
    });
});

// ============================================================================
// READ FOLDER OPERATIONS
// ============================================================================

describe("KB ReadFolder Operations", () => {
    it("reads all documents under a path prefix", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Identity content",
        });
        await kb.create(user.id, {
            path: "profile.preferences",
            name: "preferences.txt",
            content: "Preferences content",
        });
        await kb.create(user.id, {
            path: "profile.goals",
            name: "goals.txt",
            content: "Goals content",
        });

        const docs = await kb.readFolder(user.id, "profile");

        expect(docs).toHaveLength(3);
        const paths = docs.map((d) => d.path).sort();
        expect(paths).toEqual([
            "profile.goals",
            "profile.identity",
            "profile.preferences",
        ]);
    });

    it("reads nested documents under a prefix", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "profile.people.sarah",
            name: "sarah.txt",
            content: "Sarah info",
        });
        await kb.create(user.id, {
            path: "profile.people.mike",
            name: "mike.txt",
            content: "Mike info",
        });

        const docs = await kb.readFolder(user.id, "profile.people");

        expect(docs).toHaveLength(2);
    });

    it("includes the root document in folder read", async () => {
        const user = await createTestUser();

        // Create a document at the prefix level
        await kb.create(user.id, {
            path: "profile",
            name: "profile.txt",
            content: "Profile root",
        });
        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Identity",
        });

        const docs = await kb.readFolder(user.id, "profile");

        expect(docs).toHaveLength(2);
        expect(docs.some((d) => d.path === "profile")).toBe(true);
    });

    it("returns empty array for non-existent prefix", async () => {
        const user = await createTestUser();

        const docs = await kb.readFolder(user.id, "nonexistent");

        expect(docs).toEqual([]);
    });

    it("does not include documents from other users", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "shared.document",
            name: "document.txt",
            content: "User 1 content",
        });

        const docs = await kb.readFolder(user2.id, "shared");

        expect(docs).toEqual([]);
    });

    it("reads deeply nested structure correctly", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "profile.people.colleagues.engineering.sarah",
            name: "sarah.txt",
            content: "Sarah - senior engineer",
        });
        await kb.create(user.id, {
            path: "profile.people.colleagues.engineering.mike",
            name: "mike.txt",
            content: "Mike - tech lead",
        });
        await kb.create(user.id, {
            path: "profile.people.friends.alex",
            name: "alex.txt",
            content: "Alex - friend",
        });

        const collegeDocs = await kb.readFolder(
            user.id,
            "profile.people.colleagues.engineering"
        );
        expect(collegeDocs).toHaveLength(2);

        const allPeopleDocs = await kb.readFolder(user.id, "profile.people");
        expect(allPeopleDocs).toHaveLength(3);
    });
});

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

describe("KB Update Operations", () => {
    it("updates document content", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Original content",
        });

        const updated = await kb.update(user.id, "profile.identity", {
            content: "Updated content",
        });

        expect(updated?.content).toBe("Updated content");
    });

    it("updates document name", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "notes.todo",
            name: "todo.txt",
            content: "Todo list",
        });

        const updated = await kb.update(user.id, "notes.todo", {
            name: "tasks.txt",
        });

        expect(updated?.name).toBe("tasks.txt");
    });

    it("updates document tags", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "profile.people.sarah",
            name: "sarah.txt",
            content: "Sarah info",
            tags: ["person"],
        });

        const updated = await kb.update(user.id, "profile.people.sarah", {
            tags: ["person", "colleague", "manager"],
        });

        expect(updated?.tags).toEqual(["person", "colleague", "manager"]);
    });

    it("updates updatedAt timestamp", async () => {
        const user = await createTestUser();
        const created = await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Original",
        });

        // Small delay to ensure timestamp difference
        await new Promise((r) => setTimeout(r, 10));

        const updated = await kb.update(user.id, "profile.identity", {
            content: "Updated",
        });

        expect(updated!.updatedAt.getTime()).toBeGreaterThan(
            created.createdAt.getTime()
        );
    });

    it("returns null when updating non-existent document", async () => {
        const user = await createTestUser();

        const result = await kb.update(user.id, "nonexistent.path", {
            content: "New content",
        });

        expect(result).toBeNull();
    });

    it("cannot update another user's document", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "private.doc",
            name: "doc.txt",
            content: "User 1 content",
        });

        const result = await kb.update(user2.id, "private.doc", {
            content: "Hacked content",
        });

        expect(result).toBeNull();

        // Verify original is unchanged
        const original = await kb.read(user1.id, "private.doc");
        expect(original?.content).toBe("User 1 content");
    });
});

// ============================================================================
// UPSERT OPERATIONS
// ============================================================================

describe("KB Upsert Operations", () => {
    it("creates document if it does not exist", async () => {
        const user = await createTestUser();

        const doc = await kb.upsert(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "New identity",
        });

        expect(doc.content).toBe("New identity");
        expect(doc.id).toBeDefined();
    });

    it("updates document if it exists", async () => {
        const user = await createTestUser();

        // First create
        const created = await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Original",
        });

        // Then upsert
        const updated = await kb.upsert(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Updated via upsert",
        });

        expect(updated.id).toBe(created.id); // Same document
        expect(updated.content).toBe("Updated via upsert");
    });

    it("upsert is atomic (no race conditions)", async () => {
        const user = await createTestUser();

        // Run multiple concurrent upserts
        const results = await Promise.all([
            kb.upsert(user.id, {
                path: "concurrent.test",
                name: "test.txt",
                content: "Version A",
            }),
            kb.upsert(user.id, {
                path: "concurrent.test",
                name: "test.txt",
                content: "Version B",
            }),
        ]);

        // Both should succeed without error
        expect(results).toHaveLength(2);
        results.forEach((r) => expect(r.id).toBeDefined());

        // Only one document should exist
        const docs = await kb.readFolder(user.id, "concurrent");
        expect(docs).toHaveLength(1);
    });

    it("updates sourceType on upsert", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "notes.meeting",
            name: "meeting.txt",
            content: "Original notes",
            sourceType: "conversation_extraction",
            sourceId: "conv_123",
        });

        // Upsert with a different sourceType should update it
        const updated = await kb.upsert(user.id, {
            path: "notes.meeting",
            name: "meeting.txt",
            content: "Updated notes",
            sourceType: "manual",
        });

        // Content should be updated
        expect(updated.content).toBe("Updated notes");
        // sourceType should be updated to the new value
        expect(updated.sourceType).toBe("manual");
    });
});

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

describe("KB Remove Operations", () => {
    it("removes a document by path", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "notes.temporary",
            name: "temporary.txt",
            content: "Temporary content",
        });

        const removed = await kb.remove(user.id, "notes.temporary");

        expect(removed).toBe(true);

        const doc = await kb.read(user.id, "notes.temporary");
        expect(doc).toBeNull();
    });

    it("returns false when removing non-existent document", async () => {
        const user = await createTestUser();

        const removed = await kb.remove(user.id, "nonexistent.path");

        expect(removed).toBe(false);
    });

    it("cannot remove another user's document", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "private.doc",
            name: "doc.txt",
            content: "User 1 content",
        });

        const removed = await kb.remove(user2.id, "private.doc");

        expect(removed).toBe(false);

        // Original still exists
        const doc = await kb.read(user1.id, "private.doc");
        expect(doc).not.toBeNull();
    });
});

// ============================================================================
// LIST ALL OPERATIONS
// ============================================================================

describe("KB ListAll Operations", () => {
    it("lists all documents for a user", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Identity",
        });
        await kb.create(user.id, {
            path: "notes.meeting",
            name: "meeting.txt",
            content: "Meeting notes",
        });
        await kb.create(user.id, {
            path: "projects.carmenta",
            name: "carmenta.txt",
            content: "Carmenta project",
        });

        const docs = await kb.listAll(user.id);

        expect(docs).toHaveLength(3);
    });

    it("returns documents sorted by path", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "zebra",
            name: "zebra.txt",
            content: "Z",
        });
        await kb.create(user.id, {
            path: "apple",
            name: "apple.txt",
            content: "A",
        });
        await kb.create(user.id, {
            path: "mango",
            name: "mango.txt",
            content: "M",
        });

        const docs = await kb.listAll(user.id);

        expect(docs.map((d) => d.path)).toEqual(["apple", "mango", "zebra"]);
    });

    it("returns empty array for user with no documents", async () => {
        const user = await createTestUser();

        const docs = await kb.listAll(user.id);

        expect(docs).toEqual([]);
    });

    it("does not include documents from other users", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "user1.doc",
            name: "doc.txt",
            content: "User 1",
        });
        await kb.create(user2.id, {
            path: "user2.doc",
            name: "doc.txt",
            content: "User 2",
        });

        const user1Docs = await kb.listAll(user1.id);
        const user2Docs = await kb.listAll(user2.id);

        expect(user1Docs).toHaveLength(1);
        expect(user1Docs[0].path).toBe("user1.doc");
        expect(user2Docs).toHaveLength(1);
        expect(user2Docs[0].path).toBe("user2.doc");
    });
});

// ============================================================================
// EXISTS OPERATIONS
// ============================================================================

describe("KB Exists Operations", () => {
    it("returns true for existing document", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Exists",
        });

        const exists = await kb.exists(user.id, "profile.identity");

        expect(exists).toBe(true);
    });

    it("returns false for non-existent document", async () => {
        const user = await createTestUser();

        const exists = await kb.exists(user.id, "nonexistent.path");

        expect(exists).toBe(false);
    });

    it("accepts filesystem-style path", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: "profile.identity",
            name: "identity.txt",
            content: "Exists",
        });

        const exists = await kb.exists(user.id, "/profile/identity.txt");

        expect(exists).toBe(true);
    });
});

// ============================================================================
// SEARCH OPERATIONS
// ============================================================================

describe("KB Search Operations", () => {
    it("searches documents by content keyword", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "notes.javascript",
            name: "javascript.txt",
            content: "JavaScript is a programming language",
        });
        await kb.create(user.id, {
            path: "notes.python",
            name: "python.txt",
            content: "Python is a programming language",
        });
        await kb.create(user.id, {
            path: "notes.cooking",
            name: "cooking.txt",
            content: "Recipes for dinner",
        });

        const results = await kb.search(user.id, "programming");

        expect(results).toHaveLength(2);
        const paths = results.map((d) => d.path).sort();
        expect(paths).toEqual(["notes.javascript", "notes.python"]);
    });

    it("searches documents by name", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "notes.meeting",
            name: "team-meeting.txt",
            content: "Discussion topics",
        });
        await kb.create(user.id, {
            path: "notes.standup",
            name: "standup.txt",
            content: "Daily updates",
        });

        const results = await kb.search(user.id, "meeting");

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("team-meeting.txt");
    });

    it("performs case-insensitive search", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "notes.carmenta",
            name: "carmenta.txt",
            content: "Carmenta is an AI assistant",
        });

        const results = await kb.search(user.id, "CARMENTA");

        expect(results).toHaveLength(1);
    });

    it("respects limit parameter", async () => {
        const user = await createTestUser();

        // Create multiple matching documents
        for (let i = 0; i < 15; i++) {
            await kb.create(user.id, {
                path: `notes.note${i}`,
                name: `note${i}.txt`,
                content: `This is note number ${i} about testing`,
            });
        }

        const results = await kb.search(user.id, "testing", 5);

        expect(results).toHaveLength(5);
    });

    it("returns empty array when no matches", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: "notes.cooking",
            name: "cooking.txt",
            content: "Recipes for dinner",
        });

        const results = await kb.search(user.id, "programming");

        expect(results).toEqual([]);
    });

    it("does not search other users' documents", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await kb.create(user1.id, {
            path: "secrets.password",
            name: "password.txt",
            content: "Super secret password",
        });

        const results = await kb.search(user2.id, "secret");

        expect(results).toEqual([]);
    });

    it("orders results by updatedAt descending", async () => {
        const user = await createTestUser();

        const doc1 = await kb.create(user.id, {
            path: "notes.first",
            name: "first.txt",
            content: "First programming note",
        });

        await new Promise((r) => setTimeout(r, 10));

        const doc2 = await kb.create(user.id, {
            path: "notes.second",
            name: "second.txt",
            content: "Second programming note",
        });

        const results = await kb.search(user.id, "programming");

        expect(results).toHaveLength(2);
        // Most recently updated first
        expect(results[0].path).toBe("notes.second");
        expect(results[1].path).toBe("notes.first");
    });
});

// ============================================================================
// PROFILE PATHS CONSTANT
// ============================================================================

describe("PROFILE_PATHS Constant", () => {
    it("defines expected profile structure", () => {
        expect(PROFILE_PATHS).toEqual({
            root: "profile",
            identity: "profile.identity",
            instructions: "profile.instructions",
            preferences: "profile.preferences",
            goals: "profile.goals",
            people: "profile.people",
        });
    });
});
