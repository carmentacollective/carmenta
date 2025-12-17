/**
 * Profile Management Tests
 *
 * Tests cover:
 * - Profile initialization with templates and custom data
 * - Profile section updates
 * - Adding and retrieving people
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
    addPerson,
    getPeople,
    hasPopulatedProfile,
    PROFILE_TEMPLATES,
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
    it("creates all profile documents with templates by default", async () => {
        const user = await createTestUser();

        const created = await initializeProfile(user.id);

        expect(created).toBe(true);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);
        const goals = await kb.read(user.id, PROFILE_PATHS.goals);

        expect(identity).not.toBeNull();
        expect(preferences).not.toBeNull();
        expect(goals).not.toBeNull();

        // Check template content is present
        expect(identity?.content).toContain("[Your name]");
        expect(preferences?.content).toContain("Communication style:");
        expect(goals?.content).toContain("Current priorities:");
    });

    it("creates empty documents when withTemplates is false", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id, { withTemplates: false });

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);
        const goals = await kb.read(user.id, PROFILE_PATHS.goals);

        expect(identity?.content).toBe("");
        expect(preferences?.content).toBe("");
        expect(goals?.content).toBe("");
    });

    it("uses initial data when provided", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id, {
            initialData: {
                identity: "Name: Nick Sullivan\nRole: Software Engineer",
                preferences: "Communication style: Direct",
                goals: "Current priorities:\n- Ship Carmenta V1",
            },
        });

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);
        const goals = await kb.read(user.id, PROFILE_PATHS.goals);

        expect(identity?.content).toBe("Name: Nick Sullivan\nRole: Software Engineer");
        expect(preferences?.content).toBe("Communication style: Direct");
        expect(goals?.content).toContain("Ship Carmenta V1");
    });

    it("is idempotent - does not overwrite existing documents", async () => {
        const user = await createTestUser();

        // First initialization with custom data
        await initializeProfile(user.id, {
            initialData: {
                identity: "Original identity",
            },
        });

        // Second initialization - should not change anything
        const created = await initializeProfile(user.id, {
            initialData: {
                identity: "New identity",
            },
        });

        expect(created).toBe(false);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.content).toBe("Original identity");
    });

    it("only creates missing documents", async () => {
        const user = await createTestUser();

        // Manually create just identity
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Existing identity",
        });

        // Initialize should create preferences and goals, but not touch identity
        const created = await initializeProfile(user.id);

        expect(created).toBe(true);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);
        expect(identity?.content).toBe("Existing identity");

        const preferences = await kb.read(user.id, PROFILE_PATHS.preferences);
        expect(preferences?.content).toContain("[Direct/detailed/casual/formal");
    });

    it("sets sourceType to seed for template-created documents", async () => {
        const user = await createTestUser();

        await initializeProfile(user.id);

        const identity = await kb.read(user.id, PROFILE_PATHS.identity);

        expect(identity?.sourceType).toBe("seed");
    });
});

// ============================================================================
// PROFILE SECTION UPDATES
// ============================================================================

describe("Profile Section Updates", () => {
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

    it("updates goals section", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        await updateProfileSection(
            user.id,
            "goals",
            "Current priorities:\n- Launch Carmenta\n- Scale to 1000 users"
        );

        const goals = await kb.read(user.id, PROFILE_PATHS.goals);
        expect(goals?.content).toContain("Launch Carmenta");
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
});

// ============================================================================
// PEOPLE MANAGEMENT
// ============================================================================

describe("People Management", () => {
    it("adds a person to the profile", async () => {
        const user = await createTestUser();

        await addPerson(
            user.id,
            "Sarah Thompson",
            "Sarah is a senior engineer at the company.\nExpertise: React, TypeScript"
        );

        const doc = await kb.read(user.id, "profile.people.sarah-thompson");
        expect(doc).not.toBeNull();
        expect(doc?.content).toContain("senior engineer");
    });

    it("normalizes person name for path (lowercase, hyphens)", async () => {
        const user = await createTestUser();

        await addPerson(user.id, "Mike O'Brien", "Mike is a friend.");

        const doc = await kb.read(user.id, "profile.people.mike-o'brien");
        expect(doc).not.toBeNull();
    });

    it("adds person tag to document", async () => {
        const user = await createTestUser();

        await addPerson(user.id, "Alex", "Alex is a colleague.");

        const doc = await kb.read(user.id, "profile.people.alex");
        expect(doc?.tags).toContain("person");
    });

    it("updates existing person (upsert behavior)", async () => {
        const user = await createTestUser();

        await addPerson(user.id, "Sarah", "Original info about Sarah");
        await addPerson(user.id, "Sarah", "Updated info about Sarah");

        const people = await kb.readFolder(user.id, PROFILE_PATHS.people);
        const sarahDocs = people.filter((d) => d.path === "profile.people.sarah");

        expect(sarahDocs).toHaveLength(1);
        expect(sarahDocs[0].content).toBe("Updated info about Sarah");
    });

    it("retrieves all people", async () => {
        const user = await createTestUser();

        await addPerson(user.id, "Sarah", "Sarah info");
        await addPerson(user.id, "Mike", "Mike info");
        await addPerson(user.id, "Alex", "Alex info");

        const people = await getPeople(user.id);

        expect(people).toHaveLength(3);
        expect(people.map((p) => p.name).sort()).toEqual(["alex", "mike", "sarah"]);
    });

    it("returns empty array when no people exist", async () => {
        const user = await createTestUser();

        const people = await getPeople(user.id);

        expect(people).toEqual([]);
    });

    it("excludes the people folder document itself from results", async () => {
        const user = await createTestUser();

        // Create a document at the "people" path (folder level)
        await kb.create(user.id, {
            path: PROFILE_PATHS.people,
            name: "people.txt",
            content: "This is the people folder",
        });

        await addPerson(user.id, "Sarah", "Sarah info");

        const people = await getPeople(user.id);

        expect(people).toHaveLength(1);
        expect(people[0].name).toBe("sarah");
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

    it("returns false when profile has template markers", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        const populated = await hasPopulatedProfile(user.id);

        expect(populated).toBe(false);
    });

    it("returns true when profile has real content", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id, {
            initialData: {
                identity: "Name: Nick Sullivan\nRole: Founder at Carmenta",
            },
        });

        const populated = await hasPopulatedProfile(user.id);

        expect(populated).toBe(true);
    });

    it("detects template markers indicating unpopulated profile", async () => {
        const user = await createTestUser();

        // Create profile with one template marker still present
        // Using exact marker from hasPopulatedProfile check: "[Your name]"
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: `Name: [Your name]
Role: Software Engineer
Background: 25 years in software`,
        });

        const populated = await hasPopulatedProfile(user.id);

        // Still has template marker "[Your name]", so not fully populated
        expect(populated).toBe(false);
    });

    it("returns true when all template markers are replaced", async () => {
        const user = await createTestUser();

        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: `Name: Nick Sullivan
Role: Founder
Background: Building AI systems for 25 years
Working on: Carmenta - a heart-centered AI assistant`,
        });

        const populated = await hasPopulatedProfile(user.id);

        expect(populated).toBe(true);
    });
});

// ============================================================================
// PROFILE TEMPLATES
// ============================================================================

describe("Profile Templates", () => {
    it("exports identity template with expected placeholders", () => {
        expect(PROFILE_TEMPLATES.identity).toContain("[Your name]");
        expect(PROFILE_TEMPLATES.identity).toContain("Role:");
        expect(PROFILE_TEMPLATES.identity).toContain("Background:");
    });

    it("exports preferences template with expected placeholders", () => {
        expect(PROFILE_TEMPLATES.preferences).toContain("Communication style:");
        expect(PROFILE_TEMPLATES.preferences).toContain("Response format:");
    });

    it("exports goals template with expected structure", () => {
        expect(PROFILE_TEMPLATES.goals).toContain("Current priorities:");
        expect(PROFILE_TEMPLATES.goals).toContain("Working toward:");
        expect(PROFILE_TEMPLATES.goals).toContain("Challenges:");
    });
});
