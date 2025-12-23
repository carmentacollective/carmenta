/**
 * Follow-up engine integration
 * Trigger for automatic knowledge ingestion from conversations
 *
 * This integrates with the existing follow-up engine to extract
 * knowledge from conversations in real-time.
 */

import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { ingestFromConversation } from "../engine";
import type { StorageResult } from "../types";

/**
 * Configuration for follow-up ingestion
 */
export interface FollowUpIngestionConfig {
    /** Minimum conversation length (message count) before triggering ingestion */
    minMessageCount: number;
    /** Whether to run ingestion asynchronously */
    async: boolean;
    /** Whether to notify user of ingestion results */
    notifyUser: boolean;
}

const DEFAULT_CONFIG: FollowUpIngestionConfig = {
    minMessageCount: 3, // Need at least 3 messages for context
    async: true, // Don't block conversation
    notifyUser: false, // Silent by default
};

/**
 * Hook into follow-up engine to trigger ingestion
 *
 * This should be called from the follow-up engine after generating a follow-up.
 * It extracts knowledge from the conversation and stores it in the KB.
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID
 * @param userMessages - User messages from the conversation
 * @param assistantMessages - Assistant messages from the conversation
 * @param config - Optional configuration
 * @returns Storage results (or empty array if async)
 */
export async function triggerFollowUpIngestion(
    userId: string,
    conversationId: string,
    userMessages: string[],
    assistantMessages: string[],
    config: Partial<FollowUpIngestionConfig> = {}
): Promise<StorageResult[]> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    return Sentry.startSpan(
        { op: "ingestion.trigger.followup", name: "Follow-up ingestion trigger" },
        async (span) => {
            try {
                span.setAttribute("conversation_id", conversationId);
                span.setAttribute(
                    "message_count",
                    userMessages.length + assistantMessages.length
                );
                span.setAttribute("async", finalConfig.async);

                // Check minimum message count
                const totalMessages = userMessages.length + assistantMessages.length;
                if (totalMessages < finalConfig.minMessageCount) {
                    logger.debug(
                        {
                            conversationId,
                            messageCount: totalMessages,
                            minRequired: finalConfig.minMessageCount,
                        },
                        "Skipping ingestion - not enough messages"
                    );
                    return [];
                }

                logger.info(
                    { conversationId, messageCount: totalMessages },
                    "🔄 Triggering follow-up ingestion"
                );

                // Run ingestion
                const ingestPromise = ingestFromConversation(
                    userId,
                    userMessages,
                    assistantMessages,
                    conversationId
                );

                // If async, fire and forget
                if (finalConfig.async) {
                    void ingestPromise
                        .then((results) => {
                            const successCount = results.filter(
                                (r) => r.success
                            ).length;
                            logger.info(
                                {
                                    conversationId,
                                    successCount,
                                    totalCount: results.length,
                                },
                                "✅ Follow-up ingestion completed"
                            );

                            // TODO: If notifyUser, send notification
                            if (finalConfig.notifyUser && successCount > 0) {
                                // Implement user notification
                            }
                        })
                        .catch((error) => {
                            logger.error(
                                { error, conversationId },
                                "Follow-up ingestion failed"
                            );
                            Sentry.captureException(error, {
                                tags: {
                                    component: "ingestion-trigger",
                                    trigger: "followup",
                                },
                                extra: { conversationId, userId },
                            });
                        });

                    return []; // Return immediately
                }

                // Synchronous - wait for completion
                const results = await ingestPromise;

                const successCount = results.filter((r) => r.success).length;
                logger.info(
                    {
                        conversationId,
                        successCount,
                        totalCount: results.length,
                    },
                    "✅ Follow-up ingestion completed"
                );

                return results;
            } catch (error) {
                logger.error(
                    { error, conversationId },
                    "Follow-up ingestion trigger failed"
                );
                Sentry.captureException(error, {
                    tags: {
                        component: "ingestion-trigger",
                        trigger: "followup",
                    },
                    extra: { conversationId, userId },
                });
                throw error;
            }
        }
    );
}
