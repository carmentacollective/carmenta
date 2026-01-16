/**
 * Types for entity mode interactions (@carmenta mentions)
 *
 * Entity mode is when users talk directly TO Carmenta about herself -
 * filing bugs, giving feedback, suggesting features, or asking for help.
 */

/**
 * Intent types that @carmenta can handle
 */
export type EntityIntentType =
    | "bug_report"
    | "feedback"
    | "suggestion"
    | "help"
    | "none";

/**
 * Confidence levels for intent detection
 */
export type IntentConfidence = "high" | "medium" | "low";

/**
 * Entity intent detected by the concierge
 */
export interface EntityIntent {
    /** The type of entity interaction */
    type: EntityIntentType;

    /** How confident we are in this classification */
    confidence: IntentConfidence;

    /** Extracted details for the handler */
    details?: {
        /** Title/summary extracted from the message */
        title?: string;
        /** Full description */
        description?: string;
        /** Keywords for duplicate search */
        keywords?: string[];
        /** Category (for feedback/suggestions) */
        category?: string;
        /** Sentiment (for feedback) */
        sentiment?: "positive" | "negative" | "neutral";
    };
}

/**
 * Context available to entity handlers
 */
export interface EntityHandlerContext {
    /** User ID for rate limiting */
    userId: string;

    /** Recent messages for context inclusion */
    recentMessages?: string;

    /** Last error from the session (if any) */
    lastError?: string;

    /** User agent for browser info */
    userAgent?: string;

    /** Connection ID for linking */
    connectionId?: string;
}

/**
 * Response from an entity handler
 *
 * Following the pattern of structured returns, not throws.
 */
export interface EntityResponse {
    /** The message to show the user */
    text: string;

    /** Whether this was an error response */
    isError?: boolean;

    /** GitHub issue link (if created or found) */
    issueUrl?: string;

    /** Issue number (if created or found) */
    issueNumber?: number;
}

/**
 * Entity handler function signature
 */
export type EntityHandler = (
    intent: EntityIntent,
    context: EntityHandlerContext
) => Promise<EntityResponse>;
