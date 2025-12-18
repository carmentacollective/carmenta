/**
 * Integration Tests: Knowledge Base Server Actions
 *
 * Tests the KB server actions with real PGlite database operations.
 * These tests validate business logic, data flow, and error handling.
 *
 * Pattern: Use real db operations, mock only Clerk auth (external service).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import {
    getKBFolders,
    getKBDocuments,
    getKBDocument,
    updateKBDocument,
    initializeKBWithClerkData,
    hasKBProfile,
    type ClerkUserData,
} from "@/lib/kb/actions";
import { kb, PROFILE_PATHS } from "@/lib/kb/index";

// Setup real PGlite database
setupTestDb();

// Mock Clerk authentication (external service)
const mocks = vi.hoisted(() => ({
    mockAuth: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
    auth: mocks.mockAuth,
}));

describe("Knowledge Base Server Actions", () => {
    // Use a valid UUID for test user (database ID)
    const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
    const OTHER_USER_ID = "660e8400-e29b-41d4-a716-446655440000";

    // Clerk IDs (what auth() returns)
    const TEST_CLERK_ID = "clerk_test_123";
    const OTHER_CLERK_ID = "clerk_other_456";

    beforeEach(async () => {
        // Create test user in database (required for foreign key constraint)
        await db.insert(schema.users).values({
            id: TEST_USER_ID,
            clerkId: TEST_CLERK_ID,
            email: "test@example.com",
        });

        // Create other user for multi-user tests
        await db.insert(schema.users).values({
            id: OTHER_USER_ID,
            clerkId: OTHER_CLERK_ID,
            email: "other@example.com",
        });

        // Default: authenticated user (auth() returns Clerk ID, not database UUID)
        mocks.mockAuth.mockResolvedValue({ userId: TEST_CLERK_ID });
    });

    describe("getKBFolders()", () => {
        it("returns empty array when user has no documents", async () => {
            const folders = await getKBFolders();

            expect(folders).toEqual([]);
        });

        it("groups documents by parent folder", async () => {
            // Arrange: Create documents in different folders
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Name: Test User",
            });

            await kb.create(TEST_USER_ID, {
                path: "profile.preferences",
                name: "preferences.txt",
                content: "Communication style: Direct",
            });

            await kb.create(TEST_USER_ID, {
                path: "profile.people.sarah",
                name: "sarah.txt",
                content: "Sarah is a colleague",
            });

            // Act
            const folders = await getKBFolders();

            // Assert: Should have two folders (profile and profile.people)
            expect(folders).toHaveLength(2);

            const profileFolder = folders.find((f) => f.id === "profile");
            expect(profileFolder).toBeDefined();
            expect(profileFolder?.documents).toHaveLength(2);
            expect(profileFolder?.documents[0].name).toBe("identity.txt");
            expect(profileFolder?.documents[1].name).toBe("preferences.txt");

            const peopleFolder = folders.find((f) => f.id === "profile.people");
            expect(peopleFolder).toBeDefined();
            expect(peopleFolder?.documents).toHaveLength(1);
            expect(peopleFolder?.documents[0].name).toBe("sarah.txt");
        });

        it("sorts folders and documents alphabetically", async () => {
            // Arrange: Create documents in non-alphabetical order
            await kb.create(TEST_USER_ID, {
                path: "zebra.doc3",
                name: "doc3.txt",
                content: "Content",
            });

            await kb.create(TEST_USER_ID, {
                path: "alpha.doc1",
                name: "doc1.txt",
                content: "Content",
            });

            await kb.create(TEST_USER_ID, {
                path: "alpha.doc2",
                name: "doc2.txt",
                content: "Content",
            });

            // Act
            const folders = await getKBFolders();

            // Assert: Folders should be alphabetically sorted
            expect(folders[0].name).toBe("alpha");
            expect(folders[1].name).toBe("zebra");

            // Documents within alpha folder should be sorted
            expect(folders[0].documents[0].name).toBe("doc1.txt");
            expect(folders[0].documents[1].name).toBe("doc2.txt");
        });

        it("throws when user is not authenticated", async () => {
            // Arrange: Unauthenticated
            mocks.mockAuth.mockResolvedValue({ userId: null });

            // Act & Assert
            await expect(getKBFolders()).rejects.toThrow("Unauthorized");
        });

        it("includes all document fields in response", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "test.doc",
                name: "test.txt",
                content: "Test content",
            });

            // Act
            const folders = await getKBFolders();

            // Assert: Verify all fields are present
            const doc = folders[0].documents[0];
            expect(doc).toMatchObject({
                id: expect.any(String),
                path: "test.doc",
                name: "test.txt",
                content: "Test content",
                updatedAt: expect.any(Date),
            });
        });
    });

    describe("getKBDocuments()", () => {
        it("returns empty array when user has no documents", async () => {
            const documents = await getKBDocuments();

            expect(documents).toEqual([]);
        });

        it("returns all documents as flat list", async () => {
            // Arrange: Create documents in different folders
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Name: Test User",
            });

            await kb.create(TEST_USER_ID, {
                path: "profile.people.sarah",
                name: "sarah.txt",
                content: "Sarah is a colleague",
            });

            await kb.create(TEST_USER_ID, {
                path: "notes.meeting1",
                name: "meeting1.txt",
                content: "Meeting notes",
            });

            // Act
            const documents = await getKBDocuments();

            // Assert: Should have all documents in flat list
            expect(documents).toHaveLength(3);
            expect(documents.map((d) => d.name)).toEqual([
                "meeting1.txt",
                "identity.txt",
                "sarah.txt",
            ]);
        });

        it("only returns documents for authenticated user", async () => {
            // Arrange: Create documents for multiple users
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Test User",
            });

            await kb.create(OTHER_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Other User",
            });

            // Act
            const documents = await getKBDocuments();

            // Assert: Should only return current user's documents
            expect(documents).toHaveLength(1);
            expect(documents[0].content).toBe("Test User");
        });

        it("throws when user is not authenticated", async () => {
            // Arrange: Unauthenticated
            mocks.mockAuth.mockResolvedValue({ userId: null });

            // Act & Assert
            await expect(getKBDocuments()).rejects.toThrow("Unauthorized");
        });

        it("includes all document fields in response", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "test.doc",
                name: "test.txt",
                content: "Test content",
            });

            // Act
            const documents = await getKBDocuments();

            // Assert: Verify all fields are present
            expect(documents[0]).toMatchObject({
                id: expect.any(String),
                path: "test.doc",
                name: "test.txt",
                content: "Test content",
                updatedAt: expect.any(Date),
            });
        });
    });

    describe("getKBDocument()", () => {
        it("returns document by path", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Name: Test User\nRole: Engineer",
            });

            // Act
            const document = await getKBDocument("profile.identity");

            // Assert
            expect(document).toMatchObject({
                id: expect.any(String),
                path: "profile.identity",
                name: "identity.txt",
                content: "Name: Test User\nRole: Engineer",
                updatedAt: expect.any(Date),
            });
        });

        it("returns null when document does not exist", async () => {
            // Act
            const document = await getKBDocument("nonexistent.path");

            // Assert
            expect(document).toBeNull();
        });

        it("does not return other users' documents", async () => {
            // Arrange: Create document for different user
            await kb.create(OTHER_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Other User",
            });

            // Act
            const document = await getKBDocument("profile.identity");

            // Assert: Should not find the document
            expect(document).toBeNull();
        });

        it("throws when user is not authenticated", async () => {
            // Arrange: Unauthenticated
            mocks.mockAuth.mockResolvedValue({ userId: null });

            // Act & Assert
            await expect(getKBDocument("profile.identity")).rejects.toThrow(
                "Unauthorized"
            );
        });

        it("handles filesystem-style paths", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Test content",
            });

            // Act: Query with filesystem-style path
            const document = await getKBDocument("/profile/identity.txt");

            // Assert: Should convert and find the document
            expect(document).toBeDefined();
            expect(document?.path).toBe("profile.identity");
        });
    });

    describe("updateKBDocument()", () => {
        it("updates document content successfully", async () => {
            // Arrange: Create document
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Original content",
            });

            // Act
            const updated = await updateKBDocument(
                "profile.identity",
                "Updated content"
            );

            // Assert
            expect(updated.content).toBe("Updated content");
            expect(updated.path).toBe("profile.identity");

            // Verify in database
            const doc = await kb.read(TEST_USER_ID, "profile.identity");
            expect(doc?.content).toBe("Updated content");
        });

        it("updates the updatedAt timestamp", async () => {
            // Arrange: Create document
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Original content",
            });

            const original = await kb.read(TEST_USER_ID, "profile.identity");
            const originalTimestamp = original?.updatedAt;

            // Wait a tiny bit to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Act
            const updated = await updateKBDocument(
                "profile.identity",
                "Updated content"
            );

            // Assert: Timestamp should be newer
            expect(updated.updatedAt.getTime()).toBeGreaterThan(
                originalTimestamp!.getTime()
            );
        });

        it("throws when document does not exist", async () => {
            // Act & Assert
            await expect(
                updateKBDocument("nonexistent.path", "New content")
            ).rejects.toThrow("Document not found: nonexistent.path");
        });

        it("does not update other users' documents", async () => {
            // Arrange: Create document for different user
            await kb.create(OTHER_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Other User",
            });

            // Act & Assert: Should not find document to update
            await expect(
                updateKBDocument("profile.identity", "Hacked content")
            ).rejects.toThrow("Document not found");
        });

        it("throws when user is not authenticated", async () => {
            // Arrange: Unauthenticated
            mocks.mockAuth.mockResolvedValue({ userId: null });

            // Act & Assert
            await expect(
                updateKBDocument("profile.identity", "New content")
            ).rejects.toThrow("Unauthorized");
        });

        it("preserves other document fields when updating", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Original content",
                sourceType: "manual",
                tags: ["important"],
            });

            // Act
            const updated = await updateKBDocument(
                "profile.identity",
                "Updated content"
            );

            // Assert: Other fields should remain unchanged
            const doc = await kb.read(TEST_USER_ID, "profile.identity");
            expect(doc?.name).toBe("identity.txt");
            expect(doc?.sourceType).toBe("manual");
            expect(doc?.tags).toEqual(["important"]);
        });
    });

    describe("initializeKBWithClerkData()", () => {
        it("creates profile documents for new user", async () => {
            // Arrange
            const clerkData: ClerkUserData = {
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            };

            // Act
            const result = await initializeKBWithClerkData(clerkData);

            // Assert
            expect(result.created).toBe(true);

            // Verify identity document was created with custom content
            const identity = await kb.read(TEST_USER_ID, PROFILE_PATHS.identity);
            expect(identity).toBeDefined();
            expect(identity?.content).toContain("Name: Nick");
            expect(identity?.sourceType).toBe("seed");

            // Verify instructions document was created
            const instructions = await kb.read(
                TEST_USER_ID,
                PROFILE_PATHS.instructions
            );
            expect(instructions).toBeDefined();
            expect(instructions?.content).toContain(
                "How should Carmenta communicate with you?"
            );
            expect(instructions?.sourceType).toBe("seed");
        });

        it("uses firstName when available", async () => {
            // Arrange
            const clerkData: ClerkUserData = {
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            };

            // Act
            await initializeKBWithClerkData(clerkData);

            // Assert
            const identity = await kb.read(TEST_USER_ID, PROFILE_PATHS.identity);
            expect(identity?.content).toContain("Name: Nick");
        });

        it("falls back to fullName when firstName is null", async () => {
            // Arrange
            const clerkData: ClerkUserData = {
                firstName: null,
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            };

            // Act
            await initializeKBWithClerkData(clerkData);

            // Assert
            const identity = await kb.read(TEST_USER_ID, PROFILE_PATHS.identity);
            expect(identity?.content).toContain("Name: Nick Sullivan");
        });

        it("uses 'Friend' when no name is available", async () => {
            // Arrange
            const clerkData: ClerkUserData = {
                firstName: null,
                lastName: null,
                fullName: null,
                email: "anonymous@example.com",
            };

            // Act
            await initializeKBWithClerkData(clerkData);

            // Assert
            const identity = await kb.read(TEST_USER_ID, PROFILE_PATHS.identity);
            expect(identity?.content).toContain("Name: Friend");
        });

        it("does not overwrite existing documents", async () => {
            // Arrange: Create existing identity document
            await kb.create(TEST_USER_ID, {
                path: PROFILE_PATHS.identity,
                name: "identity.txt",
                content: "Existing custom content",
            });

            const clerkData: ClerkUserData = {
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            };

            // Act
            const result = await initializeKBWithClerkData(clerkData);

            // Assert: Should indicate profile was created (instructions doc was new)
            // Note: initializeProfile returns false, but instructions doc is still created
            expect(result.created).toBe(true);

            // Verify existing identity content was not overwritten
            const identity = await kb.read(TEST_USER_ID, PROFILE_PATHS.identity);
            expect(identity?.content).toBe("Existing custom content");

            // Verify instructions doc was created
            const instructions = await kb.read(
                TEST_USER_ID,
                PROFILE_PATHS.instructions
            );
            expect(instructions).toBeDefined();
        });

        it("is safe to call multiple times", async () => {
            // Arrange
            const clerkData: ClerkUserData = {
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            };

            // Act: Call twice
            const result1 = await initializeKBWithClerkData(clerkData);
            const result2 = await initializeKBWithClerkData(clerkData);

            // Assert
            expect(result1.created).toBe(true);
            expect(result2.created).toBe(false);

            // Verify documents exist
            const identity = await kb.read(TEST_USER_ID, PROFILE_PATHS.identity);
            expect(identity).toBeDefined();
        });

        it("throws when user is not authenticated", async () => {
            // Arrange: Unauthenticated
            mocks.mockAuth.mockResolvedValue({ userId: null });

            const clerkData: ClerkUserData = {
                firstName: "Nick",
                lastName: "Sullivan",
                fullName: "Nick Sullivan",
                email: "nick@example.com",
            };

            // Act & Assert
            await expect(initializeKBWithClerkData(clerkData)).rejects.toThrow(
                "Unauthorized"
            );
        });
    });

    describe("hasKBProfile()", () => {
        it("returns false when user has no profile", async () => {
            // Act
            const hasProfile = await hasKBProfile();

            // Assert
            expect(hasProfile).toBe(false);
        });

        it("returns true when user has identity document", async () => {
            // Arrange: Create identity document
            await kb.create(TEST_USER_ID, {
                path: PROFILE_PATHS.identity,
                name: "identity.txt",
                content: "Name: Test User",
            });

            // Act
            const hasProfile = await hasKBProfile();

            // Assert
            expect(hasProfile).toBe(true);
        });

        it("returns false when user is not authenticated", async () => {
            // Arrange: Unauthenticated
            mocks.mockAuth.mockResolvedValue({ userId: null });

            // Act
            const hasProfile = await hasKBProfile();

            // Assert
            expect(hasProfile).toBe(false);
        });

        it("checks only identity document existence", async () => {
            // Arrange: Create other documents but not identity
            await kb.create(TEST_USER_ID, {
                path: PROFILE_PATHS.preferences,
                name: "preferences.txt",
                content: "Some preferences",
            });

            // Act
            const hasProfile = await hasKBProfile();

            // Assert: Should return false without identity document
            expect(hasProfile).toBe(false);
        });
    });

    describe("Edge Cases", () => {
        it("handles documents with special characters in content", async () => {
            // Arrange: Create document with special chars
            const specialContent = `Name: Test User
Email: test@example.com
Notes: "Quotes", 'apostrophes', & ampersands
Code: <script>alert('xss')</script>`;

            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: specialContent,
            });

            // Act
            const document = await getKBDocument("profile.identity");

            // Assert: Content should be preserved exactly
            expect(document?.content).toBe(specialContent);
        });

        it("handles empty content in documents", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "",
            });

            // Act
            const document = await getKBDocument("profile.identity");

            // Assert
            expect(document?.content).toBe("");
        });

        it("handles very long content", async () => {
            // Arrange: Create document with large content (but under 1MB limit)
            const longContent = "x".repeat(500_000); // 500KB

            await kb.create(TEST_USER_ID, {
                path: "test.large",
                name: "large.txt",
                content: longContent,
            });

            // Act
            const document = await getKBDocument("test.large");

            // Assert
            expect(document?.content).toBe(longContent);
        });

        it("handles documents with deeply nested paths", async () => {
            // Arrange
            await kb.create(TEST_USER_ID, {
                path: "a.b.c.d.e.f.deep",
                name: "deep.txt",
                content: "Deep content",
            });

            // Act
            const folders = await getKBFolders();
            const document = await getKBDocument("a.b.c.d.e.f.deep");

            // Assert
            expect(document).toBeDefined();
            expect(folders.length).toBeGreaterThan(0);
        });

        it("handles concurrent updates to same document", async () => {
            // Arrange: Create document
            await kb.create(TEST_USER_ID, {
                path: "profile.identity",
                name: "identity.txt",
                content: "Original",
            });

            // Act: Concurrent updates
            const [result1, result2] = await Promise.all([
                updateKBDocument("profile.identity", "Update 1"),
                updateKBDocument("profile.identity", "Update 2"),
            ]);

            // Assert: Both should succeed (last write wins)
            expect(
                result1.content === "Update 1" || result2.content === "Update 2"
            ).toBe(true);

            // Verify final state is consistent
            const final = await kb.read(TEST_USER_ID, "profile.identity");
            expect(final?.content).toMatch(/Update [12]/);
        });
    });
});
