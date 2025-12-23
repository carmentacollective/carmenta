/**
 * Main ingestion engine orchestration
 * Coordinates the retrieval-augmented ingestion pipeline
 */

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { preExtract } from "./extraction/pre-extract";
import { evaluateForIngestion } from "./extraction/evaluate";
import { searchKnowledge } from "@/lib/kb/search";
import { determinePath } from "./storage/paths";
import { checkDuplication } from "./storage/dedup";
import { resolveConflict } from "./storage/conflicts";
import { storeDocument } from "./storage/store";
import type {
    RawContent,
    IngestionResult,
    StorageResult,
    IngestableItem,
} from "./types";
import type { ExistingDocument } from "./extraction/prompts";

/**
 * Main ingestion pipeline using retrieval-augmented pattern
 *
 * Flow:
 * 1. Pre-extraction: Quick entity/keyword pull (Haiku)
 * 2. KB Search: Find related existing documents
 * 3. Evaluation: Informed ingestion decision (Sonnet)
 * 4. Storage: Path determination, dedup, conflict resolution, write
 */
export async function ingest(
    userId: string,
    rawContent: RawContent
): Promise<StorageResult[]> {
    const startTime = Date.now();

    try {
        // Step 1: Pre-extraction - identify what to search for
        logger.debug({ sourceType: rawContent.sourceType }, "Starting pre-extraction");
        const extracted = await preExtract(rawContent.content);

        // Step 2: KB Search - find related existing documents
        logger.debug(
            {
                entities: extracted.people.concat(extracted.projects),
                topics: extracted.topics,
            },
            "Searching for related knowledge"
        );

        // Limit array sizes before concatenation to prevent memory spikes
        const searchQuery = [
            ...extracted.topics.slice(0, 10),
            ...extracted.people.slice(0, 10),
            ...extracted.projects.slice(0, 10),
        ]
            .join(" ")
            .slice(0, 200); // Limit query length

        const searchResponse = await searchKnowledge(userId, searchQuery, {
            entities: [
                ...extracted.people.slice(0, 10),
                ...extracted.projects.slice(0, 10),
            ],
            maxResults: 10,
            includeContent: true,
        });

        // Transform search results to ExistingDocument format
        const relatedDocs: ExistingDocument[] = searchResponse.results.map(
            (result) => ({
                path: result.path,
                name: result.name,
                content: result.content,
                summary: result.description ?? undefined,
            })
        );

        logger.info(
            { relatedDocsCount: relatedDocs.length },
            "Found related documents for context"
        );

        // Step 3: Evaluation - informed ingestion decision
        const evaluationResult = await evaluateForIngestion(rawContent, relatedDocs);

        if (!evaluationResult.shouldIngest || evaluationResult.items.length === 0) {
            logger.info(
                { reasoning: evaluationResult.reasoning },
                "No content to ingest"
            );
            return [];
        }

        // Step 4: Storage - path determination, dedup, conflict resolution, write
        const results: StorageResult[] = [];

        for (const item of evaluationResult.items) {
            try {
                logger.info(
                    { category: item.category, confidence: item.confidence },
                    "Processing item for storage"
                );

                // 4a. Determine storage path
                const path = await determinePath(item, userId);

                // 4b. Check for duplicates
                const dedupResult = await checkDuplication(userId, item, path);

                // 4c. Resolve conflicts if detected by evaluation
                const conflict = evaluationResult.conflicts.find(
                    (c) => c.newFact === item.content
                );

                let finalAction = dedupResult.action;

                if (conflict && dedupResult.existingDoc) {
                    // Conflict detected - use conflict resolution logic
                    const resolution = resolveConflict(
                        item,
                        {
                            id: dedupResult.existingDoc.id,
                            path: dedupResult.existingDoc.path,
                            content: dedupResult.existingDoc.content,
                            sourceType: dedupResult.existingDoc.sourceType,
                            updatedAt: dedupResult.existingDoc.updatedAt,
                        },
                        conflict
                    );

                    // Map resolution to action
                    if (resolution === "update") finalAction = "update";
                    else if (resolution === "merge") finalAction = "merge";
                    else if (resolution === "skip") {
                        logger.info(
                            { path, conflict: conflict.reasoning },
                            "Skipping due to conflict resolution"
                        );
                        continue; // Skip this item
                    }
                    // "flag" means proceed but log warning
                    else if (resolution === "flag") {
                        logger.warn(
                            { path, conflict: conflict.reasoning },
                            "⚠️ Conflict flagged for user review - proceeding with storage"
                        );
                    }
                }

                // 4d. Store document
                // Use existing doc's path if updating/merging, otherwise use proposed path
                const finalPath =
                    dedupResult.existingDoc && finalAction !== "create"
                        ? dedupResult.existingDoc.path
                        : path;

                const result = await storeDocument(
                    userId,
                    item,
                    finalPath,
                    finalAction,
                    dedupResult.existingDoc?.id
                );

                results.push(result);
            } catch (error) {
                logger.error({ error, item: item.summary }, "Failed to store item");
                Sentry.captureException(error, {
                    tags: { component: "ingestion", action: "store" },
                    extra: { userId, item },
                });

                // Add failed result
                results.push({
                    success: false,
                    path: item.suggestedPath ?? "",
                    action: "create",
                    documentId: "",
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        const duration = Date.now() - startTime;
        logger.info(
            {
                itemsProcessed: evaluationResult.items.length,
                itemsStored: results.filter((r) => r.success).length,
                durationMs: duration,
            },
            "Ingestion completed"
        );

        return results;
    } catch (error) {
        logger.error({ error, sourceType: rawContent.sourceType }, "Ingestion failed");
        Sentry.captureException(error, {
            tags: { component: "ingestion", action: "pipeline" },
            extra: { userId, sourceType: rawContent.sourceType },
        });
        throw error;
    }
}

/**
 * Ingest from conversation messages
 * Convenience wrapper for the follow-up engine
 */
export async function ingestFromConversation(
    userId: string,
    userMessages: string[],
    assistantMessages: string[],
    conversationId: string
): Promise<StorageResult[]> {
    const rawContent: RawContent = {
        content: formatConversation(userMessages, assistantMessages),
        sourceType: "conversation",
        sourceId: conversationId,
        timestamp: new Date(),
        metadata: {
            messageCount: userMessages.length + assistantMessages.length,
        },
    };

    return ingest(userId, rawContent);
}

/**
 * Helper to format conversation messages
 */
function formatConversation(
    userMessages: string[],
    assistantMessages: string[]
): string {
    const messages = [];
    for (let i = 0; i < Math.max(userMessages.length, assistantMessages.length); i++) {
        if (i < userMessages.length) {
            messages.push(`User: ${userMessages[i]}`);
        }
        if (i < assistantMessages.length) {
            messages.push(`Assistant: ${assistantMessages[i]}`);
        }
    }
    return messages.join("\n\n");
}
