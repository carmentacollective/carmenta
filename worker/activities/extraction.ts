/**
 * Extraction Activities - Process imported conversations to extract knowledge
 *
 * Activities handle:
 * - Loading unprocessed conversations
 * - LLM extraction calls
 * - Database updates for progress and results
 */

import { and, eq, notInArray, inArray } from "drizzle-orm";

import { db } from "../../lib/db";
import {
    connections,
    messages,
    messageParts,
    extractionJobs,
    extractionProcessedConnections,
    pendingExtractions,
    users,
} from "../../lib/db/schema";
import { logger } from "../../lib/logger";
import { captureActivityError } from "../lib/activity-sentry";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { extractionSystemPrompt } from "../../lib/import/extraction/prompt";

const EXTRACTION_MODEL = "anthropic/claude-sonnet-4.5";

/**
 * Extraction job input from workflow
 */
export interface ExtractionJobInput {
    jobId: string;
    userId: string;
    connectionIds?: number[];
}

/**
 * Context for extraction job
 */
export interface ExtractionContext {
    jobId: string;
    userId: string;
    userEmail: string;
    connectionIds: number[];
    totalConversations: number;
}

/**
 * Result from processing a batch
 */
export interface BatchResult {
    processedCount: number;
    extractedCount: number;
    errors: string[];
}

/**
 * Load extraction context - get user info and connections to process
 */
export async function loadExtractionContext(
    input: ExtractionJobInput
): Promise<ExtractionContext> {
    const { jobId, userId, connectionIds } = input;

    try {
        // Get user email
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        // Get connections to process
        let connectionsToProcess: number[];

        if (connectionIds && connectionIds.length > 0) {
            // Specific connections requested
            connectionsToProcess = connectionIds;
        } else {
            // Get all unprocessed connections for this user
            const processed = await db
                .select({ connectionId: extractionProcessedConnections.connectionId })
                .from(extractionProcessedConnections)
                .where(eq(extractionProcessedConnections.userId, userId));

            const processedIds = processed.map((p) => p.connectionId);

            const unprocessed = await db
                .select({ id: connections.id })
                .from(connections)
                .where(
                    and(
                        eq(connections.userId, userId),
                        inArray(connections.source, ["openai", "anthropic"]),
                        processedIds.length > 0
                            ? notInArray(connections.id, processedIds)
                            : undefined
                    )
                );

            connectionsToProcess = unprocessed.map((c) => c.id);
        }

        // Update job with total count
        await db
            .update(extractionJobs)
            .set({
                totalConversations: connectionsToProcess.length,
                status: "processing",
                startedAt: new Date(),
            })
            .where(eq(extractionJobs.id, jobId));

        return {
            jobId,
            userId,
            userEmail: user.email,
            connectionIds: connectionsToProcess,
            totalConversations: connectionsToProcess.length,
        };
    } catch (error) {
        captureActivityError(error, {
            activityName: "loadExtractionContext",
            jobId,
            userId,
        });
        throw error;
    }
}

/**
 * Process a batch of conversations through the LLM
 */
export async function processConversationBatch(
    context: ExtractionContext,
    batchConnectionIds: number[]
): Promise<BatchResult> {
    const { jobId, userId } = context;
    const activityLogger = logger.child({
        jobId,
        activity: "processConversationBatch",
        batchSize: batchConnectionIds.length,
    });

    let processedCount = 0;
    let extractedCount = 0;
    const errors: string[] = [];

    try {
        for (const connectionId of batchConnectionIds) {
            try {
                // Get user messages for this conversation
                const userMessages = await getConnectionUserMessages(connectionId);

                if (userMessages.length === 0) {
                    // Mark as processed but with no extractions
                    await db.insert(extractionProcessedConnections).values({
                        userId,
                        connectionId,
                        jobId,
                        extractionCount: 0,
                    });
                    processedCount++;
                    continue;
                }

                // Call LLM to extract facts
                const result = await extractFromConversation(userMessages);

                // Save extractions in a transaction
                await db.transaction(async (tx) => {
                    // Mark connection as processed
                    await tx.insert(extractionProcessedConnections).values({
                        userId,
                        connectionId,
                        jobId,
                        extractionCount: result.facts.length,
                    });

                    // Insert extractions
                    if (result.facts.length > 0) {
                        await tx.insert(pendingExtractions).values(
                            result.facts.map((fact) => ({
                                userId,
                                connectionId,
                                category: fact.category,
                                content: fact.content,
                                summary: fact.summary,
                                confidence: fact.confidence,
                                sourceTimestamp: fact.sourceTimestamp
                                    ? new Date(fact.sourceTimestamp)
                                    : null,
                            }))
                        );
                    }
                });

                extractedCount += result.facts.length;
                processedCount++;

                activityLogger.debug(
                    { connectionId, factsExtracted: result.facts.length },
                    "Processed conversation"
                );
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                errors.push(`Connection ${connectionId}: ${errorMessage}`);
                activityLogger.error(
                    { connectionId, error: errorMessage },
                    "Failed to process conversation"
                );
                // Continue with next conversation
            }
        }

        return { processedCount, extractedCount, errors };
    } catch (error) {
        captureActivityError(error, {
            activityName: "processConversationBatch",
            jobId,
            userId,
            batchSize: batchConnectionIds.length,
        });
        throw error;
    }
}

/**
 * Update job progress in database
 */
export async function updateJobProgress(
    jobId: string,
    processedConversations: number,
    extractedCount: number
): Promise<void> {
    try {
        await db
            .update(extractionJobs)
            .set({
                processedConversations,
                extractedCount,
            })
            .where(eq(extractionJobs.id, jobId));
    } catch (error) {
        captureActivityError(error, {
            activityName: "updateJobProgress",
            jobId,
            processedConversations,
            extractedCount,
        });
        throw error;
    }
}

/**
 * Finalize extraction job - mark as completed or failed
 */
export async function finalizeExtractionJob(
    jobId: string,
    success: boolean,
    errorMessage?: string
): Promise<void> {
    try {
        await db
            .update(extractionJobs)
            .set({
                status: success ? "completed" : "failed",
                errorMessage: errorMessage ?? null,
                completedAt: new Date(),
            })
            .where(eq(extractionJobs.id, jobId));

        logger.info(
            { jobId, success, errorMessage },
            success ? "Extraction job completed" : "Extraction job failed"
        );
    } catch (error) {
        captureActivityError(error, {
            activityName: "finalizeExtractionJob",
            jobId,
            success,
        });
        throw error;
    }
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Get user messages from a connection, grouped by message
 */
async function getConnectionUserMessages(
    connectionId: number
): Promise<Array<{ id: string; createdAt: Date; content: string }>> {
    const result = await db
        .select({
            id: messages.id,
            createdAt: messages.createdAt,
            textContent: messageParts.textContent,
        })
        .from(messages)
        .leftJoin(messageParts, eq(messageParts.messageId, messages.id))
        .where(
            and(
                eq(messages.connectionId, connectionId),
                eq(messages.role, "user"),
                eq(messageParts.type, "text")
            )
        )
        .orderBy(messages.createdAt);

    // Group parts by message ID
    const messageMap = new Map<
        string,
        { id: string; createdAt: Date; parts: string[] }
    >();

    for (const row of result) {
        if (!messageMap.has(row.id)) {
            messageMap.set(row.id, {
                id: row.id,
                createdAt: row.createdAt,
                parts: [],
            });
        }
        if (row.textContent) {
            messageMap.get(row.id)!.parts.push(row.textContent);
        }
    }

    return Array.from(messageMap.values()).map((msg) => ({
        id: msg.id,
        createdAt: msg.createdAt,
        content: msg.parts.join("\n"),
    }));
}

/**
 * Schema for extraction output
 */
const extractionSchema = z.object({
    facts: z.array(
        z.object({
            category: z.enum([
                "identity",
                "preference",
                "person",
                "project",
                "decision",
                "expertise",
            ]),
            content: z.string(),
            summary: z.string(),
            confidence: z.number(),
            sourceTimestamp: z.string().optional(),
        })
    ),
});

/**
 * Extract facts from conversation using LLM
 */
async function extractFromConversation(
    userMessages: Array<{ id: string; createdAt: Date; content: string }>
): Promise<z.infer<typeof extractionSchema>> {
    const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    const conversationText = userMessages
        .map((m) => `[${m.createdAt.toISOString()}]\n${m.content}`)
        .join("\n\n---\n\n");

    const result = await generateObject({
        model: openrouter(EXTRACTION_MODEL),
        schema: extractionSchema,
        prompt: `${extractionSystemPrompt}\n\n<conversation>\n${conversationText}\n</conversation>`,
    });

    return result.object;
}
