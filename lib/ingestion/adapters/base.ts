/**
 * Base interface for ingestion adapters
 * Each source (conversation, limitless, fireflies, etc.) implements this
 */

import type { RawContent, IngestableItem } from "../types";

export interface IngestionAdapter {
    /**
     * Service identifier
     */
    readonly serviceId: string;

    /**
     * Fetch new content since last sync
     * @param userEmail - User's email address
     * @param since - Optional timestamp to fetch content after
     */
    fetchNewContent(userEmail: string, since?: Date): Promise<RawContent[]>;

    /**
     * Transform raw content to ingestable items
     * This is source-specific - conversations vs meetings vs emails need different handling
     * @param raw - Raw content from the source
     */
    transformContent(raw: RawContent): Promise<IngestableItem[]>;

    /**
     * Get last successful sync time for this user
     * Used for incremental syncing
     */
    getLastSyncTime(userEmail: string): Promise<Date | null>;

    /**
     * Update sync timestamp after successful sync
     */
    updateSyncTime(userEmail: string, time: Date): Promise<void>;
}
