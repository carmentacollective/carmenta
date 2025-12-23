/**
 * Limitless adapter - extracts knowledge from Limitless recordings
 *
 * TODO: Implement MCP Hubby integration when client module is available.
 * This adapter is a placeholder that defines the interface for Limitless ingestion.
 */

import { logger } from "@/lib/logger";
import type { IngestionAdapter } from "./base";
import type { RawContent, IngestableItem } from "../types";

export class LimitlessAdapter implements IngestionAdapter {
    readonly serviceId = "limitless";

    /**
     * Fetch new Limitless recordings since last sync
     *
     * TODO: Implement via MCP Hubby when available:
     * - Call limitless.list_recordings(startDate)
     * - For each recording, call limitless.get_transcript(lifelogId)
     */
    async fetchNewContent(userEmail: string, since?: Date): Promise<RawContent[]> {
        logger.warn(
            { userEmail, since },
            "Limitless adapter not yet implemented - MCP client integration pending"
        );

        // TODO: Implement when MCP client is available
        // Example implementation:
        // const recordings = await mcpClient.limitless.list_recordings({ startDate: since });
        // return Promise.all(recordings.map(async (recording) => {
        //     const transcript = await mcpClient.limitless.get_transcript({ lifelogId: recording.id });
        //     return { content: transcript, sourceType: "limitless", ... };
        // }));

        return [];
    }

    /**
     * Transform raw transcript to ingestable items
     * Note: The actual transformation happens in evaluate()
     * This adapter just validates and enriches the raw content
     */
    async transformContent(raw: RawContent): Promise<IngestableItem[]> {
        // Transformation happens in the evaluation step
        // This adapter is for fetching only
        return [];
    }

    async getLastSyncTime(userEmail: string): Promise<Date | null> {
        // TODO: Implement sync state tracking in database
        // For now, return null to fetch all recordings
        return null;
    }

    async updateSyncTime(userEmail: string, time: Date): Promise<void> {
        // TODO: Implement sync state tracking in database
        logger.debug({ userEmail, time }, "Limitless sync time updated");
    }
}
