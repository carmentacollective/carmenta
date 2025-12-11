/**
 * User Database Operations Tests
 *
 * Tests for lib/db/users.ts helper functions.
 * Uses PGlite from vitest.setup.ts for real database operations.
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";

import { db, schema } from "@/lib/db";

setupTestDb();
import {
    findUserByEmail,
    findUserByClerkId,
    getOrCreateUser,
    updateUserPreferences,
    updateLastSignedIn,
} from "@/lib/db/users";

describe("User Database Operations", () => {
    describe("findUserByEmail", () => {
        it("returns user when found", async () => {
            // Setup: Create user directly in database
            await db.insert(schema.users).values({
                clerkId: "clerk_123",
                email: "test@example.com",
                displayName: "Test User",
            });

            // Act
            const user = await findUserByEmail("test@example.com");

            // Assert
            expect(user).not.toBeNull();
            expect(user?.email).toBe("test@example.com");
            expect(user?.displayName).toBe("Test User");
        });

        it("returns null when user not found", async () => {
            const user = await findUserByEmail("nonexistent@example.com");
            expect(user).toBeNull();
        });
    });

    describe("findUserByClerkId", () => {
        it("returns user when found", async () => {
            // Setup
            await db.insert(schema.users).values({
                clerkId: "clerk_456",
                email: "clerk-test@example.com",
            });

            // Act
            const user = await findUserByClerkId("clerk_456");

            // Assert
            expect(user).not.toBeNull();
            expect(user?.clerkId).toBe("clerk_456");
        });

        it("returns null when clerk ID not found", async () => {
            const user = await findUserByClerkId("nonexistent_clerk_id");
            expect(user).toBeNull();
        });
    });

    describe("getOrCreateUser", () => {
        it("creates new user when not exists", async () => {
            // Act
            const user = await getOrCreateUser("clerk_new", "new@example.com", {
                firstName: "New",
                lastName: "User",
                displayName: "New User",
                imageUrl: "https://example.com/image.png",
            });

            // Assert
            expect(user).toBeDefined();
            expect(user.clerkId).toBe("clerk_new");
            expect(user.email).toBe("new@example.com");
            expect(user.firstName).toBe("New");
            expect(user.lastName).toBe("User");
            expect(user.displayName).toBe("New User");
            expect(user.imageUrl).toBe("https://example.com/image.png");
            expect(user.lastSignedInAt).not.toBeNull();
        });

        it("returns existing user and updates last sign in", async () => {
            // Setup: Create user first
            const [existingUser] = await db
                .insert(schema.users)
                .values({
                    clerkId: "clerk_existing",
                    email: "existing@example.com",
                    lastSignedInAt: new Date("2024-01-01"),
                })
                .returning();

            // Act
            const user = await getOrCreateUser(
                "clerk_existing",
                "existing@example.com"
            );

            // Assert
            expect(user.id).toBe(existingUser.id);
            expect(user.lastSignedInAt).not.toBeNull();
            // Last sign in should be updated to recent time
            expect(user.lastSignedInAt!.getTime()).toBeGreaterThan(
                new Date("2024-01-01").getTime()
            );
        });

        it("handles race condition with upsert", async () => {
            // Create two concurrent calls
            const [user1, user2] = await Promise.all([
                getOrCreateUser("clerk_race", "race@example.com"),
                getOrCreateUser("clerk_race", "race@example.com"),
            ]);

            // Both should return the same user (upsert handles conflict)
            expect(user1.id).toBe(user2.id);
        });

        it("updates clerk_id when same email appears with different clerk_id", async () => {
            // Use unique identifiers to avoid test isolation issues
            const uniqueId = Date.now().toString();
            const testEmail = `reregistered-${uniqueId}@example.com`;
            const originalClerkId = `clerk_original_${uniqueId}`;
            const newClerkId = `clerk_new_${uniqueId}`;

            // Setup: User exists with original clerk_id
            // This happens when: user re-registers, switches OAuth providers,
            // or Clerk user ID changes for any reason
            await db.insert(schema.users).values({
                clerkId: originalClerkId,
                email: testEmail,
                firstName: "Original",
            });

            // Act: Same email, different clerk_id (simulates re-registration)
            const user = await getOrCreateUser(newClerkId, testEmail, {
                firstName: "Updated",
                lastName: "Name",
            });

            // Assert: Should succeed and update the clerk_id
            expect(user.email).toBe(testEmail);
            expect(user.clerkId).toBe(newClerkId);
            expect(user.firstName).toBe("Updated");
        });
    });

    describe("updateUserPreferences", () => {
        it("updates preferences for existing user", async () => {
            // Setup
            await db.insert(schema.users).values({
                clerkId: "clerk_prefs",
                email: "prefs@example.com",
                preferences: { theme: "light" },
            });

            // Act
            const user = await updateUserPreferences("prefs@example.com", {
                defaultModel: "claude-3-opus",
                showKeyboardHints: true,
            });

            // Assert
            expect(user).not.toBeNull();
            expect(user?.preferences).toMatchObject({
                theme: "light", // Preserved from original
                defaultModel: "claude-3-opus", // Added
                showKeyboardHints: true, // Added
            });
        });

        it("returns null for nonexistent user", async () => {
            const user = await updateUserPreferences("nonexistent@example.com", {
                theme: "dark",
            });
            expect(user).toBeNull();
        });

        it("merges preferences without overwriting unspecified fields", async () => {
            // Setup with complex preferences
            await db.insert(schema.users).values({
                clerkId: "clerk_merge",
                email: "merge@example.com",
                preferences: {
                    theme: "dark",
                    defaultModel: "gpt-4",
                    notifications: { email: true, push: false },
                },
            });

            // Act: Update only theme
            const user = await updateUserPreferences("merge@example.com", {
                theme: "light",
            });

            // Assert: Other preferences preserved
            expect(user?.preferences).toMatchObject({
                theme: "light", // Updated
                defaultModel: "gpt-4", // Preserved
                notifications: { email: true, push: false }, // Preserved
            });
        });
    });

    describe("updateLastSignedIn", () => {
        it("updates last signed in timestamp", async () => {
            // Setup
            await db.insert(schema.users).values({
                clerkId: "clerk_signin",
                email: "signin@example.com",
                lastSignedInAt: new Date("2024-01-01"),
            });

            // Act
            await updateLastSignedIn("signin@example.com");

            // Assert
            const user = await findUserByEmail("signin@example.com");
            expect(user?.lastSignedInAt).not.toBeNull();
            expect(user?.lastSignedInAt!.getTime()).toBeGreaterThan(
                new Date("2024-01-01").getTime()
            );
        });

        it("silently succeeds for nonexistent user", async () => {
            // Should not throw
            await expect(
                updateLastSignedIn("nonexistent@example.com")
            ).resolves.not.toThrow();
        });
    });
});

describe("User Schema", () => {
    it("creates user with all required fields", async () => {
        const [user] = await db
            .insert(schema.users)
            .values({
                clerkId: "clerk_full",
                email: "full@example.com",
            })
            .returning();

        expect(user.id).toBeDefined();
        expect(user.clerkId).toBe("clerk_full");
        expect(user.email).toBe("full@example.com");
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
        expect(user.preferences).toEqual({});
    });

    it("enforces unique constraint on email", async () => {
        await db.insert(schema.users).values({
            clerkId: "clerk_unique1",
            email: "unique@example.com",
        });

        await expect(
            db.insert(schema.users).values({
                clerkId: "clerk_unique2",
                email: "unique@example.com", // Duplicate email
            })
        ).rejects.toThrow();
    });

    it("enforces unique constraint on clerk_id", async () => {
        await db.insert(schema.users).values({
            clerkId: "clerk_duplicate",
            email: "first@example.com",
        });

        await expect(
            db.insert(schema.users).values({
                clerkId: "clerk_duplicate", // Duplicate clerk ID
                email: "second@example.com",
            })
        ).rejects.toThrow();
    });
});
