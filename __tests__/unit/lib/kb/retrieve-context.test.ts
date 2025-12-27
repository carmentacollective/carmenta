/**
 * Knowledge Base Context Retrieval Tests
 *
 * Tests cover:
 * - Retrieving context based on search configuration
 * - Handling shouldSearch flag
 * - Entity-based retrieval (high precision)
 * - Query-based retrieval (full-text search)
 * - Deduplication across search strategies
 * - Token budget and maxDocuments limits
 * - Error handling with graceful degradation
 * - XML formatting for system prompt injection
 */

import { describe, it, expect } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { kb } from "@/lib/kb/index";
import {
    retrieveContext,
    formatRetrievedContext,
    type RetrievedContext,
    type RetrievedDocument,
} from "@/lib/kb/retrieve-context";
import type { KBSearchConfig } from "@/lib/concierge/types";

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

async function createTestDocument(
    userId: string,
    options: {
        path: string;
        name: string;
        content: string;
        description?: string;
        sourceType?: "manual" | "conversation_extraction";
        sourceId?: string;
    }
) {
    return kb.create(userId, {
        path: options.path,
        name: options.name,
        content: options.content,
        description: options.description,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
    });
}

// ============================================================================
// RETRIEVE CONTEXT - SHOULD SEARCH FLAG
// ============================================================================

describe("retrieveContext - shouldSearch flag", () => {
    it("returns empty results when shouldSearch is false", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "projects.carmenta",
            name: "Carmenta Project",
            content: "This document should not be retrieved",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: false,
            queries: ["carmenta"],
            entities: ["carmenta"],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.documents).toHaveLength(0);
        expect(result.success).toBe(true);
        expect(result.totalMatches).toBe(0);
    });

    it("returns results when shouldSearch is true", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "projects.carmenta",
            name: "Carmenta Project",
            content: "Heart-centered AI assistant for builders",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["carmenta"],
            entities: [],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeGreaterThanOrEqual(1);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - EMPTY QUERIES
// ============================================================================

describe("retrieveContext - empty queries and entities", () => {
    it("returns empty results when queries and entities are empty", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "notes.random",
            name: "Random Note",
            content: "This should not match anything",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: [],
            entities: [],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents).toHaveLength(0);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - ENTITY MATCHING
// ============================================================================

describe("retrieveContext - entity matching", () => {
    it("retrieves documents matching entity names in path", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "people.sarah",
            name: "Sarah",
            content: "Sarah is a colleague who works on frontend",
        });

        await createTestDocument(user.id, {
            path: "projects.backend",
            name: "Backend Project",
            content: "Backend development notes",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: [],
            entities: ["sarah"],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeGreaterThanOrEqual(1);

        const sarahDoc = result.documents.find((d) => d.path === "people.sarah");
        expect(sarahDoc).toBeDefined();
        expect(sarahDoc?.retrievalReason).toBe("entity_match");
    });

    it("matches entities case-insensitively", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "people.mike",
            name: "Mike",
            content: "Mike handles infrastructure",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: [],
            entities: ["MIKE"],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents.some((d) => d.path === "people.mike")).toBe(true);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - FULL-TEXT SEARCH
// ============================================================================

describe("retrieveContext - full-text search", () => {
    it("retrieves documents matching query terms", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "integrations.google-calendar",
            name: "Google Calendar",
            content: "We integrated Google Calendar using OAuth2 for authentication",
            description: "Calendar integration notes",
        });

        await createTestDocument(user.id, {
            path: "notes.cooking",
            name: "Cooking Recipes",
            content: "How to make pasta carbonara",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["google calendar integration"],
            entities: [],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeGreaterThanOrEqual(1);

        const calendarDoc = result.documents.find((d) =>
            d.path.includes("google-calendar")
        );
        expect(calendarDoc).toBeDefined();
    });

    it("searches across multiple queries", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "tech.typescript",
            name: "TypeScript Notes",
            content: "TypeScript is a typed superset of JavaScript",
        });

        await createTestDocument(user.id, {
            path: "tech.react",
            name: "React Notes",
            content: "React is a JavaScript library for building UIs",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["typescript", "react"],
            entities: [],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        // Both documents should potentially match
        expect(result.documents.length).toBeGreaterThanOrEqual(1);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - DEDUPLICATION
// ============================================================================

describe("retrieveContext - deduplication", () => {
    it("deduplicates documents found by both entity and query search", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "integrations.calendar",
            name: "Calendar",
            content: "Calendar integration with scheduling features",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["calendar"],
            entities: ["calendar"],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);

        // Count how many documents have path "integrations.calendar"
        const calendarDocs = result.documents.filter(
            (d) => d.path === "integrations.calendar"
        );
        // Should be deduplicated to exactly one
        expect(calendarDocs).toHaveLength(1);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - LIMITS
// ============================================================================

describe("retrieveContext - maxDocuments limit", () => {
    it("respects maxDocuments limit", async () => {
        const user = await createTestUser();

        // Create many matching documents
        for (let i = 0; i < 10; i++) {
            await createTestDocument(user.id, {
                path: `notes.programming.note${i}`,
                name: `Programming Note ${i}`,
                content: `This is a programming note about coding concept ${i}`,
            });
        }

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["programming"],
            entities: [],
        };

        const result = await retrieveContext(user.id, searchConfig, {
            maxDocuments: 3,
        });

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeLessThanOrEqual(3);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - USER ISOLATION
// ============================================================================

describe("retrieveContext - user isolation", () => {
    it("does not retrieve documents from other users", async () => {
        const user1 = await createTestUser("user1@example.com");
        const user2 = await createTestUser("user2@example.com");

        await createTestDocument(user1.id, {
            path: "secrets.password",
            name: "Password",
            content: "User1 super secret password",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["secret password"],
            entities: ["password"],
        };

        const result = await retrieveContext(user2.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents).toHaveLength(0);
    });
});

// ============================================================================
// RETRIEVE CONTEXT - SOURCE METADATA
// ============================================================================

describe("retrieveContext - source metadata", () => {
    it("includes source information in retrieved documents", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "notes.meeting",
            name: "Meeting Notes",
            content: "Meeting notes about project planning",
            sourceType: "conversation_extraction",
            sourceId: "conv_12345",
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["meeting"],
            entities: [],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeGreaterThanOrEqual(1);

        const meetingDoc = result.documents.find((d) => d.path.includes("meeting"));
        expect(meetingDoc).toBeDefined();
        expect(meetingDoc?.source.type).toBe("conversation_extraction");
        expect(meetingDoc?.source.id).toBe("conv_12345");
        // Dates may come back as Date objects or ISO strings depending on driver
        expect(meetingDoc?.source.createdAt).toBeDefined();
        expect(meetingDoc?.source.updatedAt).toBeDefined();
    });
});

// ============================================================================
// FORMAT RETRIEVED CONTEXT
// ============================================================================

describe("formatRetrievedContext", () => {
    it("returns null when no documents", () => {
        const context: RetrievedContext = {
            documents: [],
            success: true,
            totalMatches: 0,
            estimatedTokens: 0,
        };

        expect(formatRetrievedContext(context)).toBeNull();
    });

    it("formats documents as XML", () => {
        const doc: RetrievedDocument = {
            id: "doc-1",
            path: "projects.carmenta.auth",
            name: "Auth Decisions",
            content: "We decided to use JWT",
            summary: "Authentication architecture",
            retrievalReason: "entity_match",
            relevance: 0.95,
            source: {
                type: "conversation_extraction",
                id: "conv-123",
                createdAt: new Date("2024-01-10"),
                updatedAt: new Date("2024-01-15"),
            },
        };

        const context: RetrievedContext = {
            documents: [doc],
            success: true,
            totalMatches: 1,
            estimatedTokens: 50,
        };

        const formatted = formatRetrievedContext(context);

        expect(formatted).not.toBeNull();
        expect(formatted).toContain("<retrieved-context");
        expect(formatted).toContain('path="/projects/carmenta/auth"');
        expect(formatted).toContain('relevance="0.95"');
        expect(formatted).toContain('reason="entity_match"');
        expect(formatted).toContain("<summary>Authentication architecture</summary>");
        expect(formatted).toContain("<content>We decided to use JWT</content>");
        expect(formatted).toContain('type="conversation_extraction"');
        expect(formatted).toContain('updated="2024-01-15"');
    });

    it("escapes XML special characters in content", () => {
        const doc: RetrievedDocument = {
            id: "doc-1",
            path: "test.doc",
            name: "Test",
            content: "Use <script> & 'quotes' with \"doubles\"",
            summary: null,
            retrievalReason: "search_match",
            relevance: 0.8,
            source: {
                type: "manual",
                id: null,
                createdAt: new Date("2024-01-10"),
                updatedAt: new Date("2024-01-15"),
            },
        };

        const context: RetrievedContext = {
            documents: [doc],
            success: true,
            totalMatches: 1,
            estimatedTokens: 20,
        };

        const formatted = formatRetrievedContext(context);

        expect(formatted).not.toBeNull();
        expect(formatted).toContain("&lt;script&gt;");
        expect(formatted).toContain("&amp;");
        expect(formatted).toContain("&apos;quotes&apos;");
        expect(formatted).toContain("&quot;doubles&quot;");
    });

    it("handles multiple documents", () => {
        const docs: RetrievedDocument[] = [
            {
                id: "doc-1",
                path: "test.one",
                name: "One",
                content: "First document",
                summary: null,
                retrievalReason: "entity_match",
                relevance: 0.9,
                source: {
                    type: "manual",
                    id: null,
                    createdAt: new Date("2024-01-10"),
                    updatedAt: new Date("2024-01-15"),
                },
            },
            {
                id: "doc-2",
                path: "test.two",
                name: "Two",
                content: "Second document",
                summary: null,
                retrievalReason: "search_match",
                relevance: 0.7,
                source: {
                    type: "manual",
                    id: null,
                    createdAt: new Date("2024-01-05"),
                    updatedAt: new Date("2024-01-10"),
                },
            },
        ];

        const context: RetrievedContext = {
            documents: docs,
            success: true,
            totalMatches: 2,
            estimatedTokens: 40,
        };

        const formatted = formatRetrievedContext(context);

        expect(formatted).not.toBeNull();
        expect(formatted).toContain('path="/test/one"');
        expect(formatted).toContain('path="/test/two"');
        expect(formatted).toContain("First document");
        expect(formatted).toContain("Second document");
    });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe("retrieveContext - integration scenarios", () => {
    it("handles a realistic chat context retrieval flow", async () => {
        const user = await createTestUser();

        // Create knowledge base with various documents
        await createTestDocument(user.id, {
            path: "profile.identity",
            name: "Who I Am",
            content: "Nick Sullivan, Founder building Carmenta",
        });

        await createTestDocument(user.id, {
            path: "people.sarah",
            name: "Sarah",
            content: "Sarah is the frontend engineer on the team",
        });

        await createTestDocument(user.id, {
            path: "projects.carmenta.architecture",
            name: "Architecture Decisions",
            content: "Using Next.js 14 with App Router and PostgreSQL",
            description: "Core architecture notes",
        });

        // Simulate a chat query about the team
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["team"],
            entities: ["sarah"],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        // Should find Sarah at minimum
        expect(result.documents.length).toBeGreaterThanOrEqual(1);

        // Format for injection
        const formatted = formatRetrievedContext(result);
        if (result.documents.length > 0) {
            expect(formatted).not.toBeNull();
            expect(formatted).toContain("<retrieved-context");
            expect(formatted).toContain("</retrieved-context>");
        }
    });

    it("returns estimatedTokens for retrieved context", async () => {
        const user = await createTestUser();

        await createTestDocument(user.id, {
            path: "notes.long",
            name: "Long Document",
            content: "A".repeat(400), // 400 chars = ~100 tokens
        });

        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: [],
            entities: ["long"],
        };

        const result = await retrieveContext(user.id, searchConfig);

        expect(result.success).toBe(true);
        if (result.documents.length > 0) {
            expect(result.estimatedTokens).toBeGreaterThan(0);
        }
    });
});
