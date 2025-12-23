/**
 * Deduplication logic for knowledge base ingestion
 *
 * Checks if content already exists and determines the appropriate action:
 * - create: New document
 * - update: Replace existing document
 * - merge: Combine with existing document
 */

import { searchKnowledge } from "@/lib/kb/search";
import { read } from "@/lib/kb";
import { logger } from "@/lib/logger";
import type { Document } from "@/lib/db/schema";
import type { IngestableItem, DeduplicationResult, SourceType } from "../types";

/**
 * Map DB sourceType enum back to ingestion SourceType
 *
 * NOTE: `manual` maps to `calendar` not `user_explicit` because both calendar
 * and user_explicit store as `manual` in the DB (no integration_calendar type yet).
 * We default to calendar (authority 50) rather than user_explicit (authority 100)
 * to avoid false authority inflation. This means user_explicit items lose their
 * authority after storage - acceptable for MVP.
 */
function mapDbSourceType(dbSourceType: Document["sourceType"]): SourceType {
    const mapping: Partial<Record<Document["sourceType"], SourceType>> = {
        conversation_extraction: "conversation",
        conversation_decision: "conversation",
        conversation_commitment: "conversation",
        integration_limitless: "limitless",
        integration_fireflies: "fireflies",
        integration_gmail: "gmail",
        integration_notion: "notion",
        manual: "calendar", // Conservative: calendar not user_explicit (avoids authority inflation)
    };
    const result = mapping[dbSourceType];
    if (!result) {
        logger.warn(
            { dbSourceType },
            "Unknown DB source type in dedup - defaulting to conversation"
        );
        return "conversation";
    }
    return result;
}

/**
 * Check if an item is a duplicate and determine action
 *
 * Deduplication strategy:
 * 1. Check by sourceId first (exact external ID match)
 * 2. Check by entity + category match via KB search
 * 3. Determine action based on similarity and recency
 *
 * @param userId - User ID for KB search
 * @param item - Item to check for duplication
 * @param path - Proposed storage path
 * @returns Deduplication result with action and existing doc if found
 */
export async function checkDuplication(
    userId: string,
    item: IngestableItem,
    path: string
): Promise<DeduplicationResult> {
    logger.debug(
        {
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            path,
            summary: item.summary,
        },
        "🔍 Checking for duplicates"
    );

    // Step 1: Check by path first (most reliable)
    // If path already exists, we should update it
    const existingByPath = await read(userId, path);
    if (existingByPath) {
        logger.info(
            {
                path,
                existingId: existingByPath.id,
            },
            "🔗 Found existing document at path"
        );

        return {
            action: "update",
            existingDoc: {
                id: existingByPath.id,
                path: existingByPath.path,
                content: existingByPath.content,
                sourceType: mapDbSourceType(existingByPath.sourceType),
                updatedAt: existingByPath.updatedAt,
            },
            reasoning: `Found existing document at path ${path}`,
        };
    }

    // Step 2: Check by entity + category match
    const searchQuery = buildDedupeSearchQuery(item);
    const { results } = await searchKnowledge(userId, searchQuery, {
        entities: [item.entities.primaryEntity],
        maxResults: 5,
        minRelevance: 0.5,
        includeContent: true,
    });

    // Filter to same category
    const categoryMatches = results.filter((doc) => {
        // Extract category from path (rough heuristic)
        const pathCategory = inferCategoryFromPath(doc.path);
        return pathCategory === item.category;
    });

    if (categoryMatches.length === 0) {
        logger.debug("✨ No duplicates found - new document");
        return {
            action: "create",
            reasoning: "No similar documents found in knowledge base",
        };
    }

    // Get the most relevant match
    const bestMatch = categoryMatches[0];

    // Check similarity - if very similar and recent, it's likely a duplicate
    const similarity = calculateSimilarity(item.content, bestMatch.content);

    if (similarity > 0.8) {
        logger.info(
            {
                existingPath: bestMatch.path,
                similarity,
            },
            "🔄 High similarity - update existing"
        );

        return {
            action: "update",
            existingDoc: {
                id: bestMatch.id,
                path: bestMatch.path,
                content: bestMatch.content,
                sourceType: mapDbSourceType(bestMatch.source.type),
                updatedAt: bestMatch.source.updatedAt,
            },
            reasoning: `Found very similar document (${Math.round(similarity * 100)}% similar) at ${bestMatch.path}`,
        };
    }

    // Moderate similarity - might be related but different
    if (similarity > 0.5) {
        logger.info(
            {
                existingPath: bestMatch.path,
                similarity,
            },
            "🔀 Moderate similarity - merge candidate"
        );

        return {
            action: "merge",
            existingDoc: {
                id: bestMatch.id,
                path: bestMatch.path,
                content: bestMatch.content,
                sourceType: mapDbSourceType(bestMatch.source.type),
                updatedAt: bestMatch.source.updatedAt,
            },
            reasoning: `Found related document (${Math.round(similarity * 100)}% similar) - may need merging`,
        };
    }

    // Low similarity - different content
    logger.debug("✨ No strong matches - new document");
    return {
        action: "create",
        reasoning: "Found related documents but content is sufficiently different",
    };
}

/**
 * Build search query optimized for finding duplicates
 */
function buildDedupeSearchQuery(item: IngestableItem): string {
    const parts: string[] = [];

    // Primary entity is key
    parts.push(item.entities.primaryEntity);

    // Add category-specific terms
    parts.push(item.category);

    // Add key terms from summary
    const summaryWords = item.summary
        .split(" ")
        .filter((word) => word.length > 3) // Skip short words
        .slice(0, 5);
    parts.push(...summaryWords);

    return parts.join(" ");
}

/**
 * Infer category from KB path (rough heuristic)
 */
function inferCategoryFromPath(path: string): string {
    if (path.startsWith("profile.preferences")) return "preference";
    if (path.startsWith("profile.identity")) return "identity";
    if (path.startsWith("profile.people")) return "relationship";
    if (path.includes("projects")) return "project";
    if (path.includes("decisions")) return "decision";
    if (path.includes("meetings")) return "meeting";
    if (path.includes("insights")) return "insight";
    return "reference";
}

/**
 * Calculate similarity between two text strings
 * Uses a simple word overlap metric (Jaccard similarity)
 *
 * For production, consider using embeddings for semantic similarity
 */
function calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(
        text1
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
    );
    const words2 = new Set(
        text2
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
    );

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
}
