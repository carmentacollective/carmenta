/**
 * Fireflies adapter - extracts knowledge from Fireflies meeting transcripts
 *
 * TODO: Implement MCP Hubby integration when client module is available.
 * This adapter is a placeholder that defines the interface for Fireflies ingestion.
 */

import { logger } from "@/lib/logger";
import type { IngestionAdapter } from "./base";
import type { RawContent, IngestableItem } from "../types";

export class FirefliesAdapter implements IngestionAdapter {
    readonly serviceId = "fireflies";

    /**
     * Fetch new Fireflies meetings since last sync
     *
     * TODO: Implement via MCP Hubby when available:
     * - Call fireflies.search_transcripts(query)
     * - For each transcript, call fireflies.get_transcript(transcriptId)
     */
    async fetchNewContent(userEmail: string, since?: Date): Promise<RawContent[]> {
        logger.warn(
            { userEmail, since },
            "Fireflies adapter not yet implemented - MCP client integration pending"
        );

        // TODO: Implement when MCP client is available
        // Example implementation:
        // const query = since ? `date:>${since.toISOString().split("T")[0]}` : "";
        // const transcripts = await mcpClient.fireflies.search_transcripts({ query });
        // return Promise.all(transcripts.map(async (t) => {
        //     const full = await mcpClient.fireflies.get_transcript({ transcriptId: t.id });
        //     return { content: full.text, sourceType: "fireflies", ... };
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
        // For now, return null to fetch all transcripts
        return null;
    }

    async updateSyncTime(userEmail: string, time: Date): Promise<void> {
        // TODO: Implement sync state tracking in database
        logger.debug({ userEmail, time }, "Fireflies sync time updated");
    }
}
