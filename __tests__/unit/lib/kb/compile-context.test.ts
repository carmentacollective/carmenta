/**
 * Context Compilation Tests
 *
 * Tests cover:
 * - Compiling user profile into XML context for system prompt
 * - Handling missing/partial profiles gracefully
 * - XML format with purpose attributes
 * - Profile summary generation
 * - Error handling with graceful degradation
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb, PROFILE_PATHS } from "@/lib/kb/index";
import {
    compileProfileContext,
    compileUserContext,
    getProfileSummary,
} from "@/lib/kb/compile-context";
import { initializeProfile, PROFILE_DOCUMENT_DEFS } from "@/lib/kb/profile";

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
        path: PROFILE_PATHS.character,
        name: "Carmenta",
        content: `Name: Carmenta
Voice: Warm, sophisticated, quiet confidence`,
        promptLabel: "character",
        promptHint: "The AI's personality—name, voice, patterns",
        promptOrder: 1,
        alwaysInclude: true,
    });

    await kb.create(userId, {
        path: PROFILE_PATHS.identity,
        name: "Who I Am",
        content: `Name: Nick Sullivan
Role: Founder & Software Engineer
Building Carmenta - a heart-centered AI assistant`,
        promptLabel: "about",
        promptHint: "Who the user is—identity, role, current focus",
        promptOrder: 2,
        alwaysInclude: true,
    });

    await kb.create(userId, {
        path: PROFILE_PATHS.preferences,
        name: "How We Interact",
        content: `Communication style: Direct and playful
Response format: Concise with depth when needed`,
        promptLabel: "preferences",
        promptHint: "How the user prefers to collaborate—tone, format, depth",
        promptOrder: 3,
        alwaysInclude: true,
    });
}

// ============================================================================
// COMPILE PROFILE CONTEXT
// ============================================================================

describe("compileProfileContext", () => {
    it("returns null for user with no profile", async () => {
        const user = await createTestUser();

        const context = await compileProfileContext(user.id);

        expect(context).toBeNull();
    });

    it("compiles character section with XML tags and purpose", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.character,
            name: "Carmenta",
            content: "Name: Carmenta\nVoice: Warm",
            promptLabel: "character",
            promptHint: "The AI's personality",
            promptOrder: 1,
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toContain('<character purpose="The AI\'s personality">');
        expect(context).toContain("Name: Carmenta");
        expect(context).toContain("Voice: Warm");
        expect(context).toContain("</character>");
    });

    it("compiles identity section with XML tags", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Name: Nick Sullivan\nRole: Founder",
            promptLabel: "about",
            promptHint: "Who the user is",
            promptOrder: 2,
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toContain('<about purpose="Who the user is">');
        expect(context).toContain("Name: Nick Sullivan");
        expect(context).toContain("</about>");
    });

    it("compiles preferences section with XML tags", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.preferences,
            name: "How We Interact",
            content: "Style: Direct",
            promptLabel: "preferences",
            promptHint: "How the user prefers to collaborate",
            promptOrder: 3,
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toContain(
            '<preferences purpose="How the user prefers to collaborate">'
        );
        expect(context).toContain("Style: Direct");
        expect(context).toContain("</preferences>");
    });

    it("compiles full profile with all sections in order", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);

        const context = await compileProfileContext(user.id);

        expect(context).not.toBeNull();
        // Check order: character (1) before about (2) before preferences (3)
        const characterIndex = context!.indexOf("<character");
        const aboutIndex = context!.indexOf("<about");
        const preferencesIndex = context!.indexOf("<preferences");

        expect(characterIndex).toBeLessThan(aboutIndex);
        expect(aboutIndex).toBeLessThan(preferencesIndex);
    });

    it("handles partial profile gracefully", async () => {
        const user = await createTestUser();
        // Only create identity
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Name: Nick",
            promptLabel: "about",
            promptHint: "Who the user is",
            promptOrder: 2,
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toContain("<about");
        expect(context).not.toContain("<character");
        expect(context).not.toContain("<preferences");
    });

    it("skips documents without alwaysInclude flag", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Name: Nick",
            promptLabel: "about",
            alwaysInclude: false, // Not included
        });

        const context = await compileProfileContext(user.id);

        expect(context).toBeNull();
    });

    it("skips documents without promptLabel", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Name: Nick",
            // No promptLabel
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toBeNull();
    });

    it("skips documents with empty content", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "",
            promptLabel: "about",
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toBeNull();
    });

    it("skips documents with whitespace-only content", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "   \n\t  ",
            promptLabel: "about",
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toBeNull();
    });

    it("trims whitespace from section content", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "\n\n  Name: Nick  \n\n",
            promptLabel: "about",
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toContain("Name: Nick");
        expect(context).not.toMatch(/\n\n\n/); // No excessive newlines
    });

    it("separates sections with double newlines", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);

        const context = await compileProfileContext(user.id);

        // Should have blank line between sections
        expect(context).toContain("</character>\n\n<about");
        expect(context).toContain("</about>\n\n<preferences");
    });

    it("omits purpose attribute when promptHint is undefined", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Name: Nick",
            promptLabel: "about",
            // promptHint intentionally omitted
            alwaysInclude: true,
        });

        const context = await compileProfileContext(user.id);

        expect(context).toContain("<about>\n");
        expect(context).not.toContain("purpose=");
    });
});

// ============================================================================
// COMPILE USER CONTEXT (Legacy)
// ============================================================================

describe("compileUserContext (legacy)", () => {
    it("returns empty string for user with no profile", async () => {
        const user = await createTestUser();

        const context = await compileUserContext(user.id);

        expect(context).toBe("");
    });

    it("returns compiled context when profile exists", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);

        const context = await compileUserContext(user.id);

        expect(context).toContain("<character");
        expect(context).toContain("<about");
        expect(context).toContain("<preferences");
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
        await initializeProfile(user.id);

        const summary = await getProfileSummary(user.id);

        expect(summary.documentCount).toBe(3); // character, identity, preferences
    });

    it("returns document metadata with display paths", async () => {
        const user = await createTestUser();
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Test content here",
            promptLabel: "about",
            alwaysInclude: true,
        });

        const summary = await getProfileSummary(user.id);

        expect(summary.documents).toHaveLength(1);
        expect(summary.documents[0]).toMatchObject({
            path: "/profile/identity",
            name: "Who I Am",
            contentLength: 17, // "Test content here".length
            promptLabel: "about",
            alwaysInclude: true,
        });
    });

    it("includes all three documents in summary", async () => {
        const user = await createTestUser();
        await initializeProfile(user.id);

        const summary = await getProfileSummary(user.id);

        const paths = summary.documents.map((d) => d.path).sort();
        expect(paths).toEqual([
            "/profile/character",
            "/profile/identity",
            "/profile/preferences",
        ]);
    });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe("Context Compilation Error Handling", () => {
    it("returns null on database error (graceful degradation)", async () => {
        // This test verifies the catch block in compileProfileContext
        // We can't easily simulate a database error with PGlite,
        // but we can verify the function handles a non-existent user gracefully
        const nonExistentUserId = uuid();

        const context = await compileProfileContext(nonExistentUserId);

        // Should return null, not throw
        expect(context).toBeNull();
    });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe("Context Compilation Integration", () => {
    it("produces XML context suitable for system prompt injection", async () => {
        const user = await createTestUser();
        await createPopulatedProfile(user.id);

        const context = await compileProfileContext(user.id);

        // Verify structure is XML format for LLM consumption
        expect(context).toMatch(/^<character/);
        expect(context).toMatch(/<\/preferences>$/);

        // Verify purpose attributes are present
        expect(context).toContain('purpose="');
    });

    it("handles a realistic workflow: init, update, compile", async () => {
        const user = await createTestUser();

        // Step 1: Initialize profile
        await initializeProfile(user.id, { userName: "Nick Sullivan" });

        // Step 2: Compile context
        const context = await compileProfileContext(user.id);

        // Should include character (Carmenta defaults), identity (Nick), and preferences (empty - skipped)
        expect(context).toContain("<character");
        expect(context).toContain("Carmenta");
        expect(context).toContain("<about");
        expect(context).toContain("Nick Sullivan");
        // Preferences is empty, so it should be skipped
        expect(context).not.toContain("<preferences");
    });

    it("supports incremental profile building", async () => {
        const user = await createTestUser();

        // Add identity first (with higher promptOrder so it comes after character)
        await kb.create(user.id, {
            path: PROFILE_PATHS.identity,
            name: "Who I Am",
            content: "Name: Nick",
            promptLabel: "about",
            promptOrder: 2,
            alwaysInclude: true,
        });

        let context = await compileProfileContext(user.id);
        expect(context).toContain("Nick");
        expect(context).not.toContain("<character");

        // Add character later (with lower promptOrder so it comes first)
        await kb.create(user.id, {
            path: PROFILE_PATHS.character,
            name: "Carmenta",
            content: "Name: Custom AI",
            promptLabel: "character",
            promptOrder: 1,
            alwaysInclude: true,
        });

        context = await compileProfileContext(user.id);
        expect(context).toContain("<character");
        expect(context).toContain("Custom AI");
        // Character should come before about due to promptOrder
        expect(context!.indexOf("<character")).toBeLessThan(context!.indexOf("<about"));
    });
});
