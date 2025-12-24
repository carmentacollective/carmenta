/**
 * Fireflies Ingestion Adapter
 *
 * Pulls meeting transcripts from Fireflies.ai and transforms them into
 * RawContent for the ingestion pipeline. Transcripts are rich sources of:
 * - Decisions made in meetings
 * - Action items and commitments
 * - Project context and updates
 * - Relationship information (who works on what)
 *
 * Data flow:
 * 1. Fetch transcripts since last sync (or all if first sync)
 * 2. For each transcript, extract full content with summaries
 * 3. Transform to RawContent with rich metadata
 * 4. Update sync timestamp on success
 */

import { db, schema } from "@/lib/db";
import { httpClient } from "@/lib/http-client";
import { logger } from "@/lib/logger";
import { getCredentials } from "@/lib/integrations/connection-manager";
import { isApiKeyCredentials } from "@/lib/integrations/encryption";
import { eq, and } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import type { IngestionAdapter } from "./base";
import type { RawContent, IngestableItem } from "../types";

const FIREFLIES_API_BASE = "https://api.fireflies.ai/graphql";

/**
 * Fireflies transcript shape from GraphQL API
 */
interface FirefliesTranscript {
    id: string;
    title: string;
    date: string; // ISO timestamp
    duration: number; // seconds
    organizer_email?: string;
    meeting_attendees?: Array<{
        displayName?: string;
        email?: string;
    }>;
    summary?: {
        overview?: string;
        action_items?: string;
        keywords?: string[];
        outline?: string;
        shorthand_bullet?: string;
    };
    sentences?: Array<{
        text: string;
        speaker_name: string;
        start_time: number;
        end_time: number;
    }>;
}

export class FirefliesAdapter implements IngestionAdapter {
    readonly serviceId = "fireflies";

    /**
     * Fetch new Fireflies meetings since last sync
     *
     * Strategy:
     * - First sync: Get recent transcripts (limit 50)
     * - Incremental: Filter by date since last sync
     * - Returns full transcript content with summaries
     */
    async fetchNewContent(userEmail: string, since?: Date): Promise<RawContent[]> {
        const adapterLogger = logger.child({ adapter: "fireflies", userEmail });

        try {
            // Get API credentials and account ID
            const credResult = await this.getApiKeyAndAccount(userEmail);
            if (!credResult) {
                adapterLogger.warn("No Fireflies connection found for user");
                return [];
            }

            const { apiKey, accountId } = credResult;

            // Fetch transcripts list
            const transcripts = await this.fetchTranscripts(apiKey, since);

            if (transcripts.length === 0) {
                adapterLogger.info({ since }, "No new Fireflies transcripts found");
                return [];
            }

            adapterLogger.info(
                { count: transcripts.length, since },
                "📥 Fetched Fireflies transcripts for ingestion"
            );

            // Transform each transcript to RawContent
            // Get full transcript for each (includes sentences/full text)
            const rawContents: RawContent[] = [];

            for (const transcript of transcripts) {
                try {
                    const fullTranscript = await this.fetchFullTranscript(
                        apiKey,
                        transcript.id
                    );
                    const rawContent = this.transformToRawContent(fullTranscript);
                    rawContents.push(rawContent);
                } catch (error) {
                    // Log but continue with other transcripts
                    adapterLogger.error(
                        { error, transcriptId: transcript.id },
                        "Failed to fetch full transcript"
                    );
                    Sentry.captureException(error, {
                        tags: { adapter: "fireflies", operation: "fetch_transcript" },
                        extra: { transcriptId: transcript.id, userEmail },
                    });
                }
            }

            adapterLogger.info(
                { processed: rawContents.length, total: transcripts.length },
                "✅ Processed Fireflies transcripts"
            );

            return rawContents;
        } catch (error) {
            adapterLogger.error({ error }, "Failed to fetch Fireflies content");
            Sentry.captureException(error, {
                tags: { adapter: "fireflies", operation: "fetch_new_content" },
                extra: { userEmail },
            });
            throw error;
        }
    }

    /**
     * Transform raw transcript to ingestable items
     * Note: The actual transformation happens in evaluate()
     * This adapter is for fetching only
     */
    async transformContent(_raw: RawContent): Promise<IngestableItem[]> {
        // Transformation happens in the evaluation step of the ingestion pipeline
        // The adapter's job is just to fetch and format RawContent
        return [];
    }

    /**
     * Get last sync time from integrations table
     * Uses the same account selection logic as getCredentials (default or oldest)
     */
    async getLastSyncTime(userEmail: string): Promise<Date | null> {
        // Get the accountId that will actually be synced
        const credResult = await this.getApiKeyAndAccount(userEmail);
        if (!credResult) {
            return null;
        }

        const results = await db
            .select({ lastSyncAt: schema.integrations.lastSyncAt })
            .from(schema.integrations)
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, "fireflies"),
                    eq(schema.integrations.accountId, credResult.accountId),
                    eq(schema.integrations.status, "connected")
                )
            )
            .limit(1);

        return results[0]?.lastSyncAt ?? null;
    }

    /**
     * Update sync timestamp after successful sync
     * Only updates the specific account that was synced
     */
    async updateSyncTime(userEmail: string, time: Date): Promise<void> {
        // Get the accountId that was actually synced
        const credResult = await this.getApiKeyAndAccount(userEmail);
        if (!credResult) {
            logger.warn({ userEmail }, "Cannot update sync time - no connection found");
            return;
        }

        await db
            .update(schema.integrations)
            .set({ lastSyncAt: time })
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, "fireflies"),
                    eq(schema.integrations.accountId, credResult.accountId)
                )
            );

        logger.debug(
            { userEmail, accountId: credResult.accountId, time },
            "Updated Fireflies sync time"
        );
    }

    /**
     * Get decrypted API key and account ID for user
     * Returns the account that getCredentials selects (default or oldest)
     */
    private async getApiKeyAndAccount(
        userEmail: string
    ): Promise<{ apiKey: string; accountId: string } | null> {
        try {
            const connectionCreds = await getCredentials(userEmail, "fireflies");

            if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
                return null;
            }

            if (!isApiKeyCredentials(connectionCreds.credentials)) {
                return null;
            }

            return {
                apiKey: connectionCreds.credentials.apiKey,
                accountId: connectionCreds.accountId,
            };
        } catch {
            // User doesn't have Fireflies connected
            return null;
        }
    }

    /**
     * Fetch transcript list from Fireflies GraphQL API
     */
    private async fetchTranscripts(
        apiKey: string,
        since?: Date
    ): Promise<FirefliesTranscript[]> {
        // Fireflies uses `fromDate` filter in ISO format
        // Their API also supports `keyword` search but we want all new transcripts
        const query = `
            query ListTranscripts($limit: Int!) {
                transcripts(limit: $limit) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    meeting_attendees {
                        displayName
                        email
                    }
                    summary {
                        overview
                        action_items
                        keywords
                    }
                }
            }
        `;

        const response = await this.executeGraphQL<{
            transcripts: FirefliesTranscript[];
        }>(query, apiKey, { limit: 50 });

        const transcripts = response.transcripts || [];

        // Client-side filter by date if since is provided
        // (Fireflies API filtering is limited, so we fetch more and filter)
        if (since) {
            return transcripts.filter((t) => new Date(t.date) > since);
        }

        return transcripts;
    }

    /**
     * Fetch full transcript with sentences
     */
    private async fetchFullTranscript(
        apiKey: string,
        transcriptId: string
    ): Promise<FirefliesTranscript> {
        const query = `
            query GetTranscript($transcriptId: String!) {
                transcript(id: $transcriptId) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    meeting_attendees {
                        displayName
                        email
                    }
                    summary {
                        overview
                        action_items
                        keywords
                        outline
                        shorthand_bullet
                    }
                    sentences {
                        text
                        speaker_name
                        start_time
                        end_time
                    }
                }
            }
        `;

        const response = await this.executeGraphQL<{
            transcript: FirefliesTranscript;
        }>(query, apiKey, { transcriptId });

        return response.transcript;
    }

    /**
     * Execute GraphQL query against Fireflies API
     */
    private async executeGraphQL<T>(
        query: string,
        apiKey: string,
        variables?: Record<string, unknown>
    ): Promise<T> {
        const response = await httpClient
            .post(FIREFLIES_API_BASE, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                json: {
                    query,
                    variables: variables || {},
                },
            })
            .json<{ data?: T; errors?: Array<{ message: string }> }>();

        if (response.errors && response.errors.length > 0) {
            const errorMessages = response.errors.map((e) => e.message).join(", ");
            throw new Error(`Fireflies GraphQL error: ${errorMessages}`);
        }

        if (!response.data) {
            throw new Error("No data returned from Fireflies API");
        }

        return response.data;
    }

    /**
     * Transform Fireflies transcript to RawContent
     *
     * The content is structured to be maximally useful for ingestion:
     * - Summary/overview at the top for quick understanding
     * - Action items highlighted (often the most valuable)
     * - Full transcript for detail extraction
     * - Metadata preserved for entity extraction
     */
    private transformToRawContent(transcript: FirefliesTranscript): RawContent {
        const parts: string[] = [];

        // Header with meeting metadata
        parts.push(`# Meeting: ${transcript.title}`);
        parts.push(`Date: ${new Date(transcript.date).toLocaleDateString()}`);
        parts.push(`Duration: ${Math.round(transcript.duration / 60)} minutes`);

        if (transcript.organizer_email) {
            parts.push(`Organizer: ${transcript.organizer_email}`);
        }

        if (transcript.meeting_attendees && transcript.meeting_attendees.length > 0) {
            const attendees = transcript.meeting_attendees
                .map((a) => a.displayName || a.email || "Unknown")
                .join(", ");
            parts.push(`Attendees: ${attendees}`);
        }

        parts.push("");

        // Summary section (most valuable for ingestion)
        if (transcript.summary?.overview) {
            parts.push("## Summary");
            parts.push(transcript.summary.overview);
            parts.push("");
        }

        // Action items (high-value for commitment tracking)
        if (transcript.summary?.action_items) {
            parts.push("## Action Items");
            parts.push(transcript.summary.action_items);
            parts.push("");
        }

        // Keywords (useful for categorization)
        if (transcript.summary?.keywords && transcript.summary.keywords.length > 0) {
            parts.push("## Topics");
            parts.push(transcript.summary.keywords.join(", "));
            parts.push("");
        }

        // Full transcript (for detailed extraction)
        if (transcript.sentences && transcript.sentences.length > 0) {
            parts.push("## Transcript");
            for (const sentence of transcript.sentences) {
                parts.push(`**${sentence.speaker_name}:** ${sentence.text}`);
            }
        }

        return {
            content: parts.join("\n"),
            sourceType: "fireflies",
            sourceId: transcript.id,
            timestamp: new Date(transcript.date),
            metadata: {
                title: transcript.title,
                duration: transcript.duration,
                organizer: transcript.organizer_email,
                attendees: transcript.meeting_attendees?.map(
                    (a) => a.displayName || a.email
                ),
                keywords: transcript.summary?.keywords,
                hasActionItems: !!transcript.summary?.action_items,
            },
        };
    }
}
