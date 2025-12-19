/**
 * Profile Management Tests
 *
 * Tests cover:
 * - Profile initialization with three core documents (character, identity, preferences)
 * - Profile section updates
 * - Profile population detection
 * - Idempotent initialization
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb, PROFILE_PATHS } from "@/lib/kb/index";
import {
    initializeProfile,
    updateProfileSection,
    hasPopulatedProfile,
    CARMENTA_DEFAULT_CHARACTER,
    PROFILE_DOCUMENT_DEFS,
} from "@/lib/kb/profile";

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
// PROFILE INITIALIZATION
// ============================================================================

describe("Profile Initialization", () => {
    it("creates all three core profile documents", async () => {
        const user = await createTestUser();

        const created = await initializeProfile(user.id);

        expect(created).toBe(true);

        const character = await kb.read(user.id, PROFILE_PATHS.character);
        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);

        expect(character).not.toBeNull();
        expect(identity).not.toBeNull();
        expect(preferences).not.toBeNull();
    });

    it("seeds character with Carmenta defaults", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id);

        const character = await kb.read(user.id, PROFILE_PATHS.character);

        expect(character?.content).toBe(CARMENTA_DEFAULT_CHARACTER);
        expect(character?.name).toBe("Carmenta");
    });

    it("seeds identity with userName when provided", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id, { userName: "Nick Sullivan" });

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);

        expect(identity?.content).toBe("Nick Sullivan");
        expect(identity?.name).toBe("Who I Am");
    });

    it("creates empty identity when no userName provided", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);

        expect(identity?.content).toBe("");
    });

    it("creates empty preferences document", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id);

        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);

        expect(preferences?.content).toBe("");
        expect(preferences?.name).toBe("How We Interact");
    });

    it("sets correct metadata on profile documents", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id);

        const character = await kb.read(user.id, PROFILE_PATHS.character);
        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);

        // Check character metadata
        expect(character?.promptLabel).toBe("character");
        expect(character?.promptHint).toBe(PROFILE_DOCUMENT_DEFS.character.promptHint);
        expect(character?.promptOrder).toBe(1);
        expect(character?.alwaysInclude).toBe(true);
        expect(character?.editable).toBe(true);

        // Check identity metadata
        expect(identity?.promptLabel).toBe("about");
        expect(identity?.promptHint).toBe(PROFILE_DOCUMENT_DEFS.identity.promptHint);
        expect(identity?.promptOrder).toBe(2);
        expect(identity?.alwaysInclude).toBe(true);

        // Check preferences metadata
        expect(preferences?.promptLabel).toBe("preferences");
        expect(preferences?.promptOrder).toBe(3);
        expect(preferences?.alwaysInclude).toBe(true);
    });

    it("is idempotent - does not overwrite existing documents", async () => {
        const user = await createTestUser();

        // First initialization
        await initializeProfile(user.id, { userName: "Original Name" });

        // Second initialization - should not change anything
        const created = await initializeProfile(user.id, { userName: "New Name" });

        expect(created).toBe(false);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.content).toBe("Original Name");
    });

    it("only creates missing documents", async () => {
        const user = await createTestUser();

        // Manually create just identity
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Existing identity",
            alwaysInclude: true,
        });

        // Initialize should create character and preferences, but not touch identity
        const created = await initializeProfile(user.id);

        expect(created).toBe(true);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.content).toBe("Existing identity");

        const character = await kb.read(user.id, PROFILE_PATHS.character);
        expect(character?.content).toBe(CARMENTA_DEFAULT_CHARACTER);
    });

    it("sets sourceType to seed for initialized documents", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id);

        const character = await kb.read(user.id, PROFILE_PATHS.character);
        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);

        expect(character?.sourceType).toBe("seed");
        expect(identity?.sourceType).toBe("seed");
        expect(preferences?.sourceType).toBe("seed");
    });
});

// ============================================================================
// PROFILE SECTION UPDATES
// ============================================================================

describe("Profile Section Updates", () => {
    it("updates character section", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        await updateProfileSection(
            user.id,
            "character",
            "Name: Custom AI\nVoice: Playful and energetic"
        );

        const character = await kb.read(user.id, PROFILE_PATHS.character);
        expect(character?.content).toBe(
            "Name: Custom AI\nVoice: Playful and energetic"
        );
    });

    it("updates identity section", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        await updateProfileSection(
            user.id,
            "identity",
            "Name: Nick Sullivan\nRole: Founder"
        );

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.content).toBe("Name: Nick Sullivan\nRole: Founder");
    });

    it("updates preferences section", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        await updateProfileSection(
            user.id,
            "preferences",
            "Communication style: Direct and concise"
        );

        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);
        expect(preferences?.content).toBe("Communication style: Direct and concise");
    });

    it("creates section if it does not exist (upsert behavior)", async () => {
        const user = await createTestUser();
        // Don't initialize - section doesn't exist

        await updateProfileSection(user.id, "identity", "Brand new identity");

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.content).toBe("Brand new identity");
        expect(identity?.sourceType).toBe("manual");
    });

    it("changes sourceType to manual on update", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id); // Creates with sourceType: seed

        await updateProfileSection(user.id, "identity", "Updated by user");

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.sourceType).toBe("manual");
    });

    it("preserves metadata on update", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        await updateProfileSection(user.id, "character", "New character content");

        const character = await kb.read(user.id, PROFILE_PATHS.character);
        expect(character?.promptLabel).toBe("character");
        expect(character?.alwaysInclude).toBe(true);
        expect(character?.promptOrder).toBe(1);
    });

    it("throws error when trying to update root", async () => {
        const user = await createTestUser();

        await expect(updateProfileSection(user.id, "root", "content")).rejects.toThrow(
            "Cannot update profile root"
        );
    });
});

// ============================================================================
// PROFILE POPULATION DETECTION
// ============================================================================

describe("Profile Population Detection", () => {
    it("returns false when no profile exists", async () => {
        const user = await createTestUser();

        const populated = await hasPopulatedProfile(user.id);

        expect(populated).toBe(false);
    });

    it("returns false when identity has no content", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id); // Creates empty identity

        const populated = await hasPopulatedProfile(user.id);

        expect(populated).toBe(false);
    });

    it("returns true when identity has content", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id, { userName: "Nick Sullivan" });

        const populated = await hasPopulatedProfile(user.id);

        expect(populated).toBe(true);
    });

    it("returns true after identity is updated with content", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id); // Empty identity

        // Initially not populated
        expect(await hasPopulatedProfile(user.id)).toBe(false);

        // Update with content
        await updateProfileSection(user.id, "identity", "Nick Sullivan");

        // Now populated
        expect(await hasPopulatedProfile(user.id)).toBe(true);
    });
});

// ============================================================================
// PROFILE DOCUMENT DEFINITIONS
// ============================================================================

describe("Profile Document Definitions", () => {
    it("exports character definition with correct metadata", () => {
        expect(PROFILE_DOCUMENT_DEFS.character.name).toBe("Carmenta");
        expect(PROFILE_DOCUMENT_DEFS.character.promptLabel).toBe("character");
        expect(PROFILE_DOCUMENT_DEFS.character.promptOrder).toBe(1);
    });

    it("exports identity definition with correct metadata", () => {
        expect(PROFILE_DOCUMENT_DEFS.identity.name).toBe("Who I Am");
        expect(PROFILE_DOCUMENT_DEFS.identity.promptLabel).toBe("about");
        expect(PROFILE_DOCUMENT_DEFS.identity.promptOrder).toBe(2);
    });

    it("exports preferences definition with correct metadata", () => {
        expect(PROFILE_DOCUMENT_DEFS.preferences.name).toBe("How We Interact");
        expect(PROFILE_DOCUMENT_DEFS.preferences.promptLabel).toBe("preferences");
        expect(PROFILE_DOCUMENT_DEFS.preferences.promptOrder).toBe(3);
    });

    it("exports default Carmenta character", () => {
        expect(CARMENTA_DEFAULT_CHARACTER).toContain("Name: Carmenta");
        expect(CARMENTA_DEFAULT_CHARACTER).toContain("Voice:");
        expect(CARMENTA_DEFAULT_CHARACTER).toContain("Language:");
    });
});
