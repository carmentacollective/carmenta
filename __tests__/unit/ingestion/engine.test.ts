/**
 * Integration tests for the ingestion engine
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ingest, ingestFromConversation } from "@/lib/ingestion/engine";
import type { RawContent } from "@/lib/ingestion/types";

// Mock dependencies
vi.mock("@/lib/ingestion/extraction/pre-extract");
vi.mock("@/lib/ingestion/extraction/evaluate");
vi.mock("@/lib/kb/search");
vi.mock("@/lib/ingestion/storage/paths");
vi.mock("@/lib/ingestion/storage/dedup");
vi.mock("@/lib/ingestion/storage/conflicts");
vi.mock("@/lib/ingestion/storage/store");

describe("Ingestion Engine", () => {
    const userId = "test-user-id";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("ingest()", () => {
        it("should complete full pipeline for valid content", async () => {
            const rawContent: RawContent = {
                content: "Nick prefers TypeScript over JavaScript for new projects",
                sourceType: "conversation",
                sourceId: "conv-123",
                timestamp: new Date(),
            };

            const { preExtract } =
                await import("@/lib/ingestion/extraction/pre-extract");
            const { evaluateForIngestion } =
                await import("@/lib/ingestion/extraction/evaluate");
            const { searchKnowledge } = await import("@/lib/kb/search");
            const { determinePath } = await import("@/lib/ingestion/storage/paths");
            const { checkDuplication } = await import("@/lib/ingestion/storage/dedup");
            const { storeDocument } = await import("@/lib/ingestion/storage/store");

            // Mock pre-extraction
            vi.mocked(preExtract).mockResolvedValue({
                people: ["Nick"],
                projects: [],
                topics: ["TypeScript", "JavaScript"],
            });

            // Mock KB search
            vi.mocked(searchKnowledge).mockResolvedValue({
                results: [],
                metadata: { totalBeforeFiltering: 0, totalAfterFiltering: 0 },
            });

            // Mock evaluation
            vi.mocked(evaluateForIngestion).mockResolvedValue({
                shouldIngest: true,
                reasoning: "Durable preference worth storing",
                criteria: {
                    durability: { met: true, reason: "Long-term preference" },
                    uniqueness: { met: true, reason: "New information" },
                    retrievability: { met: true, reason: "Clear entities" },
                    authority: { met: true, reason: "Direct statement" },
                    criteriaMet: 4,
                    shouldIngest: true,
                },
                items: [
                    {
                        content:
                            "Nick prefers TypeScript over JavaScript for new projects",
                        summary: "TypeScript preference for new projects",
                        category: "preference",
                        entities: {
                            people: ["Nick"],
                            projects: [],
                            organizations: [],
                            technologies: ["TypeScript", "JavaScript"],
                            locations: [],
                            dates: [],
                            primaryEntity: "Nick",
                            primaryEntityType: "person",
                        },
                        confidence: 0.9,
                        sourceType: "conversation",
                        sourceId: "conv-123",
                        timestamp: new Date(),
                    },
                ],
                conflicts: [],
            });

            // Mock storage pipeline
            vi.mocked(determinePath).mockResolvedValue("profile.preferences");
            vi.mocked(checkDuplication).mockResolvedValue({
                action: "create",
                reasoning: "No duplicates found",
            });
            vi.mocked(storeDocument).mockResolvedValue({
                success: true,
                path: "profile.preferences",
                action: "create",
                documentId: "doc-123",
            });

            const results = await ingest(userId, rawContent);

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(results[0].path).toBe("profile.preferences");
            expect(preExtract).toHaveBeenCalledWith(rawContent.content);
            expect(evaluateForIngestion).toHaveBeenCalled();
            expect(storeDocument).toHaveBeenCalled();
        });

        it("should skip ingestion when criteria not met", async () => {
            const rawContent: RawContent = {
                content: "Weather is nice today",
                sourceType: "conversation",
                timestamp: new Date(),
            };

            const { preExtract } =
                await import("@/lib/ingestion/extraction/pre-extract");
            const { evaluateForIngestion } =
                await import("@/lib/ingestion/extraction/evaluate");
            const { searchKnowledge } = await import("@/lib/kb/search");

            vi.mocked(preExtract).mockResolvedValue({
                people: [],
                projects: [],
                topics: ["weather"],
            });

            vi.mocked(searchKnowledge).mockResolvedValue({
                results: [],
                metadata: { totalBeforeFiltering: 0, totalAfterFiltering: 0 },
            });

            vi.mocked(evaluateForIngestion).mockResolvedValue({
                shouldIngest: false,
                reasoning: "Ephemeral content not worth storing",
                criteria: {
                    durability: { met: false, reason: "Temporary state" },
                    uniqueness: { met: true, reason: "New" },
                    retrievability: { met: false, reason: "No clear entities" },
                    authority: { met: false, reason: "Casual mention" },
                    criteriaMet: 1,
                    shouldIngest: false,
                },
                items: [],
                conflicts: [],
            });

            const results = await ingest(userId, rawContent);

            expect(results).toHaveLength(0);
            expect(preExtract).toHaveBeenCalled();
            expect(evaluateForIngestion).toHaveBeenCalled();
        });

        it("should handle conflicts with existing knowledge", async () => {
            const rawContent: RawContent = {
                content: "Nick now prefers JavaScript over TypeScript",
                sourceType: "conversation",
                timestamp: new Date(),
            };

            const { preExtract } =
                await import("@/lib/ingestion/extraction/pre-extract");
            const { evaluateForIngestion } =
                await import("@/lib/ingestion/extraction/evaluate");
            const { searchKnowledge } = await import("@/lib/kb/search");
            const { determinePath } = await import("@/lib/ingestion/storage/paths");
            const { checkDuplication } = await import("@/lib/ingestion/storage/dedup");
            const { resolveConflict } =
                await import("@/lib/ingestion/storage/conflicts");
            const { storeDocument } = await import("@/lib/ingestion/storage/store");

            vi.mocked(preExtract).mockResolvedValue({
                people: ["Nick"],
                projects: [],
                topics: ["TypeScript", "JavaScript"],
            });

            vi.mocked(searchKnowledge).mockResolvedValue({
                results: [
                    {
                        id: "doc-existing",
                        path: "profile.preferences",
                        name: "typescript-preference.txt",
                        content: "Nick prefers TypeScript over JavaScript",
                        description: "TypeScript preference",
                        relevance: 0.9,
                        reason: "entity_match",
                        source: {
                            type: "conversation_extraction",
                            id: "conv-old",
                            createdAt: new Date("2024-01-01"),
                            updatedAt: new Date("2024-01-01"),
                        },
                        promptLabel: null,
                        editable: true,
                    },
                ],
                metadata: { totalBeforeFiltering: 1, totalAfterFiltering: 1 },
            });

            vi.mocked(evaluateForIngestion).mockResolvedValue({
                shouldIngest: true,
                reasoning: "Updated preference worth storing",
                criteria: {
                    durability: { met: true, reason: "Long-term preference" },
                    uniqueness: { met: true, reason: "Changed preference" },
                    retrievability: { met: true, reason: "Clear entities" },
                    authority: { met: true, reason: "Direct statement" },
                    criteriaMet: 4,
                    shouldIngest: true,
                },
                items: [
                    {
                        content: "Nick now prefers JavaScript over TypeScript",
                        summary: "JavaScript preference for new projects",
                        category: "preference",
                        entities: {
                            people: ["Nick"],
                            projects: [],
                            organizations: [],
                            technologies: ["TypeScript", "JavaScript"],
                            locations: [],
                            dates: [],
                            primaryEntity: "Nick",
                            primaryEntityType: "person",
                        },
                        confidence: 0.9,
                        sourceType: "conversation",
                        timestamp: new Date(),
                    },
                ],
                conflicts: [
                    {
                        newFact: "Nick now prefers JavaScript over TypeScript",
                        existingPath: "profile.preferences",
                        existingFact: "Nick prefers TypeScript over JavaScript",
                        recommendation: "update",
                        reasoning: "More recent preference statement",
                    },
                ],
            });

            vi.mocked(determinePath).mockResolvedValue("profile.preferences");
            vi.mocked(checkDuplication).mockResolvedValue({
                action: "update",
                existingDoc: {
                    id: "doc-existing",
                    path: "profile.preferences",
                    content: "Nick prefers TypeScript over JavaScript",
                    sourceType: "conversation",
                    updatedAt: new Date("2024-01-01"),
                },
                reasoning: "Found conflicting preference",
            });

            vi.mocked(resolveConflict).mockReturnValue("update");

            vi.mocked(storeDocument).mockResolvedValue({
                success: true,
                path: "profile.preferences",
                action: "update",
                documentId: "doc-existing",
            });

            const results = await ingest(userId, rawContent);

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(results[0].action).toBe("update");
            expect(resolveConflict).toHaveBeenCalled();
        });
    });

    describe("ingestFromConversation()", () => {
        it("should format conversation messages correctly", async () => {
            const { preExtract } =
                await import("@/lib/ingestion/extraction/pre-extract");
            const { evaluateForIngestion } =
                await import("@/lib/ingestion/extraction/evaluate");
            const { searchKnowledge } = await import("@/lib/kb/search");

            vi.mocked(preExtract).mockResolvedValue({
                people: [],
                projects: [],
                topics: [],
            });

            vi.mocked(searchKnowledge).mockResolvedValue({
                results: [],
                metadata: { totalBeforeFiltering: 0, totalAfterFiltering: 0 },
            });

            vi.mocked(evaluateForIngestion).mockResolvedValue({
                shouldIngest: false,
                reasoning: "Test",
                criteria: {
                    durability: { met: false, reason: "" },
                    uniqueness: { met: false, reason: "" },
                    retrievability: { met: false, reason: "" },
                    authority: { met: false, reason: "" },
                    criteriaMet: 0,
                    shouldIngest: false,
                },
                items: [],
                conflicts: [],
            });

            await ingestFromConversation(
                userId,
                ["User message 1", "User message 2"],
                ["Assistant message 1", "Assistant message 2"],
                "conv-123"
            );

            expect(preExtract).toHaveBeenCalledWith(
                expect.stringContaining("User: User message 1")
            );
            expect(preExtract).toHaveBeenCalledWith(
                expect.stringContaining("Assistant: Assistant message 1")
            );
        });
    });
});
