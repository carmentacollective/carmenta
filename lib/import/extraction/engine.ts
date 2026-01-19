/**
 * Extraction Engine
 *
 * Processes imported conversations to extract knowledge for user review.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
    pendingExtractions,
    extractionJobs,
    extractionProcessedConnections,
    connections,
    messages,
    messageParts,
    users,
} from "@/lib/db/schema";
import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { logger } from "@/lib/logger";
import { kb, PROFILE_PATHS } from "@/lib/kb";
import { extractionSystemPrompt, buildExtractionPrompt } from "./prompt";
import type {
    ExtractedFact,
    ConversationExtractionResult,
    ExtractionCategory,
} from "./types";

// Model selection - uses config IDs, not hardcoded dates
const EXTRACTION_MODEL = "anthropic/claude-sonnet-4.5";

// Batch processing settings
const BATCH_SIZE = 10;
const MIN_USER_MESSAGES = 2; // Skip very short conversations

/**
 * Schema for LLM extraction output
 */
const extractionSchema = z.object({
    shouldExtract: z.boolean(),
    reasoning: z.string(),
    facts: z.array(
        z.object({
            category: z.enum([
                "identity",
                "preference",
                "person",
                "project",
                "decision",
                "expertise",
                "voice",
            ]),
            content: z.string(),
            summary: z.string(),
            confidence: z.number(),
            suggestedPath: z.string(),
        })
    ),
});

/**
 * Get imported connections that haven't been processed yet
 */
export async function getUnprocessedImports(
    userId: string,
    limit = 100
): Promise<Array<{ id: number; title: string | null }>> {
    const result = await db
        .select({
            id: connections.id,
            title: connections.title,
        })
        .from(connections)
        .leftJoin(
            extractionProcessedConnections,
            and(
                eq(extractionProcessedConnections.connectionId, connections.id),
                eq(extractionProcessedConnections.userId, userId)
            )
        )
        .where(
            and(
                eq(connections.userId, userId),
                inArray(connections.source, ["openai", "anthropic"]),
                isNull(extractionProcessedConnections.id)
            )
        )
        // Process oldest conversations first for proper temporal resolution
        .orderBy(connections.createdAt)
        .limit(limit);

    return result;
}

/**
 * Get user messages from a connection
 */
async function getConnectionUserMessages(
    connectionId: number
): Promise<Array<{ id: string; content: string; createdAt: Date }>> {
    // Get user messages with their text parts
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
        .orderBy(messages.createdAt, messageParts.order);

    // Group parts by message
    const messageMap = new Map<
        string,
        { id: string; createdAt: Date; contents: string[] }
    >();

    for (const row of result) {
        if (!messageMap.has(row.id)) {
            messageMap.set(row.id, {
                id: row.id,
                createdAt: row.createdAt,
                contents: [],
            });
        }
        if (row.textContent) {
            messageMap.get(row.id)!.contents.push(row.textContent);
        }
    }

    return Array.from(messageMap.values())
        .map((m) => ({
            id: m.id,
            content: m.contents.join("\n"),
            createdAt: m.createdAt,
        }))
        .filter((m) => m.content.trim().length > 0);
}

/**
 * Extract knowledge from a single conversation
 */
export async function extractFromConversation(
    connectionId: number,
    title: string | null,
    userName?: string,
    profileContext?: string
): Promise<ConversationExtractionResult> {
    const userMessages = await getConnectionUserMessages(connectionId);

    // Skip very short conversations
    if (userMessages.length < MIN_USER_MESSAGES) {
        return {
            connectionId,
            facts: [],
            skipped: true,
            skipReason: `Only ${userMessages.length} user messages`,
        };
    }

    // Build prompt
    const prompt = buildExtractionPrompt(
        title || "Untitled Conversation",
        userMessages.map((m) => ({ content: m.content, createdAt: m.createdAt })),
        userName,
        profileContext
    );

    try {
        const gateway = getGatewayClient();
        const result = await generateObject({
            model: gateway(translateModelId(EXTRACTION_MODEL)),
            system: extractionSystemPrompt,
            prompt,
            schema: extractionSchema,
            temperature: 0.3,
            maxRetries: 2,
        });

        if (!result.object.shouldExtract) {
            return {
                connectionId,
                facts: [],
                skipped: true,
                skipReason: result.object.reasoning,
            };
        }

        // Map to ExtractedFact
        // Note: sourceTimestamp is undefined since we can't determine which message the fact came from
        const facts: ExtractedFact[] = result.object.facts.map((f) => ({
            category: f.category as ExtractionCategory,
            content: f.content,
            summary: f.summary,
            confidence: f.confidence,
            suggestedPath: f.suggestedPath,
            sourceTimestamp: undefined,
        }));

        return {
            connectionId,
            facts,
            skipped: false,
        };
    } catch (error) {
        logger.error({ error, connectionId }, "Failed to extract from conversation");
        return {
            connectionId,
            facts: [],
            skipped: true,
            skipReason: error instanceof Error ? error.message : "Extraction failed",
        };
    }
}

/**
 * Create a new extraction job
 */
export async function createExtractionJob(
    userId: string,
    connectionIds?: number[]
): Promise<string> {
    // Get count of unprocessed imports
    let totalConversations: number;
    let targetConnectionIds: number[] | null = null;

    if (connectionIds && connectionIds.length > 0) {
        totalConversations = connectionIds.length;
        targetConnectionIds = connectionIds;
    } else {
        const unprocessed = await getUnprocessedImports(userId, 1000);
        totalConversations = unprocessed.length;
    }

    const [job] = await db
        .insert(extractionJobs)
        .values({
            userId,
            totalConversations,
            connectionIds: targetConnectionIds,
        })
        .returning();

    return job.id;
}

/**
 * Process an extraction job
 *
 * This is designed to be called from an API route or background worker.
 * It processes conversations in batches and updates progress.
 */
export async function processExtractionJob(jobId: string): Promise<void> {
    // Get job
    const [job] = await db
        .select()
        .from(extractionJobs)
        .where(eq(extractionJobs.id, jobId));

    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== "queued") {
        logger.warn({ jobId, status: job.status }, "Job not in queued status");
        return;
    }

    // Mark as processing
    await db
        .update(extractionJobs)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(extractionJobs.id, jobId));

    try {
        // Fetch user info for personalized extraction
        const [user] = await db
            .select({
                firstName: users.firstName,
                displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, job.userId));

        const userName = user?.displayName || user?.firstName || undefined;

        // Fetch profile identity for additional context
        let profileContext: string | undefined;
        try {
            const identityDoc = await kb.read(job.userId, PROFILE_PATHS.identity);
            profileContext = identityDoc?.content?.trim() || undefined;
        } catch (error) {
            logger.warn(
                { error, userId: job.userId },
                "Failed to read profile identity for extraction context - continuing without"
            );
            // Continue without profile context rather than failing the job
        }

        // Get connections to process
        let connectionIdsToProcess: number[];

        if (job.connectionIds && job.connectionIds.length > 0) {
            connectionIdsToProcess = job.connectionIds;
        } else {
            const unprocessed = await getUnprocessedImports(job.userId, 1000);
            connectionIdsToProcess = unprocessed.map((c) => c.id);
        }

        let processedCount = 0;
        let extractedCount = 0;

        // Process in batches
        for (let i = 0; i < connectionIdsToProcess.length; i += BATCH_SIZE) {
            const batch = connectionIdsToProcess.slice(i, i + BATCH_SIZE);

            // Get connection details - filter by userId to prevent processing other users' connections
            const connectionDetailsRaw = await db
                .select({ id: connections.id, title: connections.title })
                .from(connections)
                .where(
                    and(
                        inArray(connections.id, batch),
                        eq(connections.userId, job.userId)
                    )
                );

            // Preserve oldest-first order from batch (DB doesn't guarantee inArray order)
            const connectionDetailsMap = new Map(
                connectionDetailsRaw.map((c) => [c.id, c])
            );
            const connectionDetails = batch
                .map((id) => connectionDetailsMap.get(id))
                .filter(
                    (c): c is { id: number; title: string | null } => c !== undefined
                );

            // Process batch in order (oldest first for temporal resolution)
            const results = await Promise.all(
                connectionDetails.map((c) =>
                    extractFromConversation(c.id, c.title, userName, profileContext)
                )
            );

            // Save extractions and mark as processed atomically
            for (const result of results) {
                await db.transaction(async (tx) => {
                    // Mark as processed (idempotent - handle retries gracefully)
                    await tx
                        .insert(extractionProcessedConnections)
                        .values({
                            userId: job.userId,
                            connectionId: result.connectionId,
                            jobId: job.id,
                            extractionCount: result.facts.length,
                        })
                        .onConflictDoNothing();

                    // Save extractions
                    if (result.facts.length > 0) {
                        await tx.insert(pendingExtractions).values(
                            result.facts.map((f) => ({
                                userId: job.userId,
                                connectionId: result.connectionId,
                                category: f.category,
                                content: f.content,
                                summary: f.summary,
                                confidence: f.confidence,
                                suggestedPath: f.suggestedPath,
                                sourceTimestamp: f.sourceTimestamp,
                            }))
                        );
                        extractedCount += result.facts.length;
                    }
                });

                processedCount++;
            }

            // Update progress
            await db
                .update(extractionJobs)
                .set({
                    processedConversations: processedCount,
                    extractedCount,
                })
                .where(eq(extractionJobs.id, jobId));

            logger.info(
                {
                    jobId,
                    processed: processedCount,
                    total: connectionIdsToProcess.length,
                    extracted: extractedCount,
                },
                "Extraction batch complete"
            );
        }

        // Mark as completed
        await db
            .update(extractionJobs)
            .set({
                status: "completed",
                completedAt: new Date(),
                processedConversations: processedCount,
                extractedCount,
            })
            .where(eq(extractionJobs.id, jobId));

        logger.info(
            { jobId, processedCount, extractedCount },
            "Extraction job completed"
        );
    } catch (error) {
        // Mark job as failed in database before re-throwing
        // Sentry capture happens automatically when error bubbles up
        try {
            await db
                .update(extractionJobs)
                .set({
                    status: "failed",
                    errorMessage:
                        error instanceof Error ? error.message : "Unknown error",
                    completedAt: new Date(),
                })
                .where(eq(extractionJobs.id, jobId));
        } catch (dbError) {
            // Log DB failure but don't mask the original error
            logger.error({ error: dbError, jobId }, "Failed to mark job as failed");
        }
        throw error;
    }
}

/**
 * Get job status
 *
 * Requires userId to prevent IDOR - users can only query their own jobs.
 * Returns data directly from the job table - simple and reliable.
 */
export async function getJobStatus(
    jobId: string,
    userId: string
): Promise<{
    status: string;
    totalConversations: number;
    processedConversations: number;
    extractedCount: number;
    errorMessage?: string | null;
} | null> {
    const [job] = await db
        .select()
        .from(extractionJobs)
        .where(and(eq(extractionJobs.id, jobId), eq(extractionJobs.userId, userId)));

    if (!job) return null;

    return {
        status: job.status,
        totalConversations: job.totalConversations,
        processedConversations: job.processedConversations,
        extractedCount: job.extractedCount,
        errorMessage: job.errorMessage,
    };
}

/**
 * Get pending extractions for user review
 */
export async function getPendingExtractions(
    userId: string,
    options?: {
        status?: "pending" | "approved" | "rejected" | "edited";
        category?: ExtractionCategory;
        limit?: number;
        offset?: number;
        sort?: "asc" | "desc";
    }
): Promise<{
    extractions: Array<{
        id: string;
        category: string;
        content: string;
        summary: string;
        confidence: number;
        suggestedPath: string | null;
        status: string;
        sourceTimestamp: Date | null;
        connectionId: number;
        connectionTitle: string | null;
    }>;
    total: number;
}> {
    const conditions = [eq(pendingExtractions.userId, userId)];

    if (options?.status) {
        conditions.push(eq(pendingExtractions.status, options.status));
    }
    if (options?.category) {
        conditions.push(eq(pendingExtractions.category, options.category));
    }

    const [extractions, countResult] = await Promise.all([
        db
            .select({
                id: pendingExtractions.id,
                category: pendingExtractions.category,
                content: pendingExtractions.content,
                summary: pendingExtractions.summary,
                confidence: pendingExtractions.confidence,
                suggestedPath: pendingExtractions.suggestedPath,
                status: pendingExtractions.status,
                sourceTimestamp: pendingExtractions.sourceTimestamp,
                connectionId: pendingExtractions.connectionId,
                connectionTitle: connections.title,
            })
            .from(pendingExtractions)
            .leftJoin(connections, eq(pendingExtractions.connectionId, connections.id))
            .where(and(...conditions))
            // Default ascending for stable offset-based pagination (approve-all batching)
            // Use desc for "Just found" in progress display
            .orderBy(
                options?.sort === "desc"
                    ? sql`${pendingExtractions.createdAt} DESC`
                    : pendingExtractions.createdAt
            )
            .limit(options?.limit ?? 50)
            .offset(options?.offset ?? 0),
        db
            .select({ count: sql<number>`count(*)::int` })
            .from(pendingExtractions)
            .where(and(...conditions)),
    ]);

    return {
        extractions,
        total: countResult[0]?.count ?? 0,
    };
}

/**
 * Get extraction stats for the review UI
 */
export async function getExtractionStats(userId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    edited: number;
    byCategory: Record<string, number>;
}> {
    const [statusCounts, categoryCounts] = await Promise.all([
        db
            .select({
                status: pendingExtractions.status,
                count: sql<number>`count(*)::int`,
            })
            .from(pendingExtractions)
            .where(eq(pendingExtractions.userId, userId))
            .groupBy(pendingExtractions.status),
        db
            .select({
                category: pendingExtractions.category,
                count: sql<number>`count(*)::int`,
            })
            .from(pendingExtractions)
            .where(
                and(
                    eq(pendingExtractions.userId, userId),
                    eq(pendingExtractions.status, "pending")
                )
            )
            .groupBy(pendingExtractions.category),
    ]);

    const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s.count]));
    const categoryMap = Object.fromEntries(
        categoryCounts.map((c) => [c.category, c.count])
    );

    const pending = statusMap.pending ?? 0;
    const approved = statusMap.approved ?? 0;
    const edited = statusMap.edited ?? 0;
    const rejected = statusMap.rejected ?? 0;

    return {
        total: pending + approved + edited + rejected,
        pending,
        approved,
        rejected,
        edited,
        byCategory: categoryMap,
    };
}
