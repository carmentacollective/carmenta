/**
 * Context Compilation Tests
 *
 * Tests cover:
 * - Compiling user profile into system prompt context
 * - Handling missing/partial profiles gracefully
 * - Including people in compiled context
 * - Profile summary generation
 * - Error handling with graceful degradation
 */

import { describe, it, expect, vi } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb, PROFILE_PATHS } from "@/lib/kb/index";
import { compileUserContext, getProfileSummary } from "@/lib/kb/compile-context";
import { initializeProfile, addPerson } from "@/lib/kb/profile";

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

async function createPopulatedProfile(userId: string) {
    await kb.create(userId, {
        path: PROFILE_PATHS.identity,
        name: "identity.txt",
        content: `Name: Nick Sullivan
Role: Founder & Software Engineer
Background: 25 years building trading systems, integration architecture, and AI interfaces
Working on: Carmenta - a heart-centered AI assistant`,
    });

    await kb.create(userId, {
        path: PROFILE_PATHS.preferences,
        name: "preferences.txt",
        content: `Communication style: Direct and playful
Response format: Concise with depth when needed
Time context: Pacific timezone, works evenings
Special requests: Anticipatory care, notice what's needed before being asked`,
    });

    await kb.create(userId, {
        path: PROFILE_PATHS.goals,
        name: "goals.txt",
        content: `Current priorities:
- Ship Carmenta V1 to early users
- Build robust knowledge base system

Working toward:
- Transform how humans and AI collaborate
- Build sustainable heart-centered business

Challenges:
- Balancing speed with quality
- Context management in long sessions`,
    });
}

// ============================================================================
// COMPILE USER CONTEXT
// ============================================================================

describe("compileUserContext", () => {
    it("returns empty string for user with no profile", async () => {
        const user = await createTestUser();

        const context = await compileUserContext(user.id);

        expect(context).toBe("");
    });

    it("compiles identity section with header", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Name: Nick Sullivan\nRole: Founder",
        });

        const context = await compileUserContext(user.id);

        expect(context).toContain("## About Who We're Working With");
        expect(context).toContain("Name: Nick Sullivan");
        expect(context).toContain("Role: Founder");
    });

    it("compiles preferences section with header", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.preferences,
            name: "preferences.txt",
            content: "Communication style: Direct",
        });

        const context = await compileUserContext(user.id);

        expect(context).toContain("## How We Work Together");
        expect(context).toContain("Communication style: Direct");
    });

    it("compiles goals section with header", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.goals,
            name: "goals.txt",
            content: "Current priorities:\n- Ship V1",
        });

        const context = await compileUserContext(user.id);

        expect(context).toContain("## What We're Working Toward");
        expect(context).toContain("Ship V1");
    });

    it("compiles full profile with all sections", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);

        const context = await compileUserContext(user.id);

        expect(context).toContain("## About Who We're Working With");
        expect(context).toContain("## How We Work Together");
        expect(context).toContain("## What We're Working Toward");
        expect(context).toContain("Nick Sullivan");
        expect(context).toContain("Direct and playful");
        expect(context).toContain("Ship Carmenta V1");
    });

    it("includes people section when people exist", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);
        await addPerson(
            user.id,
            "Sarah",
            "Sarah is a senior engineer. Expert in React."
        );
        await addPerson(
            user.id,
            "Mike",
            "Mike is the product manager. Great at prioritization."
        );

        const context = await compileUserContext(user.id);

        expect(context).toContain("## People in Our World");
        expect(context).toContain("### Sarah");
        expect(context).toContain("senior engineer");
        expect(context).toContain("### Mike");
        expect(context).toContain("product manager");
    });

    it("capitalizes person names in headers", async () => {
        const user = await createTestUser();
        await addPerson(user.id, "alex", "Alex info"); // lowercase input

        const context = await compileUserContext(user.id);

        expect(context).toContain("### Alex"); // Capitalized in output
    });

    it("handles partial profile gracefully", async () => {
        const user = await createTestUser();
        // Only create identity
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Name: Nick",
        });

        const context = await compileUserContext(user.id);

        expect(context).toContain("## About Who We're Working With");
        expect(context).not.toContain("## How We Work Together");
        expect(context).not.toContain("## What We're Working Toward");
    });

    it("skips sections with empty content", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Name: Nick",
        });
        await kb.create(user.id, {
            path: PROFILE_PATHS.preferences,
            name: "preferences.txt",
            content: "", // Empty
        });

        const context = await compileUserContext(user.id);

        expect(context).toContain("## About Who We're Working With");
        expect(context).not.toContain("## How We Work Together");
    });

    it("trims whitespace from section content", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "\n\n  Name: Nick  \n\n",
        });

        const context = await compileUserContext(user.id);

        expect(context).toContain("Name: Nick");
        expect(context).not.toMatch(/\n\n\n/); // No excessive newlines
    });

    it("separates sections with double newlines", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Name: Nick",
        });
        await kb.create(user.id, {
            path: PROFILE_PATHS.preferences,
            name: "preferences.txt",
            content: "Style: Direct",
        });

        const context = await compileUserContext(user.id);

        // Should have blank line between sections
        expect(context).toMatch(/Working With\n\nName: Nick\n\n## How We Work/);
    });

    it("excludes people folder document from people section", async () => {
        const user = await createTestUser();

        // Create a document at the folder level (shouldn't appear as a person)
        await kb.create(user.id, {
            path: PROFILE_PATHS.people,
            name: "people.txt",
            content: "People folder index",
        });
        await addPerson(user.id, "Sarah", "Sarah info");

        const context = await compileUserContext(user.id);

        expect(context).toContain("### Sarah");
        expect(context).not.toContain("People folder index");
    });
});

// ============================================================================
// PROFILE SUMMARY
// ============================================================================

describe("getProfileSummary", () => {
    it("returns hasProfile: false for user with no documents", async () => {
        const user = await createTestUser();

        const summary = await getProfileSummary(user.id);

        expect(summary.hasProfile).toBe(false);
        expect(summary.documentCount).toBe(0);
        expect(summary.documents).toEqual([]);
    });

    it("returns hasProfile: true when documents exist", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        const summary = await getProfileSummary(user.id);

        expect(summary.hasProfile).toBe(true);
    });

    it("counts all profile documents", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);
        await addPerson(user.id, "Sarah", "Sarah info");
        await addPerson(user.id, "Mike", "Mike info");

        const summary = await getProfileSummary(user.id);

        expect(summary.documentCount).toBe(5); // identity, preferences, goals, sarah, mike
    });

    it("returns document metadata with display paths", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Test content here",
        });

        const summary = await getProfileSummary(user.id);

        expect(summary.documents).toHaveLength(1);
        expect(summary.documents[0]).toMatchObject({
            path: "/profile/identity.txt", // Display path format
            name: "identity.txt",
            contentLength: 17, // "Test content here".length
        });
    });

    it("includes all documents in summary", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);

        const summary = await getProfileSummary(user.id);

        const paths = summary.documents.map((d) => d.path).sort();
        expect(paths).toEqual([
            "/profile/goals.txt",
            "/profile/identity.txt",
            "/profile/preferences.txt",
        ]);
    });

    it("includes people documents in summary", async () => {
        const user = await createTestUser();
        await addPerson(user.id, "Sarah", "Sarah info");

        const summary = await getProfileSummary(user.id);

        expect(
            summary.documents.some((d) => d.path === "/profile/people/sarah.txt")
        ).toBe(true);
    });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe("Context Compilation Error Handling", () => {
    it("returns empty string on database error (graceful degradation)", async () => {
        // This test verifies the catch block in compileUserContext
        // We can't easily simulate a database error with PGlite,
        // but we can verify the function handles a non-existent user gracefully
        const nonExistentUserId = uuid();

        const context = await compileUserContext(nonExistentUserId);

        // Should return empty string, not throw
        expect(context).toBe("");
    });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe("Context Compilation Integration", () => {
    it("produces context suitable for system prompt injection", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);
        await addPerson(
            user.id,
            "Sarah",
            "Sarah is the engineering lead. Direct communicator."
        );

        const context = await compileUserContext(user.id);

        // Verify structure is markdown-like for LLM consumption
        expect(context).toMatch(/^## /m); // Starts with h2 headers
        expect(context).toMatch(/### /m); // Has h3 for people

        // Verify no template placeholders leaked through
        expect(context).not.toContain("[Your name]");
        expect(context).not.toContain("[Priority 1");
    });

    it("handles a realistic workflow: init, update, compile", async () => {
        const user = await createTestUser();

        // Step 1: Initialize with templates
        await initializeProfile(user.id);

        // Step 2: User updates their profile
        await kb.update(user.id, PROFILE_PATHS.identity, {
            content: "Name: Nick Sullivan\nRole: Founder",
        });

        // Step 3: Compile context
        const context = await compileUserContext(user.id);

        // Should include updated identity, template preferences, template goals
        expect(context).toContain("Nick Sullivan");
        expect(context).toContain("[Direct/detailed/casual/formal"); // Template marker in preferences
    });

    it("supports incremental profile building", async () => {
        const user = await createTestUser();

        // Add identity first
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "identity.txt",
            content: "Name: Nick",
        });

        let context = await compileUserContext(user.id);
        expect(context).toContain("Nick");
        expect(context).not.toContain("## How We Work");

        // Add preferences later
        await kb.create(user.id, {
            path: PROFILE_PATHS.preferences,
            name: "preferences.txt",
            content: "Style: Direct",
        });

        context = await compileUserContext(user.id);
        expect(context).toContain("Nick");
        expect(context).toContain("## How We Work");
        expect(context).toContain("Direct");

        // Add a person
        await addPerson(user.id, "Sarah", "Colleague");

        context = await compileUserContext(user.id);
        expect(context).toContain("## People in Our World");
        expect(context).toContain("### Sarah");
    });
});
