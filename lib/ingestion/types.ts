/**
 * Core types for the knowledge ingestion engine
 */

export type IngestCategory =
    | "preference" // User likes/dislikes
    | "identity" // Facts about user
    | "relationship" // Info about people in user's life
    | "project" // Project context
    | "decision" // Architectural or life decisions
    | "reference" // Information to recall later
    | "meeting" // Meeting notes/summaries
    | "insight"; // Extracted wisdom

export type SourceType =
    | "conversation" // From chat with Carmenta
    | "limitless" // From Limitless Pendant
    | "fireflies" // From Fireflies.ai
    | "notion" // From Notion workspace
    | "gmail" // From Gmail
    | "calendar" // From Google Calendar
    | "user_explicit"; // User directly commanded storage

export type ConflictResolution = "update" | "merge" | "flag" | "skip";

export type DeduplicationAction = "create" | "update" | "merge";

export interface ExtractedEntities {
    people: string[];
    projects: string[];
    organizations: string[];
    technologies: string[];
    locations: string[];
    dates: string[];
    primaryEntity: string;
    primaryEntityType: "person" | "project" | "organization" | "technology" | "topic";
}

export interface CriteriaEvaluation {
    durability: { met: boolean; reason: string };
    uniqueness: { met: boolean; reason: string };
    retrievability: { met: boolean; reason: string };
    authority: { met: boolean; reason: string };
    criteriaMet: number;
    shouldIngest: boolean;
}

export interface IngestableItem {
    content: string; // Transformed atomic fact
    summary: string; // One-line description
    category: IngestCategory;
    entities: ExtractedEntities;
    confidence: number; // 0-1
    suggestedPath?: string;
    sourceType: SourceType;
    sourceId?: string; // External reference ID
    timestamp: Date;
}

export interface ConflictDetection {
    newFact: string;
    existingPath: string;
    existingFact: string;
    recommendation: ConflictResolution;
    reasoning: string;
}

export interface IngestionResult {
    shouldIngest: boolean;
    reasoning: string;
    criteria: CriteriaEvaluation;
    items: IngestableItem[];
    conflicts: ConflictDetection[];
}

export interface DeduplicationResult {
    action: DeduplicationAction;
    existingDoc?: {
        id: string;
        path: string;
        content: string;
        sourceType: SourceType;
        updatedAt: Date;
    };
    reasoning: string;
}

export interface StorageResult {
    success: boolean;
    path: string;
    action: DeduplicationAction;
    documentId: string;
    error?: string;
}

export interface PreExtractionResult {
    people: string[];
    projects: string[];
    topics: string[];
}

export interface RawContent {
    content: string;
    sourceType: SourceType;
    sourceId?: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
