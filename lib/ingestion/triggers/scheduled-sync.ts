/**
 * Scheduled sync trigger for background knowledge ingestion
 * Runs on a schedule to pull new content from external sources
 *
 * This should be called by:
 * - Cron jobs (e.g., Vercel Cron, Inngest)
 * - Manual sync commands
 * - Webhook handlers
 */

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { ingest } from "../engine";
import { LimitlessAdapter } from "../adapters/limitless";
import { FirefliesAdapter } from "../adapters/fireflies";
import type { IngestionAdapter } from "../adapters/base";
import type { StorageResult } from "../types";

/**
 * Service adapters registry
 */
const ADAPTERS: Record<string, IngestionAdapter> = {
    limitless: new LimitlessAdapter(),
    fireflies: new FirefliesAdapter(),
};

/**
 * Sync configuration for a service
 */
export interface SyncConfig {
    /** Service ID (limitless, fireflies, etc.) */
    serviceId: string;
    /** User email for authentication */
    userEmail: string;
    /** User ID for storage */
    userId: string;
    /** Whether to sync incrementally (since last sync) or full sync */
    incremental: boolean;
}

/**
 * Run scheduled sync for a specific service
 *
 * @param config - Sync configuration
 * @returns Storage results
 */
export async function runScheduledSync(config: SyncConfig): Promise<StorageResult[]> {
    return Sentry.startSpan(
        {
            op: "ingestion.trigger.scheduled",
            name: `Scheduled sync: ${config.serviceId}`,
        },
        async (span) => {
            try {
                span.setAttribute("service_id", config.serviceId);
                span.setAttribute("user_email", config.userEmail);
                span.setAttribute("incremental", config.incremental);

                logger.info(
                    {
                        serviceId: config.serviceId,
                        userEmail: config.userEmail,
                        incremental: config.incremental,
                    },
                    "⏰ Starting scheduled sync"
                );

                // Get adapter
                const adapter = ADAPTERS[config.serviceId];
                if (!adapter) {
                    throw new Error(`Unknown service: ${config.serviceId}`);
                }

                // Get last sync time if incremental
                const since = config.incremental
                    ? await adapter.getLastSyncTime(config.userEmail)
                    : undefined;

                // Fetch new content
                const rawContents = await adapter.fetchNewContent(
                    config.userEmail,
                    since ?? undefined
                );

                logger.info(
                    {
                        serviceId: config.serviceId,
                        contentCount: rawContents.length,
                    },
                    "📥 Fetched content for ingestion"
                );

                if (rawContents.length === 0) {
                    logger.info(
                        { serviceId: config.serviceId },
                        "No new content to ingest"
                    );
                    return [];
                }

                // Ingest each piece of content
                const allResults: StorageResult[] = [];

                for (const rawContent of rawContents) {
                    try {
                        const results = await ingest(config.userId, rawContent);
                        allResults.push(...results);
                    } catch (error) {
                        logger.error(
                            {
                                error,
                                sourceId: rawContent.sourceId,
                            },
                            "Failed to ingest content"
                        );
                        Sentry.captureException(error, {
                            tags: {
                                component: "ingestion-trigger",
                                trigger: "scheduled",
                                service: config.serviceId,
                            },
                            extra: {
                                sourceId: rawContent.sourceId,
                                userId: config.userId,
                            },
                        });
                    }
                }

                // Update last sync time
                await adapter.updateSyncTime(config.userEmail, new Date());

                const successCount = allResults.filter((r) => r.success).length;
                logger.info(
                    {
                        serviceId: config.serviceId,
                        successCount,
                        totalCount: allResults.length,
                    },
                    "✅ Scheduled sync completed"
                );

                span.setAttribute("success_count", successCount);
                span.setAttribute("total_count", allResults.length);

                return allResults;
            } catch (error) {
                logger.error(
                    {
                        error,
                        serviceId: config.serviceId,
                        userEmail: config.userEmail,
                    },
                    "Scheduled sync failed"
                );
                Sentry.captureException(error, {
                    tags: {
                        component: "ingestion-trigger",
                        trigger: "scheduled",
                        service: config.serviceId,
                    },
                    extra: {
                        userEmail: config.userEmail,
                        userId: config.userId,
                    },
                });
                throw error;
            }
        }
    );
}

/**
 * Sync all services for a user
 *
 * @param userEmail - User email
 * @param userId - User ID
 * @param incremental - Whether to sync incrementally
 * @returns Combined storage results from all services
 */
export async function syncAllServices(
    userEmail: string,
    userId: string,
    incremental = true
): Promise<Record<string, StorageResult[]>> {
    logger.info({ userEmail, incremental }, "🔄 Starting sync for all services");

    const results: Record<string, StorageResult[]> = {};

    for (const serviceId of Object.keys(ADAPTERS)) {
        try {
            const serviceResults = await runScheduledSync({
                serviceId,
                userEmail,
                userId,
                incremental,
            });
            results[serviceId] = serviceResults;
        } catch (error) {
            logger.error(
                { error, serviceId },
                "Service sync failed - continuing with others"
            );
            results[serviceId] = [];
        }
    }

    const totalSuccess = Object.values(results)
        .flat()
        .filter((r) => r.success).length;

    logger.info(
        {
            userEmail,
            totalSuccess,
            services: Object.keys(results).length,
        },
        "✅ All services sync completed"
    );

    return results;
}
