/**
 * Conflict resolution for knowledge base ingestion
 *
 * When new information conflicts with existing knowledge, determines
 * the appropriate action based on authority hierarchy and recency.
 */

import { logger } from "@/lib/logger";
import type {
    IngestableItem,
    ConflictResolution,
    SourceType,
    ConflictDetection,
} from "../types";

/**
 * Authority hierarchy for source types (higher number = more authoritative)
 */
const AUTHORITY_LEVELS: Record<SourceType, number> = {
    user_explicit: 100, // User directly commanded it
    notion: 80, // Deliberate documentation
    fireflies: 70, // Meeting decisions
    limitless: 70, // Meeting decisions
    gmail: 60, // Email communications
    calendar: 50, // Scheduled events
    conversation: 40, // Chat with AI
};

/**
 * Get authority level for a source type
 */
function getAuthorityLevel(sourceType: SourceType): number {
    return AUTHORITY_LEVELS[sourceType] ?? 30; // Default low authority
}

interface ExistingDocument {
    id: string;
    path: string;
    content: string;
    sourceType: SourceType;
    updatedAt: Date;
}

/**
 * Resolve conflict between new item and existing document
 *
 * Resolution strategy:
 * 1. Authority hierarchy: Higher authority source wins
 * 2. Recency: If equal authority, newer wins
 * 3. Explicit user input always wins
 * 4. When uncertain, flag for user review
 *
 * @param newItem - The new item to ingest
 * @param existingDoc - The existing conflicting document
 * @param conflict - The detected conflict from evaluation
 * @returns Conflict resolution decision
 */
export function resolveConflict(
    newItem: IngestableItem,
    existingDoc: ExistingDocument,
    conflict: ConflictDetection
): ConflictResolution {
    const newAuthority = getAuthorityLevel(newItem.sourceType);
    const existingAuthority = getAuthorityLevel(existingDoc.sourceType);

    logger.debug(
        {
            newSource: newItem.sourceType,
            newAuthority,
            existingSource: existingDoc.sourceType,
            existingAuthority,
            conflictPath: existingDoc.path,
        },
        "⚖️ Resolving knowledge conflict"
    );

    // User explicit always wins
    if (newItem.sourceType === "user_explicit") {
        logger.info(
            { path: existingDoc.path },
            "✅ User explicit input - updating existing"
        );
        return "update";
    }

    // Higher authority wins
    if (newAuthority > existingAuthority) {
        logger.info(
            {
                newSource: newItem.sourceType,
                existingSource: existingDoc.sourceType,
                path: existingDoc.path,
            },
            "✅ New source has higher authority - updating"
        );
        return "update";
    }

    if (newAuthority < existingAuthority) {
        logger.info(
            {
                newSource: newItem.sourceType,
                existingSource: existingDoc.sourceType,
                path: existingDoc.path,
            },
            "⏭️ Existing source has higher authority - skipping"
        );
        return "skip";
    }

    // Equal authority - check recency
    const newTimestamp = newItem.timestamp.getTime();
    const existingTimestamp = existingDoc.updatedAt.getTime();

    // If new content is more recent, update
    if (newTimestamp > existingTimestamp) {
        const daysDiff = Math.floor(
            (newTimestamp - existingTimestamp) / (1000 * 60 * 60 * 24)
        );

        logger.info(
            {
                daysDiff,
                path: existingDoc.path,
            },
            "✅ New content is more recent - updating"
        );
        return "update";
    }

    // Existing is more recent - but might want to merge
    const daysDiff = Math.floor(
        (existingTimestamp - newTimestamp) / (1000 * 60 * 60 * 24)
    );

    // If very close in time (within 7 days), consider merging
    if (daysDiff <= 7) {
        logger.info(
            {
                daysDiff,
                path: existingDoc.path,
            },
            "🔀 Content is recent and similar - merging"
        );
        return "merge";
    }

    // Older content with equal authority - flag for review
    logger.info(
        {
            daysDiff,
            path: existingDoc.path,
        },
        "🚩 Conflict requires user review"
    );
    return "flag";
}

/**
 * Determine if two pieces of content are actually conflicting
 * or just related/complementary
 *
 * This is a heuristic check - the main conflict detection happens
 * in the LLM evaluation phase.
 */
export function isActualConflict(newContent: string, existingContent: string): boolean {
    // Extract factual claims (simplified heuristic)
    const newClaims = extractClaims(newContent);
    const existingClaims = extractClaims(existingContent);

    // Check for contradicting claims
    for (const newClaim of newClaims) {
        for (const existingClaim of existingClaims) {
            if (areContradictory(newClaim, existingClaim)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Extract factual claims from text (simplified)
 */
function extractClaims(text: string): string[] {
    // Split into sentences
    const sentences = text
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

    // Filter to declarative statements (contains is/are/was/were)
    return sentences.filter((s) =>
        /\b(is|are|was|were|has|have|will|would)\b/i.test(s)
    );
}

/**
 * Check if two claims contradict each other (simplified heuristic)
 */
function areContradictory(claim1: string, claim2: string): boolean {
    const normalized1 = claim1.toLowerCase();
    const normalized2 = claim2.toLowerCase();

    // Check for negation patterns
    const hasNot1 = /\b(not|no|never|doesn't|don't|isn't|aren't)\b/.test(normalized1);
    const hasNot2 = /\b(not|no|never|doesn't|don't|isn't|aren't)\b/.test(normalized2);

    // If one is negated and one isn't, and they share key terms, likely contradictory
    if (hasNot1 !== hasNot2) {
        const words1 = new Set(normalized1.split(/\s+/).filter((w) => w.length > 4));
        const words2 = new Set(normalized2.split(/\s+/).filter((w) => w.length > 4));

        const commonWords = [...words1].filter((w) => words2.has(w));

        // If they share significant terms, likely contradictory
        if (commonWords.length >= 2) {
            return true;
        }
    }

    return false;
}

/**
 * Format conflict for user notification
 */
export function formatConflictMessage(
    conflict: ConflictDetection,
    resolution: ConflictResolution
): string {
    const action = {
        update: "Updating existing knowledge",
        merge: "Merging with existing knowledge",
        flag: "Flagged for your review",
        skip: "Keeping existing knowledge",
    }[resolution];

    return `${action}: "${conflict.existingPath}"\nReason: ${conflict.reasoning}`;
}
