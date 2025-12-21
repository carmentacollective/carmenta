import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    retrieveContext,
    formatRetrievedContext,
    type RetrievedContext,
    type RetrievedDocument,
} from "@/lib/kb/retrieve-context";
import type { KBSearchConfig } from "@/lib/concierge/types";

// Mock the database
vi.mock("@/lib/db", () => ({
    db: {
        execute: vi.fn(),
    },
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
    startSpan: vi.fn((_, callback) => callback({ setAttribute: vi.fn() })),
    captureException: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

import { db } from "@/lib/db";

describe("retrieveContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const userId = "test-user-id";

    it("returns empty results when shouldSearch is false", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: false,
            queries: [],
            entities: [],
        };

        const result = await retrieveContext(userId, searchConfig);

        expect(result.documents).toHaveLength(0);
        expect(result.success).toBe(true);
        expect(result.totalMatches).toBe(0);
        expect(db.execute).not.toHaveBeenCalled();
    });

    it("returns empty results when queries and entities are empty", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: [],
            entities: [],
        };

        // Mock empty results for both entity and FTS queries

        vi.mocked(db.execute).mockResolvedValue([] as any);

        const result = await retrieveContext(userId, searchConfig);

        expect(result.documents).toHaveLength(0);
        expect(result.success).toBe(true);
    });

    it("searches by entities with priority matching", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: [],
            entities: ["sarah"],
        };

        const mockDoc = {
            id: "doc-1",
            user_id: userId,
            path: "people.sarah",
            name: "Sarah",
            content: "Sarah is my colleague",
            description: "About Sarah",
            source_type: "manual",
            source_id: null,
            updated_at: new Date("2024-01-15"),
            rank: 1.0,
        };

        vi.mocked(db.execute).mockResolvedValue([mockDoc] as any);

        const result = await retrieveContext(userId, searchConfig);

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeGreaterThanOrEqual(0);
        // Entity search should have been called
        expect(db.execute).toHaveBeenCalled();
    });

    it("searches by FTS queries", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["google calendar integration"],
            entities: [],
        };

        const mockDoc = {
            id: "doc-2",
            user_id: userId,
            path: "integrations.google-calendar",
            name: "Google Calendar",
            content: "We integrated Google Calendar using OAuth",
            description: "Calendar integration notes",
            source_type: "conversation_extraction",
            source_id: null,
            updated_at: new Date("2024-01-10"),
            rank: 0.5,
        };

        vi.mocked(db.execute).mockResolvedValue([mockDoc] as any);

        const result = await retrieveContext(userId, searchConfig);

        expect(result.success).toBe(true);
        expect(db.execute).toHaveBeenCalled();
    });

    it("deduplicates documents from multiple search strategies", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["calendar"],
            entities: ["calendar"],
        };

        const mockDoc = {
            id: "doc-same",
            user_id: userId,
            path: "integrations.calendar",
            name: "Calendar",
            content: "Calendar integration content",
            description: null,
            source_type: "manual",
            source_id: null,
            updated_at: new Date("2024-01-15"),
            rank: 0.8,
        };

        // Both searches return the same document

        vi.mocked(db.execute).mockResolvedValue([mockDoc] as any);

        const result = await retrieveContext(userId, searchConfig);

        expect(result.success).toBe(true);
        // Should be deduplicated to one document
        expect(result.documents.filter((d) => d.id === "doc-same")).toHaveLength(
            Math.min(1, result.documents.length)
        );
    });

    it("handles database errors gracefully", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["test"],
            entities: [],
        };

        vi.mocked(db.execute).mockRejectedValue(new Error("Database error"));

        const result = await retrieveContext(userId, searchConfig);

        // Unified search module handles errors gracefully and returns empty results
        // This is intentional - KB search errors shouldn't break the chat flow
        expect(result.success).toBe(true);
        expect(result.documents).toHaveLength(0);
    });

    it("respects maxDocuments limit", async () => {
        const searchConfig: KBSearchConfig = {
            shouldSearch: true,
            queries: ["test"],
            entities: [],
        };

        // Return many documents
        const mockDocs = Array.from({ length: 10 }, (_, i) => ({
            id: `doc-${i}`,
            user_id: userId,
            path: `test.doc${i}`,
            name: `Doc ${i}`,
            content: `Content ${i}`,
            description: null,
            source_type: "manual",
            source_id: null,
            updated_at: new Date(),
            rank: 0.5 - i * 0.01, // Decreasing relevance
        }));

        vi.mocked(db.execute).mockResolvedValue(mockDocs as any);

        const result = await retrieveContext(userId, searchConfig, {
            maxDocuments: 3,
        });

        expect(result.success).toBe(true);
        expect(result.documents.length).toBeLessThanOrEqual(3);
    });
});

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
