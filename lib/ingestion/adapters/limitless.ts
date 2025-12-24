/**
 * Limitless Ingestion Adapter
 *
 * Pulls recordings from Limitless Pendant and transforms them into
 * RawContent for the ingestion pipeline. Pendant recordings capture:
 * - Conversations and discussions (in-person and remote)
 * - Meeting context that Fireflies might miss (hallway chats, 1:1s)
 * - Ideas spoken aloud throughout the day
 * - Personal notes and reminders
 *
 * Data flow:
 * 1. Fetch lifelogs since last sync (or recent if first sync)
 * 2. For each lifelog, get full transcript content
 * 3. Transform to RawContent with conversation metadata
 * 4. Update sync timestamp on success
 *
 * Key difference from Fireflies:
 * - Limitless captures ambient audio, not just meetings
 * - Content is more varied and potentially more personal
 * - May contain shorter, fragmented conversations
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

const LIMITLESS_API_BASE = "https://api.limitless.ai/v1";

/**
 * Limitless lifelog shape from REST API
 */
interface LimitlessLifelog {
    id: string;
    summary?: string;
    startedAt: string; // ISO timestamp
    endedAt: string; // ISO timestamp
    markdown?: string; // AI-formatted content
    transcript?: string; // Raw transcript text
    headings?: Array<{
        title: string;
        startMs: number;
        endMs: number;
    }>;
}

/**
 * Limitless API response wrapper
 */
interface LimitlessListResponse {
    data: {
        lifelogs: LimitlessLifelog[];
    };
    meta?: {
        lifelogs?: {
            count: number;
            nextCursor?: string;
        };
    };
}

interface LimitlessDetailResponse {
    data: {
        lifelog: LimitlessLifelog;
    };
}

export class LimitlessAdapter implements IngestionAdapter {
    readonly serviceId = "limitless";

    /**
     * Fetch new Limitless recordings since last sync
     *
     * Strategy:
     * - First sync: Get recent recordings (limit 50)
     * - Incremental: Filter by start date since last sync
     * - Fetches full transcript for each recording
     */
    async fetchNewContent(userEmail: string, since?: Date): Promise<RawContent[]> {
        const adapterLogger = logger.child({ adapter: "limitless", userEmail });

        try {
            // Get API credentials and account ID
            const credResult = await this.getApiKeyAndAccount(userEmail);
            if (!credResult) {
                adapterLogger.warn("No Limitless connection found for user");
                return [];
            }

            const { apiKey, accountId } = credResult;

            // Fetch lifelogs list
            const lifelogs = await this.fetchLifelogs(apiKey, since);

            if (lifelogs.length === 0) {
                adapterLogger.info({ since }, "No new Limitless recordings found");
                return [];
            }

            adapterLogger.info(
                { count: lifelogs.length, since },
                "📥 Fetched Limitless recordings for ingestion"
            );

            // Transform each lifelog to RawContent
            // Get full transcript for each
            const rawContents: RawContent[] = [];

            for (const lifelog of lifelogs) {
                try {
                    // Fetch full details with transcript
                    const fullLifelog = await this.fetchFullLifelog(apiKey, lifelog.id);
                    const rawContent = this.transformToRawContent(fullLifelog);
                    rawContents.push(rawContent);
                } catch (error) {
                    // Log but continue with other recordings
                    adapterLogger.error(
                        { error, lifelogId: lifelog.id },
                        "Failed to fetch full lifelog"
                    );
                    Sentry.captureException(error, {
                        tags: { adapter: "limitless", operation: "fetch_lifelog" },
                        extra: { lifelogId: lifelog.id, userEmail },
                    });
                }
            }

            adapterLogger.info(
                { processed: rawContents.length, total: lifelogs.length },
                "✅ Processed Limitless recordings"
            );

            return rawContents;
        } catch (error) {
            adapterLogger.error({ error }, "Failed to fetch Limitless content");
            Sentry.captureException(error, {
                tags: { adapter: "limitless", operation: "fetch_new_content" },
                extra: { userEmail },
            });
            throw error;
        }
    }

    /**
     * Transform raw lifelog to ingestable items
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
                    eq(schema.integrations.service, "limitless"),
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
                    eq(schema.integrations.service, "limitless"),
                    eq(schema.integrations.accountId, credResult.accountId)
                )
            );

        logger.debug(
            { userEmail, accountId: credResult.accountId, time },
            "Updated Limitless sync time"
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
            const connectionCreds = await getCredentials(userEmail, "limitless");

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
            // User doesn't have Limitless connected
            return null;
        }
    }

    /**
     * Fetch lifelog list from Limitless REST API
     */
    private async fetchLifelogs(
        apiKey: string,
        since?: Date
    ): Promise<LimitlessLifelog[]> {
        const searchParams: Record<string, string> = {
            limit: "50",
            direction: "desc", // Most recent first
        };

        // Use start date filter if provided
        if (since) {
            // Limitless uses 'start' param for date filtering
            searchParams.start = since.toISOString().split("T")[0]; // YYYY-MM-DD
        }

        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/lifelogs`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams,
            })
            .json<LimitlessListResponse>();

        const lifelogs = response.data?.lifelogs || [];

        // Additional client-side filtering for precise timestamp matching
        if (since) {
            return lifelogs.filter((log) => new Date(log.startedAt) > since);
        }

        return lifelogs;
    }

    /**
     * Fetch full lifelog with transcript
     */
    private async fetchFullLifelog(
        apiKey: string,
        lifelogId: string
    ): Promise<LimitlessLifelog> {
        const response = await httpClient
            .get(`${LIMITLESS_API_BASE}/lifelogs/${lifelogId}`, {
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                searchParams: {
                    includeTranscript: "true",
                },
            })
            .json<LimitlessDetailResponse>();

        return response.data.lifelog;
    }

    /**
     * Transform Limitless lifelog to RawContent
     *
     * Limitless content is different from Fireflies:
     * - Often shorter, more fragmented conversations
     * - May include personal notes and thoughts
     * - Headings provide topic structure
     * - Markdown field is AI-formatted, often best for ingestion
     *
     * Strategy: Prefer markdown (AI-formatted), fall back to transcript
     */
    private transformToRawContent(lifelog: LimitlessLifelog): RawContent {
        const parts: string[] = [];

        // Header with recording metadata
        const startDate = new Date(lifelog.startedAt);
        const endDate = new Date(lifelog.endedAt);
        const durationMs = endDate.getTime() - startDate.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        parts.push(`# Recording: ${lifelog.summary || "Untitled"}`);
        parts.push(`Date: ${startDate.toLocaleDateString()}`);
        parts.push(
            `Time: ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`
        );
        parts.push(`Duration: ${durationMinutes} minutes`);
        parts.push("");

        // Headings provide topic structure (if available)
        if (lifelog.headings && lifelog.headings.length > 0) {
            parts.push("## Topics Discussed");
            for (const heading of lifelog.headings) {
                parts.push(`- ${heading.title}`);
            }
            parts.push("");
        }

        // Main content: prefer AI-formatted markdown, fall back to transcript
        if (lifelog.markdown) {
            parts.push("## Content");
            parts.push(lifelog.markdown);
        } else if (lifelog.transcript) {
            parts.push("## Transcript");
            parts.push(lifelog.transcript);
        } else if (lifelog.summary) {
            // Last resort: just the summary
            parts.push("## Summary");
            parts.push(lifelog.summary);
        }

        // Calculate content quality indicators
        const hasStructuredContent = !!lifelog.markdown;
        const hasTranscript = !!lifelog.transcript;
        const hasHeadings = !!lifelog.headings && lifelog.headings.length > 0;

        return {
            content: parts.join("\n"),
            sourceType: "limitless",
            sourceId: lifelog.id,
            timestamp: startDate,
            metadata: {
                summary: lifelog.summary,
                duration: durationMinutes,
                startedAt: lifelog.startedAt,
                endedAt: lifelog.endedAt,
                topics: lifelog.headings?.map((h) => h.title),
                hasStructuredContent,
                hasTranscript,
                hasHeadings,
            },
        };
    }
}
