/**
 * Knowledge Ingestion Engine
 * Public API exports
 */

// Core engine
export { ingest, ingestFromConversation } from "./engine";

// Types
export type {
    IngestCategory,
    SourceType,
    ExtractedEntities,
    IngestableItem,
    IngestionResult,
    StorageResult,
    RawContent,
    DeduplicationAction,
    ConflictResolution,
} from "./types";

// Adapters
export { ConversationAdapter, LimitlessAdapter, FirefliesAdapter } from "./adapters";
export type { IngestionAdapter } from "./adapters";

// Triggers
export {
    triggerFollowUpIngestion,
    runScheduledSync,
    syncAllServices,
} from "./triggers";
export type { FollowUpIngestionConfig, SyncConfig } from "./triggers";
