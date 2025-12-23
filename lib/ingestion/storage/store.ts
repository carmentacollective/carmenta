/**
 * Knowledge base write operations for ingestion
 *
 * Handles create/update/merge actions based on deduplication results.
 * Uses existing lib/kb module for actual KB operations.
 */

import * as Sentry from "@sentry/nextjs";

import { create, update, read } from "@/lib/kb";
import { logger } from "@/lib/logger";
import type {
    IngestableItem,
    DeduplicationAction,
    StorageResult,
    SourceType,
} from "../types";
import type { Document } from "@/lib/db/schema";

/**
 * Map ingestion SourceType to document source type enum
 * The document enum uses more specific values like "conversation_extraction"
 */
function mapSourceType(sourceType: SourceType): Document["sourceType"] {
    const mapping: Record<SourceType, Document["sourceType"]> = {
        conversation: "conversation_extraction",
        limitless: "integration_limitless",
        fireflies: "integration_fireflies",
        notion: "integration_notion",
        gmail: "integration_gmail",
        calendar: "manual", // Calendar maps to manual (no integration_calendar type yet)
        user_explicit: "manual",
    };
    const result = mapping[sourceType];
    if (!result) {
        logger.warn(
            { sourceType },
            "Unknown source type in store - defaulting to manual"
        );
        return "manual";
    }
    return result;
}

/**
 * Store an ingestable item in the knowledge base
 *
 * Handles three actions:
 * - create: New document
 * - update: Replace existing document
 * - merge: Combine with existing document
 *
 * @param userId - User ID
 * @param item - Item to store
 * @param path - Storage path
 * @param action - Deduplication action
 * @param existingDocId - ID of existing doc (for update/merge)
 * @returns Storage result with success status
 */
export async function storeDocument(
    userId: string,
    item: IngestableItem,
    path: string,
    action: DeduplicationAction,
    existingDocId?: string
): Promise<StorageResult> {
    return Sentry.startSpan(
        { op: "ingestion.store", name: "Store document in KB" },
        async (span) => {
            try {
                span.setAttribute("action", action);
                span.setAttribute("path", path);
                span.setAttribute("category", item.category);

                logger.info(
                    {
                        action,
                        path,
                        category: item.category,
                        summary: item.summary,
                        existingDocId,
                    },
                    `💾 Storing document (${action})`
                );

                let documentId: string;

                switch (action) {
                    case "create":
                        documentId = await createDocument(userId, item, path);
                        break;

                    case "update":
                        if (!existingDocId) {
                            throw new Error("Missing existingDocId for update action");
                        }
                        documentId = await updateDocument(userId, item, path);
                        break;

                    case "merge":
                        if (!existingDocId) {
                            throw new Error("Missing existingDocId for merge action");
                        }
                        documentId = await mergeDocument(userId, item, path);
                        break;

                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                logger.info(
                    {
                        documentId,
                        path,
                        action,
                    },
                    "✅ Document stored successfully"
                );

                return {
                    success: true,
                    path,
                    action,
                    documentId,
                };
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    {
                        error: errorMessage,
                        path,
                        action,
                        category: item.category,
                    },
                    "Failed to store document"
                );

                Sentry.captureException(error, {
                    tags: {
                        component: "ingestion-store",
                        action,
                        category: item.category,
                    },
                    extra: {
                        path,
                        summary: item.summary,
                        existingDocId,
                    },
                });

                return {
                    success: false,
                    path,
                    action,
                    documentId: "",
                    error: errorMessage,
                };
            }
        }
    );
}

/**
 * Create a new document in KB
 */
async function createDocument(
    userId: string,
    item: IngestableItem,
    path: string
): Promise<string> {
    const document = await create(userId, {
        path,
        name: generateDocumentName(item),
        content: item.content,
        description: item.summary,
        sourceType: mapSourceType(item.sourceType),
        sourceId: item.sourceId,
        tags: extractTags(item),
        searchable: true,
        editable: true,
    });

    return document.id;
}

/**
 * Update an existing document in KB
 */
async function updateDocument(
    userId: string,
    item: IngestableItem,
    path: string
): Promise<string> {
    const updated = await update(userId, path, {
        content: item.content,
        name: generateDocumentName(item),
        tags: extractTags(item),
    });

    if (!updated) {
        throw new Error(`Failed to update document at ${path}`);
    }

    return updated.id;
}

/**
 * Merge new content with existing document
 */
async function mergeDocument(
    userId: string,
    item: IngestableItem,
    path: string
): Promise<string> {
    // Read existing document
    const existing = await read(userId, path);

    if (!existing) {
        // Existing doc not found - fall back to create
        logger.warn({ path }, "Existing document not found for merge - creating new");
        return createDocument(userId, item, path);
    }

    // Merge strategy: Append new content with separator
    const mergedContent = `${existing.content}

---

${item.content}`;

    // Merge tags (unique union)
    const mergedTags = Array.from(new Set([...existing.tags, ...extractTags(item)]));

    const updated = await update(userId, path, {
        content: mergedContent,
        tags: mergedTags,
    });

    if (!updated) {
        throw new Error(`Failed to merge document at ${path}`);
    }

    logger.debug({ path }, "📝 Content merged with existing document");

    return updated.id;
}

/**
 * Generate document name from item
 */
function generateDocumentName(item: IngestableItem): string {
    // Use primary entity + category for name
    const entity = item.entities.primaryEntity;
    const category = item.category;

    // Clean entity for use in filename
    const cleanEntity = entity
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();

    return `${cleanEntity}-${category}.txt`;
}

/**
 * Extract tags from item entities
 */
function extractTags(item: IngestableItem): string[] {
    const tags: string[] = [];

    // Add category as tag
    tags.push(item.category);

    // Add source type
    tags.push(item.sourceType);

    // Add key entities as tags
    if (item.entities.people.length > 0) {
        tags.push(...item.entities.people.slice(0, 3)); // Top 3 people
    }

    if (item.entities.projects.length > 0) {
        tags.push(...item.entities.projects.slice(0, 2)); // Top 2 projects
    }

    if (item.entities.technologies.length > 0) {
        tags.push(...item.entities.technologies.slice(0, 2)); // Top 2 technologies
    }

    // Deduplicate and normalize
    return Array.from(
        new Set(
            tags.map((tag) =>
                tag
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9-]/g, "")
            )
        )
    ).filter((tag) => tag.length > 0);
}
