/**
 * Types for import knowledge extraction
 */

import type { PendingExtraction, ExtractionJob } from "@/lib/db/schema";

export type ExtractionCategory =
    | "identity"
    | "preference"
    | "person"
    | "project"
    | "decision"
    | "expertise"
    | "voice";

export type ExtractionStatus = "pending" | "approved" | "rejected" | "edited";

/**
 * A single extracted fact from a conversation
 */
export interface ExtractedFact {
    /** Category for KB path routing */
    category: ExtractionCategory;
    /** The extracted fact/content */
    content: string;
    /** One-line summary for display */
    summary: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** Suggested KB path */
    suggestedPath: string;
    /** Source message ID if identifiable */
    sourceMessageId?: string;
    /** When user originally stated this */
    sourceTimestamp?: Date;
}

/**
 * Result from extracting knowledge from a single conversation
 */
export interface ConversationExtractionResult {
    connectionId: number;
    facts: ExtractedFact[];
    skipped: boolean;
    skipReason?: string;
}

/**
 * Result from the extraction LLM call
 */
export interface ExtractionLLMResult {
    shouldExtract: boolean;
    reasoning: string;
    facts: Array<{
        category: ExtractionCategory;
        content: string;
        summary: string;
        confidence: number;
        suggestedPath: string;
    }>;
}

/**
 * Job progress for real-time updates
 */
export interface ExtractionJobProgress {
    jobId: string;
    status: ExtractionJob["status"];
    totalConversations: number;
    processedConversations: number;
    extractedCount: number;
    currentConversation?: string;
}

/**
 * Review action for a pending extraction
 */
export interface ExtractionReviewAction {
    id: string;
    action: "approve" | "reject" | "edit";
    editedContent?: string;
}

/**
 * Stats for the extraction review UI
 */
export interface ExtractionStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    edited: number;
    byCategory: Record<ExtractionCategory, number>;
}

export type { PendingExtraction, ExtractionJob };
